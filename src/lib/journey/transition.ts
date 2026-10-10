import type { SupabaseClient } from "@supabase/supabase-js";
import { nextAction, type PartnerKind } from "./derived";
import { decide } from "./stateMachine";
import type { Stage } from "./stages";
import type { Actor, JourneyEvent, JourneyState, NextStepType, TransitionError } from "./types";

/**
 * The audit `detail` may carry logistics only. Clinical values, FIB-4 and summary text never go here,
 * so unknown keys are rejected rather than stored.
 */
const DETAIL_KEYS = ["partner", "slot", "reason", "step", "months", "route", "ultrasound", "report_id", "recommends_vcte"] as const;
export type EventDetail = Partial<Record<(typeof DETAIL_KEYS)[number], string | number | boolean>>;

/** A booking made by BOOK or RESCHEDULE. slotId is null for bookings without a slot (routine follow-up). */
export type BookingEffect = { partnerId: string; slotId: string | null; kind: PartnerKind; slotLabel: string };

/** A report row created by LAB_UPLOAD or CENTRE_UPLOAD. labValues is clinical: it goes to `reports` only, never to the audit detail. */
export type ReportEffect = {
  kind: "lab" | "fibroscan";
  partnerId: string | null;
  storagePath: string;
  fileName: string;
  labValues?: Record<string, number>;
};

/** The clinician's review. FIB-4 and the summary are typed by hand; they go to `reviews` only, never to the audit detail. */
export type ReviewEffect = { fib4Text: string; summary: string; recommendsVcte: boolean };

export type Effects = { booking?: BookingEffect; report?: ReportEffect; review?: ReviewEffect };

/** Hours until the next pending action is overdue. */
const TASK_HOURS = 24;

export type TaskRequest = { owner: string; description: string; hours: number };

export type ApplyRequest = {
  journeyId: string;
  event: JourneyEvent["type"];
  expected: JourneyState;
  next: JourneyState;
  actor: Actor;
  detail: EventDetail;
  nextStep: NextStepType | null;
  declineReason: string | null;
  effects: Effects;
  /** The pending action after this move, or null when nothing is left to do. */
  nextTask: TaskRequest | null;
};

/** Persistence port. The Supabase implementation calls the apply_journey_event function. */
export interface JourneyStore {
  get(journeyId: string): Promise<JourneyState | null>;
  /** Writes the stage change and its audit row in one transaction. Throws StaleJourneyError if the state moved. */
  apply(req: ApplyRequest): Promise<{ eventId: number }>;
}

export class StaleJourneyError extends Error {
  constructor() {
    super("The journey changed while you were working. Reload and try again.");
  }
}

export class SlotTakenError extends Error {
  constructor() {
    super("That time was just taken. Choose another.");
  }
}

export type TransitionResult =
  | { ok: true; stage: Stage; missed: boolean; eventId: number }
  | { ok: false; error: TransitionError | { code: "not_found" | "stale" | "invalid_detail" | "invalid_payload"; message: string } };

const NEEDS_BOOKING = ["BOOK", "RESCHEDULE"];
const REPORT_KIND_FOR: Record<string, ReportEffect["kind"]> = { LAB_UPLOAD: "lab", CENTRE_UPLOAD: "fibroscan" };

function checkEffects(event: JourneyEvent, effects: Effects): string | null {
  if (NEEDS_BOOKING.includes(event.type) && !effects.booking) return "A booking is required";
  if (!NEEDS_BOOKING.includes(event.type) && effects.booking) return "This event does not take a booking";
  const kind = REPORT_KIND_FOR[event.type];
  if (kind && effects.report?.kind !== kind) return "A report of the right kind is required";
  if (!kind && effects.report) return "This event does not take a report";
  if (event.type === "CLINICIAN_SUBMIT") {
    if (!effects.review || !effects.review.fib4Text.trim() || !effects.review.summary.trim()) return "The FIB-4 text and the summary are required";
  } else if (effects.review) {
    return "This event does not take a review";
  }
  return null;
}

function taskFor(state: JourneyState): TaskRequest | null {
  const next = nextAction(state);
  return next ? { owner: next.who, description: next.what, hours: TASK_HOURS } : null;
}

/** The only way a journey's stage changes (CLAUDE.md rule 3). Every call that succeeds writes an audit row (rule 4). */
export async function transition(
  store: JourneyStore,
  journeyId: string,
  event: JourneyEvent,
  actor: Actor,
  detail: EventDetail = {},
  effects: Effects = {},
): Promise<TransitionResult> {
  const unknown = Object.keys(detail).filter((k) => !(DETAIL_KEYS as readonly string[]).includes(k));
  if (unknown.length > 0) {
    return { ok: false, error: { code: "invalid_detail", message: `Not allowed in the audit trail: ${unknown.join(", ")}` } };
  }

  const state = await store.get(journeyId);
  if (!state) return { ok: false, error: { code: "not_found", message: "Journey not found" } };

  const decision = decide(state, event, actor);
  if (!decision.ok) return decision;

  const problem = checkEffects(event, effects);
  if (problem) return { ok: false, error: { code: "invalid_payload", message: problem } };

  try {
    const { eventId } = await store.apply({
      journeyId,
      event: event.type,
      expected: state,
      next: decision.next,
      actor,
      detail,
      nextStep: event.type === "CHOOSE_NEXT_STEP" ? event.step : null,
      declineReason: event.type === "DECLINE_VCTE" ? event.reason : null,
      effects,
      nextTask: taskFor(decision.next),
    });
    return { ok: true, ...decision.next, eventId };
  } catch (e) {
    if (e instanceof StaleJourneyError) return { ok: false, error: { code: "stale", message: e.message } };
    if (e instanceof SlotTakenError) return { ok: false, error: { code: "invalid_payload", message: e.message } };
    throw e;
  }
}

/** Store backed by Supabase. Pass a service-role client; it must never be created in browser code. */
export function supabaseJourneyStore(admin: SupabaseClient): JourneyStore {
  return {
    async get(journeyId) {
      const { data, error } = await admin.from("journeys").select("stage, missed").eq("id", journeyId).maybeSingle();
      if (error) throw error;
      return data ? { stage: data.stage as Stage, missed: data.missed as boolean } : null;
    },
    async apply(req) {
      const { data, error } = await admin.rpc("apply_journey_event", {
        p_journey: req.journeyId,
        p_event: req.event,
        p_expected_stage: req.expected.stage,
        p_expected_missed: req.expected.missed,
        p_to_stage: req.next.stage,
        p_to_missed: req.next.missed,
        p_actor: req.actor.role === "patient" ? null : req.actor.id,
        p_actor_role: req.actor.role,
        p_detail: req.detail,
        p_next_step: req.nextStep,
        p_decline_reason: req.declineReason,
        p_booking: req.effects.booking
          ? {
              partner_id: req.effects.booking.partnerId,
              slot_id: req.effects.booking.slotId,
              kind: req.effects.booking.kind,
              slot_label: req.effects.booking.slotLabel,
            }
          : null,
        p_report: req.effects.report
          ? {
              kind: req.effects.report.kind,
              partner_id: req.effects.report.partnerId,
              storage_path: req.effects.report.storagePath,
              file_name: req.effects.report.fileName,
              lab_values: req.effects.report.labValues ?? null,
            }
          : null,
        p_next_task: req.nextTask,
        p_review: req.effects.review
          ? { fib4_text: req.effects.review.fib4Text, summary: req.effects.review.summary, recommends_vcte: req.effects.review.recommendsVcte }
          : null,
      });
      if (error) {
        if (error.code === "40001") throw new StaleJourneyError();
        if (error.code === "23505") throw new SlotTakenError();
        throw error;
      }
      return { eventId: data as number };
    },
  };
}
