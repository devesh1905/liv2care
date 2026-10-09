/**
 * Pathway stages, ported from the prototype (prototype/index.html, ST / STAGE_LABEL / DONE).
 * Phase 1 builds the state machine and database on top of these.
 */
export const STAGE = {
  ORDERED: 0,
  LAB_BOOKED: 1,
  REPORT_IN: 2,
  REVIEWED: 3,
  VCTE_LINK: 4,
  VCTE_BOOKED: 5,
  VCTE_REPORT: 6,
  NEXT_LINK: 7,
  NEXT_BOOKED: 8,
  COMPLETE: 9,
  DECLINED: 10,
} as const;

export type Stage = (typeof STAGE)[keyof typeof STAGE];

export const STAGE_LABEL: Record<Stage, string> = {
  [STAGE.ORDERED]: "Tests ordered",
  [STAGE.LAB_BOOKED]: "Lab booked",
  [STAGE.REPORT_IN]: "Lab report received",
  [STAGE.REVIEWED]: "Clinician reviewed",
  [STAGE.VCTE_LINK]: "FibroScan approved",
  [STAGE.VCTE_BOOKED]: "FibroScan booked",
  [STAGE.VCTE_REPORT]: "FibroScan report received",
  [STAGE.NEXT_LINK]: "Next step approved",
  [STAGE.NEXT_BOOKED]: "Follow-up booked",
  [STAGE.COMPLETE]: "Journey complete",
  [STAGE.DECLINED]: "FibroScan not approved",
};

/** The nine milestones shown on the patient timeline. */
export const MILESTONES = [
  "Tests ordered",
  "Lab booked",
  "Lab report received",
  "Clinician review",
  "Doctor decision",
  "FibroScan booked",
  "FibroScan report",
  "Next step booked",
  "Journey complete",
] as const;

/** How many milestones are done at each stage (index = stage). */
export const MILESTONES_DONE: Record<Stage, number> = {
  [STAGE.ORDERED]: 1,
  [STAGE.LAB_BOOKED]: 2,
  [STAGE.REPORT_IN]: 3,
  [STAGE.REVIEWED]: 4,
  [STAGE.VCTE_LINK]: 5,
  [STAGE.VCTE_BOOKED]: 6,
  [STAGE.VCTE_REPORT]: 7,
  [STAGE.NEXT_LINK]: 7,
  [STAGE.NEXT_BOOKED]: 8,
  [STAGE.COMPLETE]: 9,
  [STAGE.DECLINED]: 5,
};
