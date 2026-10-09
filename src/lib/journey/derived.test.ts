import { describe, expect, it } from "vitest";
import { kindFor, nextAction, statusOf } from "./derived";
import { STAGE } from "./stages";

describe("statusOf", () => {
  it("matches the prototype", () => {
    expect(statusOf({ stage: STAGE.COMPLETE, missed: false }).label).toBe("Completed");
    expect(statusOf({ stage: STAGE.DECLINED, missed: false }).label).toBe("Not approved");
    expect(statusOf({ stage: STAGE.LAB_BOOKED, missed: true })).toEqual({ label: "Missed", tone: "bad" });
    expect(statusOf({ stage: STAGE.ORDERED, missed: false }).label).toBe("Pending");
    expect(statusOf({ stage: STAGE.VCTE_BOOKED, missed: false }).label).toBe("Booked");
    expect(statusOf({ stage: STAGE.REVIEWED, missed: false }).label).toBe("Awaiting doctor");
    expect(statusOf({ stage: STAGE.REPORT_IN, missed: false }).label).toBe("Received");
  });
});

describe("nextAction", () => {
  it("names who acts next at every open stage and none at the end", () => {
    expect(nextAction({ stage: STAGE.REPORT_IN, missed: false })).toEqual({
      who: "Clinician",
      what: "Review and write the summary",
    });
    expect(nextAction({ stage: STAGE.COMPLETE, missed: false })).toBeNull();
    expect(nextAction({ stage: STAGE.DECLINED, missed: false })).toBeNull();
    expect(nextAction({ stage: STAGE.VCTE_BOOKED, missed: true })?.who).toBe("Patient");
  });
});

describe("kindFor", () => {
  it("picks the partner kind from the stage and next step", () => {
    expect(kindFor({ stage: STAGE.ORDERED, missed: false }, null)).toBe("lab");
    expect(kindFor({ stage: STAGE.VCTE_LINK, missed: false }, null)).toBe("centre");
    expect(kindFor({ stage: STAGE.NEXT_LINK, missed: false }, "eval")).toBe("eval");
    expect(kindFor({ stage: STAGE.NEXT_LINK, missed: false }, "specialist")).toBe("specialist");
    expect(kindFor({ stage: STAGE.NEXT_BOOKED, missed: false }, "routine")).toBe("routine");
  });
});
