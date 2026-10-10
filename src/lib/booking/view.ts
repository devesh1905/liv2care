import "server-only";
import type { Lang } from "@/lib/i18n/patient";
import type { PartnerKind, SlotOption } from "@/lib/logistics/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBookingContext } from "./book";
import { loadSlotOptions } from "./options";

export type BookingView =
  | { kind: "invalid" }
  | { kind: "nothing" }
  | { kind: "booked"; language: Lang; partnerName: string; slotLabel: string }
  | { kind: "ready"; language: Lang; firstName: string; partnerKind: PartnerKind; reschedule: boolean; options: SlotOption[] };

/** What the patient sees at /book/<token>. Reads logistics data only. */
export async function loadBookingView(token: string): Promise<BookingView> {
  const admin = createAdminClient();
  const ctx = await loadBookingContext(admin, token);
  if (!ctx) return { kind: "invalid" };

  if (!ctx.bookable) {
    const { data } = await admin
      .from("bookings")
      .select("slot_label, partners(name)")
      .eq("journey_id", ctx.journeyId)
      .eq("status", "booked")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const partner = data?.partners as unknown as { name: string } | null;
    return data && partner
      ? { kind: "booked", language: ctx.patient.language, partnerName: partner.name, slotLabel: data.slot_label ?? "" }
      : { kind: "nothing" };
  }

  return {
    kind: "ready",
    language: ctx.patient.language,
    firstName: ctx.patient.firstName,
    partnerKind: ctx.kind,
    reschedule: ctx.event === "RESCHEDULE",
    options: await loadSlotOptions(admin, ctx.kind),
  };
}
