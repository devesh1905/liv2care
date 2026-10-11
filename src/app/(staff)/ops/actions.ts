"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { sendBookingLink } from "@/lib/booking/notify";
import { nextAction } from "@/lib/journey/derived";
import { transitionJourney } from "@/lib/journey/server";
import type { Stage } from "@/lib/journey/stages";
import { sendOverdueReminders } from "@/lib/ops/reminders";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type OpsState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Shared start: the signed-in ops user, an up-front revalidate (see CLAUDE.md), and the journey as ops may see it. */
async function begin(form: FormData) {
  const user = await requireRole("ops");
  revalidatePath("/ops");
  const journeyId = String(form.get("journeyId") ?? "");
  if (!UUID.test(journeyId)) return { error: "Unknown patient." } as const;
  const supabase = await createClient();
  // Operations reads journey_status, never the journeys table.
  const { data } = await supabase.from("journey_status").select("stage, missed").eq("journey_id", journeyId).maybeSingle();
  if (!data) return { error: "That patient is not on the list." } as const;
  return { user, journeyId, state: { stage: data.stage as Stage, missed: data.missed as boolean } } as const;
}

/** Sends the patient a reminder with a fresh booking link, and restarts the clock on the pending action. */
export async function sendReminder(_prev: OpsState, form: FormData): Promise<OpsState> {
  const ctx = await begin(form);
  if ("error" in ctx) return ctx;
  if (nextAction(ctx.state)?.who !== "Patient") return { error: "Only actions waiting for the patient get a reminder." };

  const result = await transitionJourney(ctx.journeyId, { type: "SEND_REMINDER" }, { id: ctx.user.id, role: "ops" });
  if (!result.ok) return { error: result.error.message };
  await sendBookingLink(createAdminClient(), ctx.journeyId, (url, m) => m.reminder(url), "SMS");
  redirect("/ops?notice=reminded");
}

/** The visit did not happen. The patient is sent a link to choose a new time. */
export async function markVisitMissed(_prev: OpsState, form: FormData): Promise<OpsState> {
  const ctx = await begin(form);
  if ("error" in ctx) return ctx;
  const result = await transitionJourney(ctx.journeyId, { type: "MARK_MISSED" }, { id: ctx.user.id, role: "ops" });
  if (!result.ok) return { error: result.error.message };
  await sendBookingLink(createAdminClient(), ctx.journeyId, (url, m) => m.missed(url), "SMS");
  redirect("/ops?notice=missed");
}

/** The same job the daily schedule runs: reminds every patient whose pending action is overdue. */
export async function runOverdueReminders(): Promise<OpsState> {
  const user = await requireRole("ops");
  revalidatePath("/ops");
  const run = await sendOverdueReminders(createAdminClient(), { id: user.id, role: "ops" }, new Date().getTime());
  redirect(`/ops?notice=ran&sent=${run.sent}`);
}
