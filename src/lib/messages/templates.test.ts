import { describe, expect, it } from "vitest";
import { templates, templatesFor, type Templates } from "./templates";

const url = "https://liv2care.example/book/abc";
const progress = "https://liv2care.example/patient/xyz";

/** One call of every template with sample values, in the given language. */
function samples(t: Templates): string[] {
  return [
    t.testsOrdered(url, true, progress),
    t.testsOrdered(url, false),
    t.fibroscanApproved(url),
    t.furtherEvaluation(url),
    t.specialistReferral(url),
    t.routineFollowUp(12),
    t.missed(url),
    t.rescheduleOffer("Sunrise Diagnostics", "Mon 12 Oct, 9:00 am", url),
    t.bookingConfirmed("Sunrise Diagnostics", "Mon 12 Oct, 9:00 am"),
    t.rescheduled("Sunrise Diagnostics", "Mon 12 Oct, 9:00 am"),
    t.reminder(url),
    t.existingReportUsed(progress),
  ];
}

describe("message templates", () => {
  it("mention the ultrasound only when ordered", () => {
    expect(templates.testsOrdered(url, true)).toContain("and an ultrasound");
    expect(templates.testsOrdered(url, false)).not.toContain("ultrasound");
    expect(templatesFor("hi").testsOrdered(url, true)).toContain("अल्ट्रासाउंड");
    expect(templatesFor("hi").testsOrdered(url, false)).not.toContain("अल्ट्रासाउंड");
  });

  it("add the progress page to the first message only when given, in either language", () => {
    expect(templates.testsOrdered(url, false, progress)).toContain(`Track your progress: ${progress}`);
    expect(templates.testsOrdered(url, false)).not.toContain("Track your progress");
    expect(templates.existingReportUsed(progress)).toContain(progress);
    expect(templatesFor("hi").testsOrdered(url, false, progress)).toContain(progress);
    expect(templatesFor("hi").existingReportUsed()).not.toContain("http");
  });

  it("carry the booking link in every language", () => {
    for (const lang of ["en", "hi"] as const) {
      const t = templatesFor(lang);
      for (const f of [t.fibroscanApproved, t.furtherEvaluation, t.specialistReferral, t.missed, t.reminder]) {
        expect(f(url)).toContain(url);
      }
      expect(t.rescheduleOffer("Place", "Slot", url)).toContain(url);
      expect(t.bookingConfirmed("Place X", "Slot Y")).toContain("Place X");
      expect(t.bookingConfirmed("Place X", "Slot Y")).toContain("Slot Y");
      expect(t.routineFollowUp(6)).toContain("6");
    }
  });

  it("are fully translated: Hindi is in Devanagari, English has none, and the two never run out of step", () => {
    const english = samples(templatesFor("en"));
    const hindi = samples(templatesFor("hi"));
    expect(hindi).toHaveLength(english.length);
    english.forEach((text, i) => {
      expect(/[ऀ-ॿ]/.test(text), `English #${i}`).toBe(false);
      expect(/[ऀ-ॿ]/.test(hindi[i]), `Hindi #${i}`).toBe(true);
      // the same links appear in both languages
      expect(hindi[i].match(/https?:\/\/\S+/g) ?? [], `links #${i}`).toEqual(text.match(/https?:\/\/\S+/g) ?? []);
    });
  });

  it("say nothing clinical", () => {
    // whole words only: "diagnostic centre" is a place, "diagnosis" would be a clinical statement
    const clinical = /\b(fib-?4|fibrosis|cirrhosis|elastography|kpa|platelets?|ast|alt|results?|diagnosis|diagnosed|score)\b/i;
    for (const text of samples(templatesFor("en"))) expect(text).not.toMatch(clinical);
  });

  it("fall back to English for an unknown language", () => {
    expect(templatesFor("fr")).toBe(templates);
    expect(templatesFor(null)).toBe(templates);
    expect(templatesFor(undefined)).toBe(templates);
  });
});
