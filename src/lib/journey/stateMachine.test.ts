import { describe, expect, it } from "vitest";
import { decide, decideStart } from "./stateMachine";
import { STAGE, type Stage } from "./stages";
import type { Actor, JourneyEvent, JourneyState, Role } from "./types";

const actor = (role: Role): Actor => ({ id: `u-${role}`, role });
const at = (stage: Stage, missed = false): JourneyState => ({ stage, missed });
const ALL_STAGES = Object.values(STAGE) as Stage[];

type Case = { event: JourneyEvent; role: Role; from: Stage; to: Stage };

/** Every allowed stage change in the pathway. */
const ALLOWED: Case[] = [
  { event: { type: "BOOK" }, role: "patient", from: STAGE.ORDERED, to: STAGE.LAB_BOOKED },
  { event: { type: "LAB_UPLOAD" }, role: "lab", from: STAGE.LAB_BOOKED, to: STAGE.REPORT_IN },
  { event: { type: "CLINICIAN_SUBMIT", summaryWritten: true }, role: "clinician", from: STAGE.REPORT_IN, to: STAGE.REVIEWED },
  { event: { type: "APPROVE_VCTE" }, role: "doctor", from: STAGE.REVIEWED, to: STAGE.VCTE_LINK },
  { event: { type: "DECLINE_VCTE", reason: "Cost or access" }, role: "doctor", from: STAGE.REVIEWED, to: STAGE.DECLINED },
  { event: { type: "REQUEST_REREVIEW" }, role: "doctor", from: STAGE.REVIEWED, to: STAGE.REPORT_IN },
  { event: { type: "BOOK" }, role: "patient", from: STAGE.VCTE_LINK, to: STAGE.VCTE_BOOKED },
  { event: { type: "CENTRE_UPLOAD" }, role: "centre", from: STAGE.VCTE_BOOKED, to: STAGE.VCTE_REPORT },
  { event: { type: "CHOOSE_NEXT_STEP", step: "routine" }, role: "doctor", from: STAGE.VCTE_REPORT, to: STAGE.NEXT_BOOKED },
  { event: { type: "CHOOSE_NEXT_STEP", step: "eval" }, role: "doctor", from: STAGE.VCTE_REPORT, to: STAGE.NEXT_LINK },
  { event: { type: "CHOOSE_NEXT_STEP", step: "specialist" }, role: "doctor", from: STAGE.VCTE_REPORT, to: STAGE.NEXT_LINK },
  { event: { type: "BOOK" }, role: "patient", from: STAGE.NEXT_LINK, to: STAGE.NEXT_BOOKED },
  { event: { type: "MARK_ATTENDED" }, role: "lab", from: STAGE.NEXT_BOOKED, to: STAGE.COMPLETE },
];

describe("allowed transitions", () => {
  it.each(ALLOWED)("$event.type by $role: stage $from -> $to", ({ event, role, from, to }) => {
    const d = decide(at(from), event, actor(role));
    expect(d).toMatchObject({ ok: true, next: { stage: to, missed: false }, changesStage: true });
  });

  it("a non-stage event leaves the stage alone", () => {
    expect(decide(at(STAGE.LAB_BOOKED), { type: "SEND_REMINDER" }, actor("ops"))).toMatchObject({
      ok: true,
      changesStage: false,
      next: { stage: STAGE.LAB_BOOKED },
    });
  });
});

describe("disallowed transitions", () => {
  it("rejects every role and stage combination that is not in the allowed table", () => {
    const events: JourneyEvent[] = [
      { type: "BOOK" },
      { type: "LAB_UPLOAD" },
      { type: "CLINICIAN_SUBMIT", summaryWritten: true },
      { type: "APPROVE_VCTE" },
      { type: "DECLINE_VCTE", reason: "Cost or access" },
      { type: "REQUEST_REREVIEW" },
      { type: "CENTRE_UPLOAD" },
      { type: "CHOOSE_NEXT_STEP", step: "routine" },
      { type: "MARK_ATTENDED" },
    ];
    const roles: Role[] = ["doctor", "clinician", "lab", "centre", "ops", "patient"];
    const bookable: Stage[] = [STAGE.ORDERED, STAGE.VCTE_LINK, STAGE.NEXT_LINK];
    for (const event of events) {
      for (const role of roles) {
        for (const from of ALL_STAGES) {
          const listed = ALLOWED.some((c) => c.event.type === event.type && c.role === role && c.from === from);
          // ops may book for the patient (family-assisted booking)
          const opsBooks = event.type === "BOOK" && role === "ops" && bookable.includes(from);
          // a centre, the doctor's clinic and operations can mark a follow-up visit attended as well as a lab
          const centreAttends = event.type === "MARK_ATTENDED" && ["centre", "doctor", "ops"].includes(role) && from === STAGE.NEXT_BOOKED;
          const d = decide(at(from), event, actor(role));
          expect(d.ok, `${event.type} ${role} @${from}`).toBe(listed || opsBooks || centreAttends);
        }
      }
    }
  });

  it("closed journeys accept nothing", () => {
    for (const s of [STAGE.COMPLETE, STAGE.DECLINED]) {
      expect(decide(at(s), { type: "SEND_REMINDER" }, actor("ops"))).toMatchObject({ ok: false, error: { code: "terminal" } });
    }
  });

  it("reports the reason: wrong role versus wrong stage", () => {
    expect(decide(at(STAGE.REVIEWED), { type: "APPROVE_VCTE" }, actor("clinician"))).toMatchObject({ error: { code: "wrong_role" } });
    expect(decide(at(STAGE.ORDERED), { type: "APPROVE_VCTE" }, actor("doctor"))).toMatchObject({ error: { code: "wrong_stage" } });
  });

  it("requires a written summary and a preset decline reason", () => {
    expect(decide(at(STAGE.REPORT_IN), { type: "CLINICIAN_SUBMIT", summaryWritten: false }, actor("clinician"))).toMatchObject({
      error: { code: "invalid_payload" },
    });
    expect(decide(at(STAGE.REVIEWED), { type: "DECLINE_VCTE", reason: "free text" }, actor("doctor"))).toMatchObject({
      error: { code: "invalid_payload" },
    });
  });
});

describe("missed appointments", () => {
  it("can be marked on a booked stage only, once", () => {
    for (const s of [STAGE.LAB_BOOKED, STAGE.VCTE_BOOKED, STAGE.NEXT_BOOKED]) {
      expect(decide(at(s), { type: "MARK_MISSED" }, actor("ops"))).toMatchObject({
        ok: true,
        next: { stage: s, missed: true },
        changesStage: false,
      });
      expect(decide(at(s, true), { type: "MARK_MISSED" }, actor("ops")).ok).toBe(false);
    }
    expect(decide(at(STAGE.ORDERED), { type: "MARK_MISSED" }, actor("ops")).ok).toBe(false);
  });

  it("blocks progress until rescheduled, then clears the flag at the same stage", () => {
    expect(decide(at(STAGE.LAB_BOOKED, true), { type: "LAB_UPLOAD" }, actor("lab"))).toMatchObject({ error: { code: "missed_state" } });
    expect(decide(at(STAGE.LAB_BOOKED, true), { type: "RESCHEDULE" }, actor("patient"))).toMatchObject({
      ok: true,
      next: { stage: STAGE.LAB_BOOKED, missed: false },
      changesStage: false,
    });
    expect(decide(at(STAGE.LAB_BOOKED), { type: "RESCHEDULE" }, actor("patient"))).toMatchObject({ error: { code: "missed_state" } });
  });

  it("reminders still work for a missed journey", () => {
    expect(decide(at(STAGE.VCTE_BOOKED, true), { type: "SEND_REMINDER" }, actor("ops")).ok).toBe(true);
  });
});

describe("starting a journey", () => {
  it("the doctor picks Option 1 (existing report) or Option 2 (order tests)", () => {
    expect(decideStart("existing_report", actor("doctor"))).toMatchObject({ ok: true, next: { stage: STAGE.REPORT_IN } });
    expect(decideStart("order_tests", actor("doctor"))).toMatchObject({ ok: true, next: { stage: STAGE.ORDERED } });
  });

  it("nobody else can", () => {
    for (const r of ["clinician", "lab", "centre", "ops", "patient"] as Role[]) {
      expect(decideStart("order_tests", actor(r))).toMatchObject({ ok: false, error: { code: "wrong_role" } });
    }
  });
});
