import { timingSafeEqual } from "node:crypto";
import { sendOverdueReminders } from "@/lib/ops/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

/** Constant-time comparison so the secret cannot be guessed from response timing. */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily job (see vercel.json): reminds patients whose action is overdue. Vercel calls it with
 * `Authorization: Bearer <CRON_SECRET>`. With no CRON_SECRET set the job is off, and anything else gets a 401.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "The reminder job is not configured." }, { status: 503 });

  const header = request.headers.get("authorization") ?? "";
  if (!sameSecret(header, `Bearer ${secret}`)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const run = await sendOverdueReminders(createAdminClient(), { id: "reminder-job", role: "system" }, new Date().getTime());
  return Response.json(run);
}
