import "server-only";
import type { Lang } from "@/lib/i18n/patient";
import { stateOf } from "@/lib/journey/derived";
import type { Stage } from "@/lib/journey/stages";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBookingLink } from "./links";

export type TimelineView =
  | { kind: "invalid" }
  | {
      kind: "ready";
      language: Lang;
      firstName: string;
      stage: Stage;
      missed: boolean;
      /** The patient has been asked to send an existing lab report. */
      awaitingReport: boolean;
      /** The upcoming appointment, if one is booked. Place and time only. */
      appointment: { place: string; slot: string } | null;
    };

/**
 * What the patient sees at /patient/<token>. Reads stage, name, language and the booked place and time, and nothing
 * else: no reports, reviews, decisions or decline reasons are ever loaded for this page.
 */
export async function loadTimelineView(token: string): Promise<TimelineView> {
  const admin = createAdminClient();
  const journeyId = await resolveBookingLink(admin, token, "view");
  if (!journeyId) return { kind: "invalid" };

  const [{ data: journey }, { data: booking }] = await Promise.all([
    admin.from("journeys").select("stage, missed, route, patients(name, language)").eq("id", journeyId).maybeSingle(),
    admin
      .from("bookings")
      .select("slot_label, partners(name)")
      .eq("journey_id", journeyId)
      .eq("status", "booked")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const patient = journey?.patients as unknown as { name: string; language: string } | null;
  if (!journey || !patient) return { kind: "invalid" };

  const partner = booking?.partners as unknown as { name: string } | null;
  return {
    kind: "ready",
    language: patient.language === "hi" ? "hi" : "en",
    firstName: patient.name.split(" ")[0],
    stage: journey.stage as Stage,
    missed: journey.missed,
    awaitingReport: stateOf(journey).awaitingReport === true,
    appointment: booking && partner ? { place: partner.name, slot: booking.slot_label ?? "" } : null,
  };
}
