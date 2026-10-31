import { MILESTONES, MILESTONES_DONE, STAGE, type Stage } from "./stages";
import type { JourneyState } from "./types";

export type StepStatus = "done" | "current" | "upcoming";

export type TimelineStep = { index: number; status: StepStatus };

/**
 * The nine steps of the patient's journey and where they are. Complete shows every step done. When FibroScan is not
 * approved the journey stops after the doctor's decision and no step is marked as current.
 */
export function timelineSteps(stage: Stage): TimelineStep[] {
  const done = stage === STAGE.COMPLETE ? MILESTONES.length : MILESTONES_DONE[stage];
  const held = stage === STAGE.DECLINED;
  return MILESTONES.map((_, index) => ({
    index,
    status: index < done ? "done" : index === done && !held && stage !== STAGE.COMPLETE ? "current" : "upcoming",
  }));
}

/** Translation keys for the "what happens next" text and who acts (see src/lib/i18n/patient.ts). */
export type NextTextKey =
  | "nextUpload"
  | "nextBookLab"
  | "nextLabVisit"
  | "nextClinician"
  | "nextDoctor"
  | "nextBookScan"
  | "nextScanVisit"
  | "nextDoctorScan"
  | "nextBookFollow"
  | "nextAttend"
  | "nextDone"
  | "nextHeld"
  | "nextMissed";

export type WhoKey = "whoYou" | "whoLab" | "whoClinician" | "whoDoctor" | "whoCentre" | "whoClinic";

const NEXT: Record<Stage, { text: NextTextKey; who: WhoKey | null }> = {
  [STAGE.ORDERED]: { text: "nextBookLab", who: "whoYou" },
  [STAGE.LAB_BOOKED]: { text: "nextLabVisit", who: "whoYou" },
  [STAGE.REPORT_IN]: { text: "nextClinician", who: "whoClinician" },
  [STAGE.REVIEWED]: { text: "nextDoctor", who: "whoDoctor" },
  [STAGE.VCTE_LINK]: { text: "nextBookScan", who: "whoYou" },
  [STAGE.VCTE_BOOKED]: { text: "nextScanVisit", who: "whoYou" },
  [STAGE.VCTE_REPORT]: { text: "nextClinician", who: "whoClinician" },
  [STAGE.VCTE_REVIEWED]: { text: "nextDoctorScan", who: "whoDoctor" },
  [STAGE.NEXT_LINK]: { text: "nextBookFollow", who: "whoYou" },
  [STAGE.NEXT_BOOKED]: { text: "nextAttend", who: "whoYou" },
  [STAGE.COMPLETE]: { text: "nextDone", who: null },
  [STAGE.DECLINED]: { text: "nextHeld", who: "whoDoctor" },
};

/** What the patient should know is happening next, in words they can follow. Logistics only. */
export function nextForPatient({ stage, missed, awaitingReport }: JourneyState): { text: NextTextKey; who: WhoKey | null } {
  if (awaitingReport && stage === STAGE.ORDERED) return { text: "nextUpload", who: "whoYou" };
  if (missed && stage !== STAGE.COMPLETE && stage !== STAGE.DECLINED) return { text: "nextMissed", who: "whoYou" };
  return NEXT[stage];
}
