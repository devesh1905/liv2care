import { describe, expect, it } from "vitest";
import { actorLabel, dueText, eventLabel, maskLinks, percent } from "./format";

describe("maskLinks", () => {
  it("hides the private part of booking and progress links", () => {
    const body = "Tap to book: https://liv2care.vercel.app/book/hVHan6h7S37L6lySu_YpB6H2I6_XRBIY\nTrack: https://x.example/patient/AbCdEfGh12345678AbCdEfGh12345678";
    const masked = maskLinks(body);
    expect(masked).toContain("https://liv2care.vercel.app/book/••••••••");
    expect(masked).toContain("https://x.example/patient/••••••••");
    expect(masked).not.toContain("hVHan6h7");
    expect(masked).not.toContain("AbCdEfGh");
  });

  it("leaves other text alone", () => {
    expect(maskLinks("Booking confirmed: Sunrise, Sun 11 Oct, 9:00 am.")).toBe("Booking confirmed: Sunrise, Sun 11 Oct, 9:00 am.");
  });
});

describe("eventLabel and actorLabel", () => {
  it("name the known events and humanise the unknown ones", () => {
    expect(eventLabel("LAB_UPLOAD")).toBe("Lab report uploaded");
    expect(eventLabel("RESCHEDULE_OFFER_SENT")).toBe("New time offered to the patient");
    expect(eventLabel("SOMETHING_NEW")).toBe("Something new");
    expect(actorLabel("ops")).toBe("Operations");
    expect(actorLabel("stranger")).toBe("stranger");
  });
});

describe("dueText", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  it("says how late or how soon", () => {
    expect(dueText("2026-10-20T09:00:00Z", now)).toEqual({ text: "3 h overdue", overdue: true });
    expect(dueText("2026-10-17T12:00:00Z", now)).toEqual({ text: "3 d overdue", overdue: true });
    expect(dueText("2026-10-20T17:00:00Z", now)).toEqual({ text: "due in 5 h", overdue: false });
    expect(dueText("2026-10-20T11:59:30Z", now).overdue).toBe(true);
  });
});

describe("percent", () => {
  it("rounds and never divides by zero", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(0);
  });
});
