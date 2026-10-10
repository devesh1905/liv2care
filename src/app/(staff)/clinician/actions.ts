"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { transitionJourney } from "@/lib/journey/server";
import { createClient } from "@/lib/supabase/server";

export type ReviewState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Sends the clinician's review to the treating doctor. FIB-4 and the summary are exactly what the clinician typed:
 * nothing is calculated, suggested or checked against a threshold here.
 */
export async function submitReview(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const user = await requireRole("clinician");
  // Revalidate up front: Next 16.4 fails to re-render the layout after an action that returns without revalidating.
  revalidatePath("/clinician");

  const journeyId = String(form.get("journeyId") ?? "");
  const fib4Text = String(form.get("fib4") ?? "").trim();
  const summary = String(form.get("summary") ?? "").trim();
  const recommendsVcte = form.get("recommends") === "on";

  if (!UUID.test(journeyId)) return { error: "Unknown journey." };
  if (!fib4Text) return { error: "Type the FIB-4 value." };
  if (fib4Text.length > 40) return { error: "The FIB-4 field is too long. Type the value only." };
  if (!summary) return { error: "Write the clinical summary." };
  if (summary.length > 4000) return { error: "The summary is longer than 4,000 characters." };

  // Row-level security: only a journey in this clinician's queue (or already theirs) is visible.
  const supabase = await createClient();
  const { data: visible } = await supabase.from("journeys").select("id").eq("id", journeyId).maybeSingle();
  if (!visible) return { error: "That journey is not in your queue." };

  const result = await transitionJourney(
    journeyId,
    { type: "CLINICIAN_SUBMIT", summaryWritten: true },
    { id: user.id, role: "clinician" },
    { recommends_vcte: recommendsVcte },
    { review: { fib4Text, summary, recommendsVcte } },
  );
  if (!result.ok) return { error: result.error.message };

  redirect("/clinician?notice=sent");
}
