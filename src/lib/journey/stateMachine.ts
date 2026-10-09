import { STAGE, type Stage } from "./stages";
import {
  DECLINE_REASONS,
  type Actor,
  type Decision,
  type JourneyEvent,
  type JourneyState,
  type Role,
} from "./types";

/**
 * Pure pathway rules, ported from the prototype actions (A.* in prototype/index.html).
 * This module decides; `transition()` is the only code that persists the result.
 * Roles are also enforced by database policies. The check here is defence in depth.
 */

const BOOKED: readonly Stage[] = [STAGE.LAB_BOOKED, STAGE.VCTE_BOOKED, STAGE.NEXT_BOOKED];

const ALL: readonly Stage[] = Object.values(STAGE);
const OPEN = ALL.filter((s) => s !== STAGE.COMPLETE && s !== STAGE.DECLINED);

type Rule = {
  roles: readonly Role[];
  from: readonly Stage[];
  /** Fixed target stage, or a function when the target depends on the event. */
  to: Stage | ((state: JourneyState, event: JourneyEvent) => Stage);
  /** Extra validation of the event payload. Returns an error message or null. */
  check?: (event: JourneyEvent) => string | null;
};

const RULES: { [K in JourneyEvent["type"]]: Rule } = {
  BOOK: {
    roles: ["patient", "ops"],
    from: [STAGE.ORDERED, STAGE.VCTE_LINK, STAGE.NEXT_LINK],
    to: (s) => (s.stage + 1) as Stage,
  },
  MARK_MISSED: { roles: ["ops", "lab", "centre"], from: BOOKED, to: (s) => s.stage },
  RESCHEDULE: { roles: ["patient", "ops"], from: BOOKED, to: (s) => s.stage },
  LAB_UPLOAD: { roles: ["lab"], from: [STAGE.LAB_BOOKED], to: STAGE.REPORT_IN },
  CLINICIAN_SUBMIT: {
    roles: ["clinician"],
    from: [STAGE.REPORT_IN],
    to: STAGE.REVIEWED,
    check: (e) => (e.type === "CLINICIAN_SUBMIT" && !e.summaryWritten ? "The clinical summary is required" : null),
  },
  APPROVE_VCTE: { roles: ["doctor"], from: [STAGE.REVIEWED], to: STAGE.VCTE_LINK },
  DECLINE_VCTE: {
    roles: ["doctor"],
    from: [STAGE.REVIEWED],
    to: STAGE.DECLINED,
    check: (e) =>
      e.type === "DECLINE_VCTE" && !(DECLINE_REASONS as readonly string[]).includes(e.reason)
        ? "Pick one of the preset decline reasons"
        : null,
  },
  REQUEST_REREVIEW: { roles: ["doctor"], from: [STAGE.REVIEWED], to: STAGE.REPORT_IN },
  CENTRE_UPLOAD: { roles: ["centre"], from: [STAGE.VCTE_BOOKED], to: STAGE.VCTE_REPORT },
  CHOOSE_NEXT_STEP: {
    roles: ["doctor"],
    from: [STAGE.VCTE_REPORT],
    // Routine follow-up is scheduled by the platform straight away; the other two need the patient to book.
    to: (_s, e) => (e.type === "CHOOSE_NEXT_STEP" && e.step === "routine" ? STAGE.NEXT_BOOKED : STAGE.NEXT_LINK),
    check: (e) =>
      e.type === "CHOOSE_NEXT_STEP" && !["routine", "eval", "specialist"].includes(e.step)
        ? "Unknown next step"
        : null,
  },
  MARK_ATTENDED: { roles: ["lab", "centre"], from: [STAGE.NEXT_BOOKED], to: STAGE.COMPLETE },
  SEND_REMINDER: { roles: ["ops"], from: OPEN, to: (s) => s.stage },
};

/** Decide what an event does to a journey. Never throws and never touches storage. */
export function decide(state: JourneyState, event: JourneyEvent, actor: Actor): Decision {
  const rule = RULES[event.type];
  if (!rule) return fail("invalid_payload", `Unknown event ${(event as { type: string }).type}`);

  if (state.stage === STAGE.COMPLETE || state.stage === STAGE.DECLINED) {
    return fail("terminal", "This journey is closed");
  }
  if (!rule.roles.includes(actor.role)) {
    return fail("wrong_role", `${actor.role} cannot do ${event.type}`);
  }
  if (!rule.from.includes(state.stage)) {
    return fail("wrong_stage", `${event.type} is not allowed at stage ${state.stage}`);
  }

  // A missed appointment must be rescheduled before anything else moves.
  if (event.type === "RESCHEDULE" && !state.missed) {
    return fail("missed_state", "Nothing to reschedule");
  }
  if (event.type === "MARK_MISSED" && state.missed) {
    return fail("missed_state", "Already marked as missed");
  }
  if (state.missed && event.type !== "RESCHEDULE" && event.type !== "SEND_REMINDER") {
    return fail("missed_state", "Reschedule the missed appointment first");
  }

  const problem = rule.check?.(event) ?? null;
  if (problem) return fail("invalid_payload", problem);

  const stage = typeof rule.to === "function" ? rule.to(state, event) : rule.to;
  const missed =
    event.type === "MARK_MISSED" ? true : event.type === "RESCHEDULE" ? false : state.missed;
  return { ok: true, next: { stage, missed }, changesStage: stage !== state.stage };
}

function fail(code: Extract<Decision, { ok: false }>["error"]["code"], message: string): Decision {
  return { ok: false, error: { code, message } };
}

export type StartRoute = "order_tests" | "existing_report";

/** The two ways in. Only the treating doctor starts a journey. */
export function decideStart(route: StartRoute, actor: Actor): Decision {
  if (actor.role !== "doctor") return fail("wrong_role", `${actor.role} cannot start a journey`);
  const stage = route === "existing_report" ? STAGE.REPORT_IN : STAGE.ORDERED;
  return { ok: true, next: { stage, missed: false }, changesStage: true };
}
