import type { Stage } from "./stages";

/** Staff roles are database roles (profiles.role); the patient acts through a booking link. */
export type Role = "doctor" | "clinician" | "lab" | "centre" | "ops" | "patient";

export type Actor = { id: string; role: Role };

export type NextStepType = "routine" | "eval" | "specialist";

/** What the state machine needs to know about a journey. No clinical values. */
export type JourneyState = {
  stage: Stage;
  missed: boolean;
};

/** Preset reasons the doctor picks from when declining FibroScan (clinician-reviewed wording comes later). */
export const DECLINE_REASONS = [
  "Patient declined",
  "Not clinically required now",
  "Will re-assess at next visit",
  "Cost or access",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export type JourneyEvent =
  | { type: "BOOK" }
  | { type: "MARK_MISSED" }
  | { type: "RESCHEDULE" }
  | { type: "LAB_UPLOAD" }
  | { type: "CLINICIAN_SUBMIT"; summaryWritten: boolean }
  | { type: "APPROVE_VCTE" }
  | { type: "DECLINE_VCTE"; reason: string }
  | { type: "REQUEST_REREVIEW" }
  | { type: "CENTRE_UPLOAD" }
  | { type: "CHOOSE_NEXT_STEP"; step: NextStepType }
  | { type: "MARK_ATTENDED" }
  | { type: "SEND_REMINDER" };

export type JourneyEventType = JourneyEvent["type"];

/** A rejected transition. `code` is stable for tests and UI; `message` is for humans. */
export type TransitionError = {
  code: "wrong_stage" | "wrong_role" | "invalid_payload" | "missed_state" | "terminal";
  message: string;
};

export type Decision =
  | { ok: true; next: JourneyState; changesStage: boolean }
  | { ok: false; error: TransitionError };
