/**
 * English message templates (mocked sending). Logistics only: never a lab value, score or clinical text.
 * Hindi and the regional language arrive with Kanya's content/messages.md.
 */
const link = (code: string) => `liv2care.demo/b/${code.toLowerCase()}`;

export const templates = {
  testsOrdered: (code: string, ultrasound: boolean) =>
    `Your doctor has requested some blood tests${ultrasound ? " and an ultrasound" : ""}. Tap to book an appointment at a nearby lab: ${link(code)}`,
  missed: (code: string) => `You missed your appointment. Tap to choose a new time: ${link(code)}`,
  existingReportUsed: () =>
    "Your doctor will use your existing lab reports, with your consent. No repeat test is needed. We will update you after the review.",
} as const;
