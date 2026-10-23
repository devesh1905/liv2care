import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kindFor, stateOf, type PartnerKind } from "@/lib/journey/derived";
import { decide } from "@/lib/journey/stateMachine";
import { supabaseJourneyStore, transition } from "@/lib/journey/transition";
import type { JourneyEvent, JourneyState, NextStepType } from "@/lib/journey/types";
import type { Lang } from "@/lib/i18n/patient";
import { mockProvider } from "@/lib/messages/provider";
import { templatesFor } from "@/lib/messages/templates";
import { formatSlot } from "@/lib/format/slot";
import { cleanAddress } from "@/lib/contacts/address";
import { encryptionReady } from "@/lib/contacts/phone";
import { saveAddress } from "@/lib/contacts/store";
import { resolveBookingLink } from "./links";

const PATIENT = { id: "booking-link", role: "patient" } as const;

export type BookingContext = {
  journeyId: string;
  state: JourneyState;
  route: string;
  kind: PartnerKind;
  event: Extract<JourneyEvent, { type: "BOOK" | "RESCHEDULE" }>["type"];
  /** False when the journey is not waiting for the patient to book. */
  bookable: boolean;
  patient: { firstName: string; code: string; language: Lang };
};

/** Everything the booking page needs, from a link token. Null for an invalid, expired or revoked link. */
export async function loadBookingContext(admin: SupabaseClient, token: string): Promise<BookingContext | null> {
  const journeyId = await resolveBookingLink(admin, token);
  if (!journeyId) return null;

  const { data, error } = await admin
    .from("journeys")
    .select("stage, missed, route, next_step, patients(code, name, language)")
    .eq("id", journeyId)
    .maybeSingle();
  if (error) throw error;
  const patient = data?.patients as unknown as { code: string; name: string; language: string } | null;
  if (!data || !patient) return null;

  const state: JourneyState = stateOf(data);
  const event = state.missed ? "RESCHEDULE" : "BOOK";
  return {
    journeyId,
    state,
    route: data.route as string,
    kind: kindFor(state, (data.next_step as NextStepType | null) ?? null),
    event,
    bookable: decide(state, { type: event }, PATIENT).ok,
    patient: { firstName: patient.name.split(" ")[0], code: patient.code, language: patient.language === "hi" ? "hi" : "en" },
  };
}

export type BookResult =
  | { ok: true; partnerName: string; slotLabel: string }
  | { ok: false; code: "invalid_link" | "not_bookable" | "slot_unavailable" | "address_needed" | "failed"; message: string };

const HOME_LABEL = { en: "Home collection", hi: "घर पर सैंपल" } as const;

/**
 * Books (or reschedules) a slot for the journey behind a link. All stage changes go through transition().
 * A home-collection slot also needs the patient's address, which is kept encrypted for the lab.
 */
export async function bookForLink(admin: SupabaseClient, token: string, partnerId: string, slotId: string, address?: string): Promise<BookResult> {
  const ctx = await loadBookingContext(admin, token);
  if (!ctx) return { ok: false, code: "invalid_link", message: "This link is no longer valid." };
  if (!ctx.bookable) return { ok: false, code: "not_bookable", message: "There is nothing to book right now." };

  const [{ data: partner }, { data: slot }] = await Promise.all([
    admin.from("partners").select("id, name, kind").eq("id", partnerId).maybeSingle(),
    admin.from("slots").select("id, partner_id, starts_at, taken, home").eq("id", slotId).maybeSingle(),
  ]);
  const usable =
    partner && slot && partner.kind === ctx.kind && slot.partner_id === partner.id && !slot.taken && new Date(slot.starts_at) > new Date();
  if (!usable) return { ok: false, code: "slot_unavailable", message: "That time is not available." };

  const home = slot.home === true;
  if (home && ctx.kind !== "lab") return { ok: false, code: "slot_unavailable", message: "That time is not available." };
  const homeAddress = home ? cleanAddress(address) : null;
  if (home && !homeAddress) return { ok: false, code: "address_needed", message: "Enter the full address." };
  if (home && !encryptionReady(process.env.PHONE_ENCRYPTION_KEY)) return { ok: false, code: "failed", message: "Home visits are not set up on this server." };

  const when = formatSlot(slot.starts_at);
  const slotLabel = home ? `${HOME_LABEL[ctx.patient.language]}, ${when}` : when;
  const result = await transition(
    supabaseJourneyStore(admin),
    ctx.journeyId,
    { type: ctx.event },
    PATIENT,
    { partner: partner.name, slot: slotLabel },
    { booking: { partnerId: partner.id, slotId: slot.id, kind: ctx.kind, slotLabel } },
  );
  if (!result.ok) {
    const taken = result.error.code === "invalid_payload";
    return { ok: false, code: taken ? "slot_unavailable" : "failed", message: result.error.message };
  }

  if (homeAddress) {
    const { data: booked } = await admin
      .from("bookings")
      .select("id")
      .eq("journey_id", ctx.journeyId)
      .eq("slot_id", slot.id)
      .eq("status", "booked")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (booked) await saveAddress(admin, booked.id, homeAddress);
  }

  await mockProvider(admin)
    .send({
      journeyId: ctx.journeyId,
      channel: "SMS",
      body: ctx.event === "RESCHEDULE" ? templatesFor(ctx.patient.language).rescheduled(partner.name, slotLabel) : templatesFor(ctx.patient.language).bookingConfirmed(partner.name, slotLabel),
    })
    .catch(() => undefined);
  return { ok: true, partnerName: partner.name, slotLabel };
}
