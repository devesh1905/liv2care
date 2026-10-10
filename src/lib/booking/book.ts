import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kindFor, type PartnerKind } from "@/lib/journey/derived";
import type { Stage } from "@/lib/journey/stages";
import { decide } from "@/lib/journey/stateMachine";
import { supabaseJourneyStore, transition } from "@/lib/journey/transition";
import type { JourneyEvent, JourneyState, NextStepType } from "@/lib/journey/types";
import type { Lang } from "@/lib/i18n/patient";
import { mockProvider } from "@/lib/messages/provider";
import { templates } from "@/lib/messages/templates";
import { formatSlot } from "@/lib/format/slot";
import { resolveBookingLink } from "./links";

const PATIENT = { id: "booking-link", role: "patient" } as const;

export type BookingContext = {
  journeyId: string;
  state: JourneyState;
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
    .select("stage, missed, next_step, patients(code, name, language)")
    .eq("id", journeyId)
    .maybeSingle();
  if (error) throw error;
  const patient = data?.patients as unknown as { code: string; name: string; language: string } | null;
  if (!data || !patient) return null;

  const state: JourneyState = { stage: data.stage as Stage, missed: data.missed };
  const event = state.missed ? "RESCHEDULE" : "BOOK";
  return {
    journeyId,
    state,
    kind: kindFor(state, (data.next_step as NextStepType | null) ?? null),
    event,
    bookable: decide(state, { type: event }, PATIENT).ok,
    patient: { firstName: patient.name.split(" ")[0], code: patient.code, language: patient.language === "hi" ? "hi" : "en" },
  };
}

export type BookResult =
  | { ok: true; partnerName: string; slotLabel: string }
  | { ok: false; code: "invalid_link" | "not_bookable" | "slot_unavailable" | "failed"; message: string };

/** Books (or reschedules) a slot for the journey behind a link. All stage changes go through transition(). */
export async function bookForLink(admin: SupabaseClient, token: string, partnerId: string, slotId: string): Promise<BookResult> {
  const ctx = await loadBookingContext(admin, token);
  if (!ctx) return { ok: false, code: "invalid_link", message: "This link is no longer valid." };
  if (!ctx.bookable) return { ok: false, code: "not_bookable", message: "There is nothing to book right now." };

  const [{ data: partner }, { data: slot }] = await Promise.all([
    admin.from("partners").select("id, name, kind").eq("id", partnerId).maybeSingle(),
    admin.from("slots").select("id, partner_id, starts_at, taken").eq("id", slotId).maybeSingle(),
  ]);
  const usable =
    partner && slot && partner.kind === ctx.kind && slot.partner_id === partner.id && !slot.taken && new Date(slot.starts_at) > new Date();
  if (!usable) return { ok: false, code: "slot_unavailable", message: "That time is not available." };

  const slotLabel = formatSlot(slot.starts_at);
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

  await mockProvider(admin)
    .send({
      journeyId: ctx.journeyId,
      channel: "SMS",
      body: ctx.event === "RESCHEDULE" ? templates.rescheduled(partner.name, slotLabel) : templates.bookingConfirmed(partner.name, slotLabel),
    })
    .catch(() => undefined);
  return { ok: true, partnerName: partner.name, slotLabel };
}
