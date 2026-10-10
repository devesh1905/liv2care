import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendBookingLink } from "@/lib/booking/notify";
import { transitionJourney } from "@/lib/journey/server";
import type { Actor } from "@/lib/journey/types";
import { templates } from "@/lib/messages/templates";
import { pickReminders } from "./pick";

/** At most this many reminders in one run, so a backlog can never turn into a flood of messages. */
export const MAX_REMINDERS_PER_RUN = 100;

export type ReminderRun = { sent: number; skipped: number };

/**
 * Reminds every patient whose pending action is overdue. Sending a reminder restarts the 24 hour clock on the action
 * (the transition replaces the pending task), so the same patient is not reminded again until it is overdue again.
 * Logistics only: the message names no results and no clinical step.
 */
export async function sendOverdueReminders(admin: SupabaseClient, actor: Actor, nowMs: number): Promise<ReminderRun> {
  const { data, error } = await admin
    .from("tasks")
    .select("journey_id, owner, due_at")
    .is("done_at", null)
    .lt("due_at", new Date(nowMs).toISOString())
    .order("due_at")
    .limit(MAX_REMINDERS_PER_RUN * 3);
  if (error) throw error;

  const journeyIds = pickReminders(data ?? [], nowMs).slice(0, MAX_REMINDERS_PER_RUN);
  let sent = 0;
  let skipped = 0;
  for (const journeyId of journeyIds) {
    const result = await transitionJourney(journeyId, { type: "SEND_REMINDER" }, actor);
    if (!result.ok) {
      skipped += 1; // closed meanwhile, or the state moved
      continue;
    }
    await sendBookingLink(admin, journeyId, templates.reminder, "SMS");
    sent += 1;
  }
  return { sent, skipped };
}
