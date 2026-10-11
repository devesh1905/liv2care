"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { aiDeps } from "@/lib/booking/aiLimits";
import { hashToken } from "@/lib/booking/links";
import { sendRescheduleOffer, suggestForMissed, type Offer } from "@/lib/booking/reschedule";
import type { Stage } from "@/lib/journey/stages";
import type { NextStepType } from "@/lib/journey/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type SuggestState = { offer?: Offer; error?: string };
export type OfferState = { error?: string };

/** Suggests a new time for a patient who missed a visit. Reads the status view and open slots; nothing clinical. */
export async function suggestReschedule(journeyId: string): Promise<SuggestState> {
  await requireRole("ops");
  if (!UUID.test(journeyId)) return { error: "Unknown patient." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("journey_status")
    .select("stage, missed, next_step, patient_language")
    .eq("journey_id", journeyId)
    .maybeSingle();
  if (!row?.missed) return { error: "That patient has not missed a visit." };

  const admin = createAdminClient();
  const offer = await suggestForMissed(
    supabase,
    { stage: row.stage as Stage, nextStep: (row.next_step as NextStepType | null) ?? null, language: row.patient_language === "hi" ? "hi" : "en" },
    await aiDeps(admin, hashToken(`ops:${journeyId}`).slice(0, 16)),
  );
  return offer ? { offer } : { error: "No open times right now. Ask the place to add slots." };
}

/** Sends the suggestion to the patient. The patient confirms it on the booking page; nothing is booked here. */
export async function sendOffer(_prev: OfferState, form: FormData): Promise<OfferState> {
  const user = await requireRole("ops");
  // Revalidate up front: Next 16.4 fails to re-render the layout after an action that returns without revalidating.
  revalidatePath("/ops");
  const journeyId = String(form.get("journeyId") ?? "");
  const slotId = String(form.get("slotId") ?? "");
  if (!UUID.test(journeyId) || !UUID.test(slotId)) return { error: "Unknown patient or time." };

  const result = await sendRescheduleOffer(createAdminClient(), journeyId, slotId, { id: user.id, role: "ops" });
  if (!result.ok) return { error: result.message };
  redirect("/ops?notice=offered");
}
