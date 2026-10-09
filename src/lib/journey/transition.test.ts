import { describe, expect, it } from "vitest";
import { StaleJourneyError, transition, type ApplyRequest, type JourneyStore } from "./transition";
import { STAGE } from "./stages";
import type { JourneyState } from "./types";

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

  it("walks a whole route to completion", async () => {
    const m = memoryStore({ stage: STAGE.ORDERED, missed: false });
    const patient = { id: "p1", role: "patient" } as const;
    const steps = [
      [{ type: "BOOK" }, patient],
      [{ type: "LAB_UPLOAD" }, lab],
      [{ type: "CLINICIAN_SUBMIT", summaryWritten: true }, { id: "c1", role: "clinician" }],
      [{ type: "APPROVE_VCTE" }, doctor],
      [{ type: "BOOK" }, patient],
      [{ type: "CENTRE_UPLOAD" }, { id: "c2", role: "centre" }],
      [{ type: "CHOOSE_NEXT_STEP", step: "routine" }, doctor],
      [{ type: "MARK_ATTENDED" }, lab],
    ] as const;
    for (const [event, actor] of steps) {
      expect((await transition(m.store, "j1", event, actor)).ok, event.type).toBe(true);
    }
    expect(m.current()?.stage).toBe(STAGE.COMPLETE);
    expect(m.applied).toHaveLength(steps.length);
  });
});
