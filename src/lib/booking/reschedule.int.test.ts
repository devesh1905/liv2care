import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { STAGE } from "@/lib/journey/stages";
import { startJourney } from "@/lib/journey/start";
import { supabaseJourneyStore, transition } from "@/lib/journey/transition";
import { bookForLink } from "./book";
import { issueBookingLink, resolveBookingLink } from "./links";
import { loadSlotOptions } from "./options";
import { sendRescheduleOffer, suggestForMissed } from "./reschedule";
import { loadBookingView } from "./view";

/** Suggesting and offering a new time to a patient who missed a visit, on the real database (needs `npx supabase start`). */
const DOCTOR = { id: "00000000-0000-4000-8000-000000000001", role: "doctor" } as const;
const LAB_USER = { id: "00000000-0000-4000-8000-000000000003", role: "lab" } as const;
const NO_AI = { apiKey: "" }; // the plain fallback, so the test never calls a model

let admin: SupabaseClient;

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
});

/** A patient who booked a lab and then missed the visit. */
async function missedPatient(language: "en" | "hi") {
  const journeyId = randomUUID();
  expect(
    (await startJourney(admin, DOCTOR, { journeyId, name: "Missed Person", age: 50, phoneMasked: "98•••• 0000", language, route: "order_tests", ultrasound: false, consentScope: "Pathway" })).ok,
  ).toBe(true);
  const token = (await issueBookingLink(admin, journeyId)).split("/book/")[1];
  const [first] = await loadSlotOptions(admin, "lab");
  expect((await bookForLink(admin, token, first.partnerId, first.slotId)).ok).toBe(true);
  expect(await transition(supabaseJourneyStore(admin), journeyId, { type: "MARK_MISSED" }, LAB_USER)).toMatchObject({ ok: true, missed: true });
  return journeyId;
}

describe("suggesting a new time", () => {
  it("picks the earliest open slot at the same kind of place, with a reason in the patient's language", async () => {
    const offer = await suggestForMissed(admin, { stage: STAGE.LAB_BOOKED, nextStep: null, language: "hi" }, NO_AI);
    expect(offer).not.toBeNull();
    const options = await loadSlotOptions(admin, "lab");
    const earliest = [...options].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    expect(offer!.slotId).toBe(earliest.slotId);
    expect(offer!.source).toBe("local");
    expect(/[ऀ-ॿ]/.test(offer!.reason)).toBe(true);
  });
});

describe("offering the new time", () => {
  it("messages the patient in their language with a link that opens on that slot, and records who sent it", async () => {
    const journeyId = await missedPatient("hi");
    const offer = (await suggestForMissed(admin, { stage: STAGE.LAB_BOOKED, nextStep: null, language: "hi" }, NO_AI))!;

    const sent = await sendRescheduleOffer(admin, journeyId, offer.slotId, { id: null, role: "ops" });
    expect(sent).toMatchObject({ ok: true, place: offer.place, slotLabel: offer.slotLabel });

    const { data: msg } = await admin.from("messages").select("channel, body").eq("journey_id", journeyId).like("body", "%हमारा सुझाव है%").single();
    expect(msg!.channel).toBe("SMS");
    expect(msg!.body).toContain(offer.place);
    const link = msg!.body.match(/https?:\/\/\S+/)![0];
    expect(link).toContain(`?pick=${offer.slotId}`);

    // the link works as a booking link and opens with the offered slot selected; nothing was booked by sending it
    const token = link.split("/book/")[1].split("?")[0];
    expect(await resolveBookingLink(admin, token)).toBe(journeyId);
    const view = await loadBookingView(token, offer.slotId);
    expect(view).toMatchObject({ kind: "ready", reschedule: true, suggestedSlotId: offer.slotId });
    const bogus = await loadBookingView(token, randomUUID());
    expect(bogus).toMatchObject({ kind: "ready", suggestedSlotId: undefined });
    const { data: slot } = await admin.from("slots").select("taken").eq("id", offer.slotId).single();
    expect(slot!.taken).toBe(false);

    const { data: event } = await admin.from("journey_events").select("actor_role, detail").eq("journey_id", journeyId).eq("event", "RESCHEDULE_OFFER_SENT").single();
    expect(event).toMatchObject({ actor_role: "ops", detail: { partner: offer.place, slot: offer.slotLabel } });
  });

  it("refuses a patient who has not missed a visit, a taken slot, and a slot at the wrong kind of place", async () => {
    const journeyId = await missedPatient("en");
    const [lab] = await loadSlotOptions(admin, "lab");
    const [centre] = await loadSlotOptions(admin, "centre");

    expect(await sendRescheduleOffer(admin, journeyId, centre.slotId, { id: null, role: "ops" })).toMatchObject({ ok: false });

    await admin.from("slots").update({ taken: true }).eq("id", lab.slotId);
    expect(await sendRescheduleOffer(admin, journeyId, lab.slotId, { id: null, role: "ops" })).toMatchObject({ ok: false });
    await admin.from("slots").update({ taken: false }).eq("id", lab.slotId);

    // a patient who is not missing a visit
    const fresh = randomUUID();
    await startJourney(admin, DOCTOR, { journeyId: fresh, name: "On Track", age: 50, phoneMasked: "98•••• 0000", language: "en", route: "order_tests", ultrasound: false, consentScope: "Pathway" });
    expect(await sendRescheduleOffer(admin, fresh, lab.slotId, { id: null, role: "ops" })).toMatchObject({ ok: false });
  });
});
