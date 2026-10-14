import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatSlot } from "@/lib/format/slot";
import { kindFor } from "@/lib/journey/derived";
import type { Stage } from "@/lib/journey/stages";
import type { NextStepType } from "@/lib/journey/types";
import { suggest, type SuggestDeps } from "@/lib/logistics/suggest";
import type { Preference } from "@/lib/logistics/types";
import type { Lang } from "@/lib/i18n/patient";
import { aiDeps } from "./aiLimits";
import { hashToken } from "./links";
import { sendBookingLink } from "./notify";
import { loadSlotOptions } from "./options";

export type MissedJourney = { stage: Stage; nextStep: NextStepType | null; language: Lang };

export type Offer = {
  slotId: string;
  partnerId: string;
  place: string;
  slotLabel: string;
  reason: string;
  source: "gemini" | "local";
};

/**
 * A suggested new time for a patient who missed a visit: the earliest open slot at the same kind of place. The slot is
 * chosen by code; the AI helper only phrases the reason. Reads logistics data (partners and open slots) only.
 * `reader` may be the signed-in user's client: partners and slots are readable by every staff role.
 */
export async function suggestForMissed(
  reader: SupabaseClient,
  journey: MissedJourney,
  deps: SuggestDeps = {},
  preference: Preference = "earliest",
): Promise<Offer | null> {
  const kind = kindFor({ stage: journey.stage, missed: true }, journey.nextStep);
  const options = await loadSlotOptions(reader, kind);
  const s = await suggest({ language: journey.language, area: null, partnerKind: kind, preference, options }, deps);
  const pick = s && options.find((o) => o.slotId === s.slotId);
  if (!s || !pick) return null;
  return {
    slotId: s.slotId,
    partnerId: s.partnerId,
    place: pick.partnerName,
    slotLabel: formatSlot(pick.startsAt),
    reason: s.reason,
    source: s.source,
  };
}

export type OfferResult = { ok: true; place: string; slotLabel: string } | { ok: false; message: string };

/**
 * Sends the patient the suggestion (in their language) with a fresh booking link that opens with that slot selected,
 * and records who sent it. Nothing is booked until the patient confirms.
 */
export async function sendRescheduleOffer(
  admin: SupabaseClient,
  journeyId: string,
  slotId: string,
  actor: { id: string | null; role: string },
): Promise<OfferResult> {
  const { data: journey } = await admin.from("journeys").select("stage, missed, next_step").eq("id", journeyId).maybeSingle();
  if (!journey?.missed) return { ok: false, message: "That patient has not missed a visit." };

  const { data: slot } = await admin
    .from("slots")
    .select("id, taken, starts_at, partners(name, kind)")
    .eq("id", slotId)
    .maybeSingle();
  const partner = slot?.partners as unknown as { name: string; kind: string } | null;
  const kind = kindFor({ stage: journey.stage as Stage, missed: true }, (journey.next_step as NextStepType | null) ?? null);
  if (!slot || !partner || slot.taken || partner.kind !== kind || new Date(slot.starts_at) <= new Date()) {
    return { ok: false, message: "That time is no longer available. Suggest another." };
  }

  const slotLabel = formatSlot(slot.starts_at);
  await sendBookingLink(admin, journeyId, (url, m) => m.rescheduleOffer(partner.name, slotLabel, `${url}?pick=${slot.id}`), "SMS");
  await admin.rpc("log_journey_event", {
    p_journey: journeyId,
    p_event: "RESCHEDULE_OFFER_SENT",
    p_actor: actor.id,
    p_actor_role: actor.role,
    p_detail: { partner: partner.name, slot: slotLabel },
  });
  return { ok: true, place: partner.name, slotLabel };
}

/**
 * Runs the moment a visit is marked missed. The patient is sent a suggested new time at once (the earliest open slot at
 * the same kind of place; code picks it and the AI helper only phrases the reason), with a link that opens with that time
 * selected. Nothing is booked until the patient confirms. If no time is open, or anything goes wrong, the patient gets the
 * plain "choose a new time" link instead, so a missed visit is never left without a message.
 */
export async function notifyMissed(
  admin: SupabaseClient,
  journeyId: string,
  actor: { id: string | null; role: string },
): Promise<"offer" | "link"> {
  try {
    const { data: row } = await admin.from("journeys").select("stage, missed, next_step, patients(language)").eq("id", journeyId).maybeSingle();
    if (row?.missed) {
      const patient = row.patients as unknown as { language?: string } | null;
      const offer = await suggestForMissed(
        admin,
        {
          stage: row.stage as Stage,
          nextStep: (row.next_step as NextStepType | null) ?? null,
          language: patient?.language === "hi" ? "hi" : "en",
        },
        await aiDeps(admin, hashToken(`missed:${journeyId}`).slice(0, 16)),
      );
      if (offer && (await sendRescheduleOffer(admin, journeyId, offer.slotId, actor)).ok) return "offer";
    }
  } catch {
    // fall through to the plain link
  }
  await sendBookingLink(admin, journeyId, (url, m) => m.missed(url), "SMS");
  return "link";
}
