import { STAGE } from "./stages";
import type { JourneyState, NextStepType } from "./types";

export type StatusTone = "ok" | "warn" | "info" | "bad";
export type Status = { label: string; tone: StatusTone };

/** Status pill for a journey (prototype statusOf). */
export function statusOf({ stage, missed }: JourneyState): Status {
  if (stage === STAGE.COMPLETE) return { label: "Completed", tone: "ok" };
  if (stage === STAGE.DECLINED) return { label: "Not approved", tone: "warn" };
  if (missed) return { label: "Missed", tone: "bad" };
  switch (stage) {
    case STAGE.ORDERED:
    case STAGE.VCTE_LINK:
    case STAGE.NEXT_LINK:
      return { label: "Pending", tone: "warn" };
    case STAGE.LAB_BOOKED:
    case STAGE.VCTE_BOOKED:
    case STAGE.NEXT_BOOKED:
      return { label: "Booked", tone: "info" };
    case STAGE.REVIEWED:
      return { label: "Awaiting doctor", tone: "warn" };
    default:
      return { label: "Received", tone: "ok" };
  }
}

export type NextAction = {
  who: "Patient" | "Lab" | "Clinician" | "Doctor" | "Centre" | "Clinic";
  what: string;
};

const NEXT_BY_STAGE: Record<number, NextAction | null> = {
  [STAGE.ORDERED]: { who: "Patient", what: "Book the lab" },
  [STAGE.LAB_BOOKED]: { who: "Lab", what: "Upload the report" },
  [STAGE.REPORT_IN]: { who: "Clinician", what: "Review and write the summary" },
  [STAGE.REVIEWED]: { who: "Doctor", what: "Decide on FibroScan" },
  [STAGE.VCTE_LINK]: { who: "Patient", what: "Book FibroScan" },
  [STAGE.VCTE_BOOKED]: { who: "Centre", what: "Upload the FibroScan report" },
  [STAGE.VCTE_REPORT]: { who: "Doctor", what: "Review report and pick the next step" },
  [STAGE.NEXT_LINK]: { who: "Patient", what: "Book the appointment" },
  [STAGE.NEXT_BOOKED]: { who: "Clinic", what: "Mark the visit attended" },
  [STAGE.COMPLETE]: null,
  [STAGE.DECLINED]: null,
};

/** Who has to act next (prototype nextRaw). A missed visit sends the ball back to the patient. */
export function nextAction({ stage, missed }: JourneyState): NextAction | null {
  if (missed) return { who: "Patient", what: "Reschedule the missed appointment" };
  return NEXT_BY_STAGE[stage] ?? null;
}

export type PartnerKind = "lab" | "centre" | "eval" | "specialist" | "routine";

/** Which kind of partner the patient is choosing from (prototype kindFor). */
export function kindFor(state: JourneyState, nextStep: NextStepType | null): PartnerKind {
  if (state.stage <= STAGE.LAB_BOOKED) return "lab";
  if (state.stage === STAGE.VCTE_LINK || state.stage === STAGE.VCTE_BOOKED) return "centre";
  if (nextStep === "eval") return "eval";
  if (nextStep === "specialist") return "specialist";
  return "routine";
}
