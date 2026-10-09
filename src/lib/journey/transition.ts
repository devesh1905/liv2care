import type { SupabaseClient } from "@supabase/supabase-js";
import { decide } from "./stateMachine";
import type { Stage } from "./stages";
import type { Actor, JourneyEvent, JourneyState, NextStepType, TransitionError } from "./types";

/**
 * The audit `detail` may carry logistics only. Clinical values, FIB-4 and summary text never go here,
 * so unknown keys are rejected rather than stored.
 */
const DETAIL_KEYS = ["partner", "slot", "reason", "step", "months", "route", "ultrasound", "report_id", "recommends_vcte"] as const;
export type EventDetail = Partial<Record<(typeof DETAIL_KEYS)[number], string | number | boolean>>;

export type ApplyRequest = {
  journeyId: string;
  event: JourneyEvent["type"];
  expected: JourneyState;
  next: JourneyState;
  actor: Actor;
  detail: EventDetail;
  nextStep: NextStepType | null;
  declineReason: string | null;
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

export type TransitionResult =
  | { ok: true; stage: Stage; missed: boolean; eventId: number }
  | { ok: false; error: TransitionError | { code: "not_found" | "stale" | "invalid_detail"; message: string } };

/** The only way a journey's stage changes (CLAUDE.md rule 3). Every call that succeeds writes an audit row (rule 4). */
export async function transition(
  store: JourneyStore,
  journeyId: string,
  event: JourneyEvent,
  actor: Actor,
  detail: EventDetail = {},
): Promise<TransitionResult> {
  const unknown = Object.keys(detail).filter((k) => !(DETAIL_KEYS as readonly string[]).includes(k));
  if (unknown.length > 0) {
    return { ok: false, error: { code: "invalid_detail", message: `Not allowed in the audit trail: ${unknown.join(", ")}` } };
  }

  const state = await store.get(journeyId);
  if (!state) return { ok: false, error: { code: "not_found", message: "Journey not found" } };

  const decision = decide(state, event, actor);
  if (!decision.ok) return decision;

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
    });
    return { ok: true, ...decision.next, eventId };
  } catch (e) {
    if (e instanceof StaleJourneyError) return { ok: false, error: { code: "stale", message: e.message } };
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
      });
      if (error) {
        if (error.code === "40001") throw new StaleJourneyError();
        throw error;
      }
      return { eventId: data as number };
    },
  };
}
