import { describe, expect, it } from "vitest";
import { visitActions } from "./partnerActions";
import { STAGE } from "./stages";

describe("visitActions", () => {
  it("a lab uploads at LAB_BOOKED only", () => {
    expect(visitActions({ stage: STAGE.LAB_BOOKED, missed: false }, "lab")).toEqual({
      uploadReport: true,
      markAttended: false,
      markMissed: true,
      waitingForPatient: false,
    });
    expect(visitActions({ stage: STAGE.VCTE_BOOKED, missed: false }, "lab").uploadReport).toBe(false);
  });

  it("a centre uploads at VCTE_BOOKED only", () => {
    expect(visitActions({ stage: STAGE.VCTE_BOOKED, missed: false }, "centre").uploadReport).toBe(true);
    expect(visitActions({ stage: STAGE.LAB_BOOKED, missed: false }, "centre").uploadReport).toBe(false);
  });

  it("a follow-up visit is marked attended", () => {
    expect(visitActions({ stage: STAGE.NEXT_BOOKED, missed: false }, "centre")).toMatchObject({ markAttended: true, markMissed: true });
  });

  it("a missed visit offers nothing until the patient reschedules", () => {
    expect(visitActions({ stage: STAGE.LAB_BOOKED, missed: true }, "lab")).toEqual({
      uploadReport: false,
      markAttended: false,
      markMissed: false,
      waitingForPatient: true,
    });
  });
});
