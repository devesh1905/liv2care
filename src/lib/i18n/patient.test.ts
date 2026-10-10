import { describe, expect, it } from "vitest";
import { patientStrings, t, type PatientKey } from "./patient";

describe("patient strings", () => {
  it("have the same keys and the same placeholders in English and Hindi", () => {
    const keys = Object.keys(patientStrings.en) as PatientKey[];
    expect(Object.keys(patientStrings.hi).sort()).toEqual([...keys].sort());
    for (const k of keys) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(patientStrings.hi[k]), k).toEqual(ph(patientStrings.en[k]));
      expect(patientStrings.hi[k].trim(), k).not.toBe("");
    }
  });

  it("fill placeholders", () => {
    expect(t("en", "seeYou", { place: "Sunrise", slot: "Sat 24 Oct, 9:00 am" })).toBe(
      "See you at Sunrise on Sat 24 Oct, 9:00 am. We will remind you the day before.",
    );
    expect(t("hi", "seeYou", { place: "Sunrise", slot: "X" })).toContain("Sunrise");
  });
});
