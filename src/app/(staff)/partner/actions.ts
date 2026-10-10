"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { transitionJourney } from "@/lib/journey/server";
import { sendBookingLink } from "@/lib/booking/notify";
import { templates } from "@/lib/messages/templates";
import { checkPdf } from "@/lib/reports/pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PartnerState = { error?: string; success?: string };

/**
 * Every action revalidates up front, even when it ends in an error. Without it, Next 16.4 fails to re-render the
 * layout after an action that returns without revalidating (InvariantError on the cookies store).
 */
function refreshPage() {
  revalidatePath("/partner");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The lab uploads the lab report; the centre uploads the FibroScan report. */
export async function uploadReport(_prev: PartnerState, form: FormData): Promise<PartnerState> {
  const user = await requireRole("lab", "centre");
  refreshPage();
  const journeyId = String(form.get("journeyId") ?? "");
  if (!UUID.test(journeyId) || !user.partnerId) return { error: "Unknown visit." };

  const file = form.get("report");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the report PDF." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkPdf(bytes, file.name);
  if (!checked.ok) return { error: checked.message };

  // Uploaded as this user: the storage policy allows it only for journeys booked at their own partner.
  const supabase = await createClient();
  const storagePath = `journeys/${journeyId}/${randomUUID()}.pdf`;
  const up = await supabase.storage.from("reports").upload(storagePath, bytes, { contentType: "application/pdf" });
  if (up.error) return { error: "That visit is not booked at your site, or the upload failed." };

  const { data: partner } = await supabase.from("partners").select("name").eq("id", user.partnerId).maybeSingle();
  const result = await transitionJourney(
    journeyId,
    { type: user.role === "lab" ? "LAB_UPLOAD" : "CENTRE_UPLOAD" },
    { id: user.id, role: user.role },
    { partner: partner?.name ?? "" },
    { report: { kind: user.role === "lab" ? "lab" : "fibroscan", partnerId: user.partnerId, storagePath, fileName: checked.safeName } },
  );
  if (!result.ok) {
    await createAdminClient().storage.from("reports").remove([storagePath]);
    return { error: result.error.message };
  }
  return {
    success:
      user.role === "lab"
        ? "Report uploaded. It is now in the clinician's queue."
        : "FibroScan report uploaded. It is now with the treating doctor.",
  };
}

async function simpleEvent(form: FormData, type: "MARK_MISSED" | "MARK_ATTENDED"): Promise<PartnerState> {
  const user = await requireRole("lab", "centre");
  refreshPage();
  const journeyId = String(form.get("journeyId") ?? "");
  if (!UUID.test(journeyId)) return { error: "Unknown visit." };

  // Only a visit booked at this partner (row-level security hides every other journey).
  const supabase = await createClient();
  const { data: visible } = await supabase.from("journeys").select("id").eq("id", journeyId).maybeSingle();
  if (!visible) return { error: "That visit is not booked at your site." };

  const result = await transitionJourney(journeyId, { type }, { id: user.id, role: user.role });
  if (!result.ok) return { error: result.error.message };

  if (type === "MARK_MISSED") {
    await sendBookingLink(createAdminClient(), journeyId, templates.missed, "SMS");
  }
  return { success: type === "MARK_MISSED" ? "Marked missed. A reschedule message was sent (simulated)." : "Visit marked attended." };
}

export async function markMissed(_prev: PartnerState, form: FormData) {
  return simpleEvent(form, "MARK_MISSED");
}

export async function markAttended(_prev: PartnerState, form: FormData) {
  return simpleEvent(form, "MARK_ATTENDED");
}

/** Opens a slot at the user's own lab or centre. Row-level security restricts it to their partner. */
export async function addSlot(_prev: PartnerState, form: FormData): Promise<PartnerState> {
  const user = await requireRole("lab", "centre");
  refreshPage();
  // The picker gives a local time without a zone; clinics are in India, so read it as IST.
  const when = new Date(`${String(form.get("startsAt") ?? "")}+05:30`);
  if (!user.partnerId || Number.isNaN(when.getTime())) return { error: "Choose a date and time." };
  if (when.getTime() < Date.now()) return { error: "Choose a time in the future." };

  const supabase = await createClient();
  const { error } = await supabase.from("slots").insert({ partner_id: user.partnerId, starts_at: when.toISOString() });
  if (error) return { error: error.code === "23505" ? "That slot already exists." : "The slot could not be added." };
  return { success: "Slot added." };
}

export async function removeSlot(_prev: PartnerState, form: FormData): Promise<PartnerState> {
  await requireRole("lab", "centre");
  refreshPage();
  const id = String(form.get("slotId") ?? "");
  if (!UUID.test(id)) return { error: "Unknown slot." };
  const supabase = await createClient();
  const { error } = await supabase.from("slots").delete().eq("id", id).eq("taken", false);
  if (error) return { error: "The slot could not be removed." };
  return {};
}
