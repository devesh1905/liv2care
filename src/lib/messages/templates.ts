/**
 * English message templates (mocked sending). Logistics only: never a lab value, score or clinical text.
 * Hindi and the regional language arrive with Kanya's content/messages.md.
 */
export const templates = {
  testsOrdered: (url: string, ultrasound: boolean) =>
    `Your doctor has requested some blood tests${ultrasound ? " and an ultrasound" : ""}. Tap to book an appointment at a nearby lab: ${url}`,
  fibroscanApproved: (url: string) =>
    `Your doctor has recommended a FibroScan. Tap to book at a nearby diagnostic centre: ${url}`,
  furtherEvaluation: (url: string) => `Your doctor has ordered an additional investigation. Tap to book: ${url}`,
  specialistReferral: (url: string) => `Your doctor has referred you to a specialist. Tap to book: ${url}`,
  routineFollowUp: (months: number) =>
    `Your follow-up appointment is scheduled in ${months} months. We will remind you before the date.`,
  missed: (url: string) => `You missed your appointment. Tap to choose a new time: ${url}`,
  bookingConfirmed: (place: string, slot: string) =>
    `Booking confirmed: ${place}, ${slot}. We will remind you the day before.`,
  rescheduled: (place: string, slot: string) => `Rescheduled: ${place}, ${slot}.`,
  reminder: (url: string) => `Reminder: your next step is overdue. Tap to continue: ${url}`,
  existingReportUsed: () =>
    "Your doctor will use your existing lab reports, with your consent. No repeat test is needed. We will update you after the review.",
} as const;
