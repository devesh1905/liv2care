import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { startJourney, type StartInput } from "./start";

const base: StartInput = {
  journeyId: "11111111-1111-4111-8111-111111111111",
  name: "Test Person",
  age: 50,
  phoneMasked: "98•••• 0000",
  language: "en",
  route: "order_tests",
  ultrasound: false,
  consentScope: "Pathway",
};

function fakeAdmin(error: { code: string; message: string } | null = null) {
  const rpc = vi.fn(async () => ({ data: null, error }));
  return { admin: { rpc } as unknown as SupabaseClient, rpc };
}

describe("startJourney()", () => {
  it("starts an order-tests journey with the patient's first pending action", async () => {
    const { admin, rpc } = fakeAdmin();
    const r = await startJourney(admin, { id: "d1", role: "doctor" }, base);
    expect(r).toEqual({ ok: true, journeyId: base.journeyId });
    expect(rpc).toHaveBeenCalledWith("start_journey", expect.objectContaining({
      p_route: "order_tests",
      p_report: null,
      p_first_task: { owner: "Patient", description: "Book the lab", hours: 24 },
    }));
  });

  it("starts an existing-report journey at the clinician's queue", async () => {
    const { admin, rpc } = fakeAdmin();
    await startJourney(admin, { id: "d1", role: "doctor" }, { ...base, route: "existing_report", report: { storagePath: "intake/d1/a.pdf", fileName: "a.pdf" } });
    expect(rpc).toHaveBeenCalledWith("start_journey", expect.objectContaining({
      p_first_task: { owner: "Clinician", description: "Review and write the summary", hours: 24 },
    }));
  });

  it("refuses non-doctors and wrong report combinations without calling the database", async () => {
    const { admin, rpc } = fakeAdmin();
    expect(await startJourney(admin, { id: "l1", role: "lab" }, base)).toMatchObject({ ok: false, error: { code: "wrong_role" } });
    expect(await startJourney(admin, { id: "d1", role: "doctor" }, { ...base, route: "existing_report" })).toMatchObject({ ok: false });
    expect(await startJourney(admin, { id: "d1", role: "doctor" }, { ...base, report: { storagePath: "a", fileName: "a.pdf" } })).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps a missing consent to an invalid payload", async () => {
    const { admin } = fakeAdmin({ code: "23514", message: "patient consent is required" });
    expect(await startJourney(admin, { id: "d1", role: "doctor" }, base)).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
  });
});
