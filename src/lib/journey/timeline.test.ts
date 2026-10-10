import { describe, expect, it } from "vitest";
import { patientStrings } from "@/lib/i18n/patient";
import { STAGE, type Stage } from "./stages";
import { nextForPatient, timelineSteps } from "./timeline";

const ALL = Object.values(STAGE) as Stage[];
const statuses = (stage: Stage) => timelineSteps(stage).map((s) => s.status);

describe("timelineSteps", () => {
  it("always has nine steps", () => {
    for (const s of ALL) expect(timelineSteps(s)).toHaveLength(9);
  });

  it("marks done steps, then one current step, then upcoming steps", () => {
    expect(statuses(STAGE.ORDERED)).toEqual(["done", "current", ...Array(7).fill("upcoming")]);
    expect(statuses(STAGE.REPORT_IN)).toEqual(["done", "done", "done", "current", ...Array(5).fill("upcoming")]);
    expect(statuses(STAGE.VCTE_REPORT)).toEqual([...Array(7).fill("done"), "current", "upcoming"]);
  });

  it("shows every step done when the journey is complete, with no current step", () => {
    expect(statuses(STAGE.COMPLETE)).toEqual(Array(9).fill("done"));
  });

  it("stops after the doctor's decision when FibroScan is not approved", () => {
    expect(statuses(STAGE.DECLINED)).toEqual([...Array(5).fill("done"), ...Array(4).fill("upcoming")]);
  });

  it("never has more than one current step", () => {
    for (const s of ALL) expect(timelineSteps(s).filter((x) => x.status === "current").length).toBeLessThanOrEqual(1);
  });
});

describe("nextForPatient", () => {
  it("names who acts and has a translation in both languages for every stage", () => {
    for (const stage of ALL) {
      for (const missed of [false, true]) {
        const n = nextForPatient({ stage, missed });
        expect(patientStrings.en[n.text], n.text).toBeTruthy();
        expect(patientStrings.hi[n.text], n.text).toBeTruthy();
        if (n.who) expect(patientStrings.en[n.who]).toBeTruthy();
      }
    }
  });

  it("asks the patient to reschedule when a visit was missed", () => {
    expect(nextForPatient({ stage: STAGE.LAB_BOOKED, missed: true })).toEqual({ text: "nextMissed", who: "whoYou" });
    // a closed journey is never shown as missed
    expect(nextForPatient({ stage: STAGE.COMPLETE, missed: true }).text).toBe("nextDone");
  });

  it("says nothing clinical", () => {
    const words = ["FIB-4", "fibrosis", "cirrhosis", "elastography", "kPa", "platelet", "AST", "ALT", "stage"];
    for (const stage of ALL) {
      const text = patientStrings.en[nextForPatient({ stage, missed: false }).text];
      for (const w of words) expect(text.toLowerCase(), `${stage}: ${w}`).not.toContain(w.toLowerCase());
    }
  });
});
