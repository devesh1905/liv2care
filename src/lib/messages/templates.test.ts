import { describe, expect, it } from "vitest";
import { templates } from "./templates";

describe("message templates", () => {
  const url = "https://liv2care.example/book/abc";

  it("mention the ultrasound only when ordered", () => {
    expect(templates.testsOrdered(url, true)).toContain("and an ultrasound");
    expect(templates.testsOrdered(url, false)).not.toContain("ultrasound");
    expect(templates.testsOrdered(url, false)).toContain(url);
  });

  it("add the progress page to the first message only when given", () => {
    expect(templates.testsOrdered(url, false, "https://x.example/patient/t")).toContain("Track your progress: https://x.example/patient/t");
    expect(templates.testsOrdered(url, false)).not.toContain("Track your progress");
    expect(templates.existingReportUsed("https://x.example/patient/t")).toContain("Track your progress");
  });

  it("carry the booking link", () => {
    for (const t of [templates.fibroscanApproved, templates.furtherEvaluation, templates.specialistReferral, templates.missed, templates.reminder]) {
      expect(t(url)).toContain(url);
    }
  });
});
