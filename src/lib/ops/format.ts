/**
 * Display helpers for the operations screen. Pure, so they can be tested without a database.
 */

/** Booking and progress links in a message are private. Operations sees them shortened, never in full. */
export function maskLinks(body: string): string {
  return body.replace(/(\/(?:book|patient)\/)[A-Za-z0-9_-]{8,}/g, (_m, prefix: string) => `${prefix}••••••••`);
}

/** Plain names for audit events. Unknown events fall back to a readable form of the code. */
const EVENT_LABEL: Record<string, string> = {
  JOURNEY_STARTED: "Patient enrolled",
  EXISTING_REPORT_UPLOADED: "Existing lab report uploaded",
  BOOK: "Appointment booked",
  RESCHEDULE: "Appointment rescheduled",
  MARK_MISSED: "Visit marked missed",
  MARK_ATTENDED: "Visit marked attended",
  LAB_UPLOAD: "Lab report uploaded",
  CENTRE_UPLOAD: "FibroScan report uploaded",
  REPORT_ACCESSED: "Report opened",
  CLINICIAN_SUBMIT: "Clinician review sent",
  APPROVE_VCTE: "FibroScan approved",
  DECLINE_VCTE: "FibroScan not approved",
  REQUEST_REREVIEW: "Re-review requested",
  CHOOSE_NEXT_STEP: "Next step chosen",
  SEND_REMINDER: "Reminder sent",
  RESCHEDULE_OFFER_SENT: "New time offered to the patient",
};

export function eventLabel(event: string): string {
  return EVENT_LABEL[event] ?? event.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const ROLE_LABEL: Record<string, string> = {
  doctor: "Doctor",
  clinician: "Clinician",
  lab: "Lab",
  centre: "Centre",
  ops: "Operations",
  patient: "Patient",
};

export const actorLabel = (role: string) => ROLE_LABEL[role] ?? role;

/** "3 h overdue", "2 d overdue", "due in 5 h". `now` is passed in so the result is testable. */
export function dueText(dueAt: string, now: number): { text: string; overdue: boolean } {
  const diffMs = new Date(dueAt).getTime() - now;
  const abs = Math.round(Math.abs(diffMs) / 60000);
  const span = abs < 60 ? `${Math.max(abs, 1)} min` : abs < 48 * 60 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} d`;
  return diffMs < 0 ? { text: `${span} overdue`, overdue: true } : { text: `due in ${span}`, overdue: false };
}

/** Percentage with no decimals; 0 when there is nothing to divide by. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
