import { decide } from "./stateMachine";
import type { JourneyState } from "./types";

export type PartnerRole = "lab" | "centre";

export type VisitActions = {
  uploadReport: boolean;
  markAttended: boolean;
  markMissed: boolean;
  /** The visit was missed; nothing to do until the patient reschedules. */
  waitingForPatient: boolean;
};

/** Which buttons a lab or centre sees for a booked visit. Derived from the state machine so the two cannot drift apart. */
export function visitActions(state: JourneyState, role: PartnerRole): VisitActions {
  const actor = { id: "x", role } as const;
  const uploadEvent = role === "lab" ? "LAB_UPLOAD" : "CENTRE_UPLOAD";
  return {
    uploadReport: decide(state, { type: uploadEvent }, actor).ok,
    markAttended: decide(state, { type: "MARK_ATTENDED" }, actor).ok,
    markMissed: decide(state, { type: "MARK_MISSED" }, actor).ok,
    waitingForPatient: state.missed,
  };
}
