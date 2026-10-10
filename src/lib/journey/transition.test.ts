import { describe, expect, it } from "vitest";
import { StaleJourneyError, transition, type ApplyRequest, type Effects, type JourneyStore } from "./transition";
import { STAGE } from "./stages";
import type { Actor, JourneyEvent, JourneyState } from "./types";

function memoryStore(initial: JourneyState | null, opts: { stale?: boolean } = {}) {
  let state = initial;
  const applied: ApplyRequest[] = [];
  const store: JourneyStore = {
    async get() {
      return state;
    },
    async apply(req) {
      if (opts.stale) throw new StaleJourneyError();
      applied.push(req);
      state = req.next;
      return { eventId: applied.length };
    },
  };
  return { store, applied, current: () => state };
}

const doctor = { id: "d1", role: "doctor" } as const;
const lab = { id: "l1", role: "lab" } as const;

describe("transition()", () => {
  it("applies an allowed move and returns the new state", async () => {
    const m = memoryStore({ stage: STAGE.REVIEWED, missed: false });
    const r = await transition(m.store, "j1", { type: "APPROVE_VCTE" }, doctor);
    expect(r).toEqual({ ok: true, stage: STAGE.VCTE_LINK, missed: false, eventId: 1 });
    expect(m.applied[0]).toMatchObject({ event: "APPROVE_VCTE", expected: { stage: STAGE.REVIEWED }, next: { stage: STAGE.VCTE_LINK } });
  });

  it("records the next step and decline reason for the database", async () => {
    const a = memoryStore({ stage: STAGE.VCTE_REPORT, missed: false });
    await transition(a.store, "j1", { type: "CHOOSE_NEXT_STEP", step: "specialist" }, doctor);
    expect(a.applied[0]).toMatchObject({ nextStep: "specialist", declineReason: null });

    const b = memoryStore({ stage: STAGE.REVIEWED, missed: false });
    await transition(b.store, "j1", { type: "DECLINE_VCTE", reason: "Cost or access" }, doctor);
    expect(b.applied[0]).toMatchObject({ nextStep: null, declineReason: "Cost or access" });
  });

  it("does not write anything for a disallowed move", async () => {
    const m = memoryStore({ stage: STAGE.REVIEWED, missed: false });
    const r = await transition(m.store, "j1", { type: "LAB_UPLOAD" }, lab);
    expect(r).toMatchObject({ ok: false, error: { code: "wrong_stage" } });
    expect(m.applied).toHaveLength(0);
    expect(m.current()).toEqual({ stage: STAGE.REVIEWED, missed: false });
  });

  it("reports a missing journey", async () => {
    const m = memoryStore(null);
    expect(await transition(m.store, "nope", { type: "APPROVE_VCTE" }, doctor)).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("reports a stale journey instead of throwing", async () => {
    const m = memoryStore({ stage: STAGE.REVIEWED, missed: false }, { stale: true });
    expect(await transition(m.store, "j1", { type: "APPROVE_VCTE" }, doctor)).toMatchObject({ ok: false, error: { code: "stale" } });
  });

  it("keeps clinical values out of the audit detail", async () => {
    const m = memoryStore({ stage: STAGE.LAB_BOOKED, missed: false });
    const detail = { partner: "Sunrise Diagnostics", platelets: 182 } as never;
    const r = await transition(m.store, "j1", { type: "LAB_UPLOAD" }, lab, detail);
    expect(r).toMatchObject({ ok: false, error: { code: "invalid_detail" } });
    expect(m.applied).toHaveLength(0);
  });

  it("asks the database for the next pending action", async () => {
    const m = memoryStore({ stage: STAGE.REPORT_IN, missed: false });
    await transition(m.store, "j1", { type: "CLINICIAN_SUBMIT", summaryWritten: true }, { id: "c1", role: "clinician" }, {}, {
      review: { fib4Text: "typed", summary: "typed", recommendsVcte: false },
    });
    expect(m.applied[0].nextTask).toEqual({ owner: "Doctor", description: "Decide on FibroScan", hours: 24 });

    const done = memoryStore({ stage: STAGE.NEXT_BOOKED, missed: false });
    await transition(done.store, "j1", { type: "MARK_ATTENDED" }, lab);
    expect(done.applied[0].nextTask).toBeNull();
  });

  it("requires a booking to book and a report to upload", async () => {
    const book = memoryStore({ stage: STAGE.ORDERED, missed: false });
    expect(await transition(book.store, "j1", { type: "BOOK" }, { id: "p1", role: "patient" })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    });
    const up = memoryStore({ stage: STAGE.LAB_BOOKED, missed: false });
    expect(await transition(up.store, "j1", { type: "LAB_UPLOAD" }, lab)).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
    // a FibroScan report cannot satisfy a lab upload
    const wrong = { report: { kind: "fibroscan", partnerId: null, storagePath: "a", fileName: "a.pdf" } } as const;
    expect(await transition(up.store, "j1", { type: "LAB_UPLOAD" }, lab, {}, wrong)).toMatchObject({ ok: false });
    expect(up.applied).toHaveLength(0);
  });

  it("a clinician submission needs a typed review, and nothing else may carry one", async () => {
    const m = memoryStore({ stage: STAGE.REPORT_IN, missed: false });
    const clinician = { id: "c1", role: "clinician" } as const;
    const event = { type: "CLINICIAN_SUBMIT", summaryWritten: true } as const;
    expect(await transition(m.store, "j1", event, clinician)).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
    expect(await transition(m.store, "j1", event, clinician, {}, { review: { fib4Text: " ", summary: "x", recommendsVcte: false } })).toMatchObject({ ok: false });
    expect(await transition(m.store, "j1", event, clinician, {}, { review: { fib4Text: "2.5", summary: "", recommendsVcte: false } })).toMatchObject({ ok: false });
    expect(m.applied).toHaveLength(0);

    const review = { fib4Text: "2.5", summary: "Typed by the clinician", recommendsVcte: true };
    expect(await transition(m.store, "j1", event, clinician, { recommends_vcte: true }, { review })).toMatchObject({ ok: true });
    expect(m.applied[0].effects.review).toEqual(review);
    // the audit detail carries the flag only, never the text
    expect(JSON.stringify(m.applied[0].detail)).not.toContain("Typed by");

    const other = memoryStore({ stage: STAGE.REVIEWED, missed: false });
    expect(await transition(other.store, "j1", { type: "APPROVE_VCTE" }, doctor, {}, { review })).toMatchObject({ ok: false });
  });

  it("passes the booking and report through to the store", async () => {
    const m = memoryStore({ stage: STAGE.ORDERED, missed: false });
    const booking = { partnerId: "a1", slotId: "s1", kind: "lab", slotLabel: "Tomorrow 9:00 am" } as const;
    await transition(m.store, "j1", { type: "BOOK" }, { id: "p1", role: "patient" }, {}, { booking });
    expect(m.applied[0].effects.booking).toEqual(booking);
  });

  it("walks a whole route to completion", async () => {
    const m = memoryStore({ stage: STAGE.ORDERED, missed: false });
    const patient = { id: "p1", role: "patient" } as const;
    const booking = { booking: { partnerId: "a1", slotId: null, kind: "lab", slotLabel: "x" } } as const;
    const labReport = { report: { kind: "lab", partnerId: "a1", storagePath: "a", fileName: "a.pdf" } } as const;
    const fibroReport = { report: { kind: "fibroscan", partnerId: "b1", storagePath: "b", fileName: "b.pdf" } } as const;
    const review = { review: { fib4Text: "typed", summary: "typed", recommendsVcte: false } } as const;
    const steps = [
      [{ type: "BOOK" }, patient, booking],
      [{ type: "LAB_UPLOAD" }, lab, labReport],
      [{ type: "CLINICIAN_SUBMIT", summaryWritten: true }, { id: "c1", role: "clinician" }, review],
      [{ type: "APPROVE_VCTE" }, doctor],
      [{ type: "BOOK" }, patient, booking],
      [{ type: "CENTRE_UPLOAD" }, { id: "c2", role: "centre" }, fibroReport],
      [{ type: "CHOOSE_NEXT_STEP", step: "routine" }, doctor],
      [{ type: "MARK_ATTENDED" }, lab],
    ] as const;
    for (const [event, actor, effects] of steps as unknown as [JourneyEvent, Actor, Effects?][]) {
      expect((await transition(m.store, "j1", event, actor, {}, effects)).ok, event.type).toBe(true);
    }
    expect(m.current()?.stage).toBe(STAGE.COMPLETE);
    expect(m.applied).toHaveLength(steps.length);
  });
});
