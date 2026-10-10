import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartnerKind, SlotOption } from "@/lib/logistics/types";

/** Open future slots at partners of one kind, up to `perPartner` each. Logistics data only. */
export async function loadSlotOptions(admin: SupabaseClient, kind: PartnerKind, perPartner = 6): Promise<SlotOption[]> {
  const { data: partners, error } = await admin.from("partners").select("id, name, area, distance_km").eq("kind", kind).order("distance_km");
  if (error) throw error;

  const nowIso = new Date().toISOString();
  const lists = await Promise.all(
    (partners ?? []).map(async (p) => {
      const { data: slots, error: slotError } = await admin
        .from("slots")
        .select("id, starts_at")
        .eq("partner_id", p.id)
        .eq("taken", false)
        .gt("starts_at", nowIso)
        .order("starts_at")
        .limit(perPartner);
      if (slotError) throw slotError;
      return (slots ?? []).map(
        (s): SlotOption => ({
          partnerId: p.id,
          partnerName: p.name,
          area: p.area,
          distanceKm: Number(p.distance_km),
          slotId: s.id,
          startsAt: s.starts_at,
        }),
      );
    }),
  );
  return lists.flat();
}
