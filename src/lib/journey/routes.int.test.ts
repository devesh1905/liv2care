import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { startJourney } from "./start";
import { STAGE } from "./stages";
import { supabaseJourneyStore, transition } from "./transition";

/**
 * Both starting routes reach "report received" with a full audit trail, on the real database.
 * Needs `npx supabase start` and NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (read from .env.local when present).
 */
const DOCTOR = { id: "00000000-0000-4000-8000-000000000001", role: "doctor" } as const;
const LAB_USER = { id: "00000000-0000-4000-8000-000000000003", role: "lab" } as const;
const PATIENT = { id: "patient-link", role: "patient" } as const;
const SUNRISE = "00000000-0000-4000-8000-0000000000a1";

let admin: SupabaseClient;
let store: ReturnType<typeof supabaseJourneyStore>;

beforeAll(() => {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // CI passes the variables directly
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the integration tests");
  admin = createClient(url, key, { auth: { persistSession: false } });
  store = supabaseJourneyStore(admin);
});

const base = {
  name: "Integration Person",
  age: 50,
  phoneMasked: "98•••• 0000",
  language: "en",
  ultrasound: false,
  consentScope: "Pathway",
} as const;

async function events(journeyId: string) {
  const { data } = await admin
    .from("journey_events")
    .select("event, actor_role, from_stage, to_stage, detail")
    .eq("journey_id", journeyId)
    .order("id");
  return data ?? [];
}

async function openTasks(journeyId: string) {
  const { data } = await admin.from("tasks").select("owner, description").eq("journey_id", journeyId).is("done_at", null);
  return data ?? [];
}

async function freeSlots(count: number) {
  const { data } = await admin
    .from("slots")
    .select("id")
    .eq("partner_id", SUNRISE)
    .eq("taken", false)
    .order("starts_at")
    .limit(count);
  return (data ?? []).map((s) => s.id as string);
}

const labBooking = (slotId: string) => ({ booking: { partnerId: SUNRISE, slotId, kind: "lab", slotLabel: "Tomorrow 9:00 am" } }) as const;
const labReport = (journeyId: string) =>
  ({ report: { kind: "lab", partnerId: SUNRISE, storagePath: `journeys/${journeyId}/r.pdf`, fileName: "r.pdf" } }) as const;

describe("Option 1: existing lab report", () => {
  it("starts at report received with consent, report and audit rows", async () => {
    const journeyId = randomUUID();
    const r = await startJourney(admin, DOCTOR, {
      ...base,
      journeyId,
      route: "existing_report",
      report: { storagePath: `intake/${DOCTOR.id}/${journeyId}.pdf`, fileName: "existing.pdf" },
    });
    expect(r.ok).toBe(true);

    const { data: journey } = await admin.from("journeys").select("stage, route").eq("id", journeyId).single();
    expect(journey).toEqual({ stage: STAGE.REPORT_IN, route: "existing_report" });
    expect((await events(journeyId)).map((e) => e.event)).toEqual(["JOURNEY_STARTED", "EXISTING_REPORT_UPLOADED"]);
    expect(await openTasks(journeyId)).toEqual([{ owner: "Clinician", description: "Review and write the summary" }]);
    const { count } = await admin.from("consents").select("id", { count: "exact", head: true }).eq("journey_id", journeyId);
    expect(count).toBe(1);
  });
});

describe("Option 2: order the tests", () => {
  it("books a slot, then the lab uploads: report received, slot taken, visit attended", async () => {
    const journeyId = randomUUID();
    expect((await startJourney(admin, DOCTOR, { ...base, journeyId, route: "order_tests" })).ok).toBe(true);
    expect(await openTasks(journeyId)).toEqual([{ owner: "Patient", description: "Book the lab" }]);

    const [slotId] = await freeSlots(1);
    const booked = await transition(store, journeyId, { type: "BOOK" }, PATIENT, { partner: "Sunrise Diagnostics" }, labBooking(slotId));
    expect(booked).toMatchObject({ ok: true, stage: STAGE.LAB_BOOKED });
    expect(await openTasks(journeyId)).toEqual([{ owner: "Lab", description: "Upload the report" }]);
    const { data: taken } = await admin.from("slots").select("taken").eq("id", slotId).single();
    expect(taken?.taken).toBe(true);

    const uploaded = await transition(store, journeyId, { type: "LAB_UPLOAD" }, LAB_USER, { partner: "Sunrise Diagnostics" }, labReport(journeyId));
    expect(uploaded).toMatchObject({ ok: true, stage: STAGE.REPORT_IN });

    const log = await events(journeyId);
    expect(log.map((e) => [e.event, e.actor_role, e.from_stage, e.to_stage])).toEqual([
      ["JOURNEY_STARTED", "doctor", null, STAGE.ORDERED],
      ["BOOK", "patient", STAGE.ORDERED, STAGE.LAB_BOOKED],
      ["LAB_UPLOAD", "lab", STAGE.LAB_BOOKED, STAGE.REPORT_IN],
    ]);
    expect(log[2].detail).toHaveProperty("report_id");
    expect(await openTasks(journeyId)).toEqual([{ owner: "Clinician", description: "Review and write the summary" }]);
    const { data: booking } = await admin.from("bookings").select("status").eq("journey_id", journeyId).single();
    expect(booking?.status).toBe("attended");
  });

  it("a missed visit blocks the upload until the patient reschedules, and frees the old slot", async () => {
    const journeyId = randomUUID();
    await startJourney(admin, DOCTOR, { ...base, journeyId, route: "order_tests" });
    const [first, second] = await freeSlots(2);

    await transition(store, journeyId, { type: "BOOK" }, PATIENT, {}, labBooking(first));
    expect(await transition(store, journeyId, { type: "MARK_MISSED" }, LAB_USER)).toMatchObject({ ok: true });
    const blocked = await transition(store, journeyId, { type: "LAB_UPLOAD" }, LAB_USER, {}, labReport(journeyId));
    expect(blocked).toMatchObject({ ok: false, error: { code: "missed_state" } });

    expect(await transition(store, journeyId, { type: "RESCHEDULE" }, PATIENT, {}, labBooking(second))).toMatchObject({
      ok: true,
      missed: false,
    });
    const { data: old } = await admin.from("slots").select("taken").eq("id", first).single();
    expect(old?.taken).toBe(false);
  });

  it("refuses a slot that is already taken and leaves the journey unchanged", async () => {
    const a = randomUUID();
    const b = randomUUID();
    await startJourney(admin, DOCTOR, { ...base, journeyId: a, route: "order_tests" });
    await startJourney(admin, DOCTOR, { ...base, journeyId: b, route: "order_tests" });
    const [slotId] = await freeSlots(1);

    expect(await transition(store, a, { type: "BOOK" }, PATIENT, {}, labBooking(slotId))).toMatchObject({ ok: true });
    expect(await transition(store, b, { type: "BOOK" }, PATIENT, {}, labBooking(slotId))).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    });
    const { data: j } = await admin.from("journeys").select("stage").eq("id", b).single();
    expect(j?.stage).toBe(STAGE.ORDERED);
  });
});
