import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { STAGE } from "@/lib/journey/stages";
import { startJourney } from "@/lib/journey/start";
import { supabaseJourneyStore, transition } from "@/lib/journey/transition";
import { bookForLink, loadBookingContext } from "./book";
import { hashToken, issueBookingLink, issueProgressLink, resolveBookingLink } from "./links";
import { loadSlotOptions } from "./options";
import { loadTimelineView } from "./timeline-view";

/** Patient booking through a link, on the real database (needs `npx supabase start`). */
const DOCTOR = { id: "00000000-0000-4000-8000-000000000001", role: "doctor" } as const;
const LAB_USER = { id: "00000000-0000-4000-8000-000000000003", role: "lab" } as const;

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

async function newJourney(language: "en" | "hi" = "en") {
  const journeyId = randomUUID();
  const r = await startJourney(admin, DOCTOR, {
    journeyId,
    name: "Link Person",
    age: 50,
    phoneMasked: "98•••• 0000",
    language,
    route: "order_tests",
    ultrasound: false,
    consentScope: "Pathway",
  });
  expect(r.ok).toBe(true);
  return journeyId;
}

const tokenOf = (url: string) => url.split("/book/")[1];

describe("booking links", () => {
  it("resolve while live, and stop resolving when replaced or expired", async () => {
    const journeyId = await newJourney();
    const first = tokenOf(await issueBookingLink(admin, journeyId));
    expect(await resolveBookingLink(admin, first)).toBe(journeyId);
    expect(await resolveBookingLink(admin, "x".repeat(32))).toBeNull();

    const second = tokenOf(await issueBookingLink(admin, journeyId));
    expect(await resolveBookingLink(admin, first)).toBeNull();
    expect(await resolveBookingLink(admin, second)).toBe(journeyId);

    await admin.from("booking_links").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", hashToken(second));
    expect(await resolveBookingLink(admin, second)).toBeNull();
  });

  it("are stored hashed, never as the token", async () => {
    const journeyId = await newJourney();
    const token = tokenOf(await issueBookingLink(admin, journeyId));
    const { data } = await admin.from("booking_links").select("token_hash").eq("journey_id", journeyId);
    expect(data?.map((r) => r.token_hash)).toEqual([hashToken(token)]);
  });
});

describe("progress links", () => {
  it("are separate from booking links in both directions, and survive a new booking link", async () => {
    const journeyId = await newJourney();
    const view = (await issueProgressLink(admin, journeyId)).split("/patient/")[1];
    const book = tokenOf(await issueBookingLink(admin, journeyId));

    expect(await resolveBookingLink(admin, view, "view")).toBe(journeyId);
    expect(await resolveBookingLink(admin, book, "book")).toBe(journeyId);
    expect(await resolveBookingLink(admin, view, "book")).toBeNull(); // a progress link cannot book
    expect(await resolveBookingLink(admin, book, "view")).toBeNull();

    await issueBookingLink(admin, journeyId); // sending a new booking link must not break the progress link
    expect(await resolveBookingLink(admin, view, "view")).toBe(journeyId);
    expect(await resolveBookingLink(admin, book, "book")).toBeNull();
  });

  it("show stage, place and time only, and follow the journey", async () => {
    const journeyId = await newJourney("hi");
    const token = (await issueProgressLink(admin, journeyId)).split("/patient/")[1];

    const first = await loadTimelineView(token);
    expect(first).toMatchObject({ kind: "ready", language: "hi", firstName: "Link", stage: STAGE.ORDERED, missed: false, appointment: null });

    const bookToken = tokenOf(await issueBookingLink(admin, journeyId));
    const [option] = await loadSlotOptions(admin, "lab");
    await bookForLink(admin, bookToken, option.partnerId, option.slotId);

    const after = await loadTimelineView(token);
    expect(after).toMatchObject({ kind: "ready", stage: STAGE.LAB_BOOKED });
    expect(after.kind === "ready" && after.appointment?.place).toBe(option.partnerName);
    // nothing but these fields is ever loaded for the patient
    expect(Object.keys(after).sort()).toEqual(["appointment", "firstName", "kind", "language", "missed", "stage"]);

    expect(await loadTimelineView("x".repeat(32))).toEqual({ kind: "invalid" });
    expect(await loadTimelineView(bookToken)).toEqual({ kind: "invalid" }); // a booking token does not open the progress page
  });
});

describe("booking through a link", () => {
  it("books a lab slot, logs a confirmation, and the link then shows nothing left to book", async () => {
    const journeyId = await newJourney("hi");
    const token = tokenOf(await issueBookingLink(admin, journeyId));
    const ctx = await loadBookingContext(admin, token);
    expect(ctx).toMatchObject({ kind: "lab", event: "BOOK", bookable: true, patient: { language: "hi", firstName: "Link" } });

    const [option] = await loadSlotOptions(admin, "lab");
    const r = await bookForLink(admin, token, option.partnerId, option.slotId);
    expect(r).toMatchObject({ ok: true, partnerName: option.partnerName });

    const { data: journey } = await admin.from("journeys").select("stage").eq("id", journeyId).single();
    expect(journey?.stage).toBe(STAGE.LAB_BOOKED);
    const { data: msgs } = await admin.from("messages").select("channel, body").eq("journey_id", journeyId);
    // this patient's language is Hindi, so the confirmation is in Hindi
    expect(msgs?.some((m) => m.channel === "SMS" && m.body.startsWith("बुकिंग पक्की हो गई:"))).toBe(true);

    expect((await loadBookingContext(admin, token))?.bookable).toBe(false);
    expect(await bookForLink(admin, token, option.partnerId, option.slotId)).toMatchObject({ ok: false, code: "not_bookable" });
  });

  it("refuses a partner of the wrong kind and a slot that is not that partner's", async () => {
    const journeyId = await newJourney();
    const token = tokenOf(await issueBookingLink(admin, journeyId));
    const [centre] = await loadSlotOptions(admin, "centre");
    expect(await bookForLink(admin, token, centre.partnerId, centre.slotId)).toMatchObject({ ok: false, code: "slot_unavailable" });

    const [labA, labB] = [...new Map((await loadSlotOptions(admin, "lab")).map((o) => [o.partnerId, o])).values()];
    expect(await bookForLink(admin, token, labA.partnerId, labB.slotId)).toMatchObject({ ok: false, code: "slot_unavailable" });
    const { data: journey } = await admin.from("journeys").select("stage").eq("id", journeyId).single();
    expect(journey?.stage).toBe(STAGE.ORDERED);
  });

  it("a missed visit gets a reschedule through a new link", async () => {
    const journeyId = await newJourney();
    const first = tokenOf(await issueBookingLink(admin, journeyId));
    const [a, b] = await loadSlotOptions(admin, "lab");
    await bookForLink(admin, first, a.partnerId, a.slotId);
    await transition(supabaseJourneyStore(admin), journeyId, { type: "MARK_MISSED" }, LAB_USER);

    const second = tokenOf(await issueBookingLink(admin, journeyId));
    const ctx = await loadBookingContext(admin, second);
    expect(ctx).toMatchObject({ event: "RESCHEDULE", bookable: true });

    expect(await bookForLink(admin, second, b.partnerId, b.slotId)).toMatchObject({ ok: true });
    const { data: journey } = await admin.from("journeys").select("stage, missed").eq("id", journeyId).single();
    expect(journey).toEqual({ stage: STAGE.LAB_BOOKED, missed: false });
  });
});
