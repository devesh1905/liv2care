import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { startJourney } from "@/lib/journey/start";
import { sendOverdueReminders } from "./reminders";

/** The overdue-reminder job on the real database (needs `npx supabase start`). */
const DOCTOR = { id: "00000000-0000-4000-8000-000000000001", role: "doctor" } as const;
const JOB = { id: "reminder-job", role: "system" } as const;

let admin: SupabaseClient;

beforeAll(() => {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // CI passes the variables directly
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the integration tests");
  admin = createClient(url, key, { auth: { persistSession: false } });
});

async function newJourney() {
  const journeyId = randomUUID();
  const r = await startJourney(admin, DOCTOR, {
    journeyId,
    name: "Reminder Person",
    age: 50,
    phoneMasked: "98•••• 0000",
    language: "en",
    route: "order_tests",
    ultrasound: false,
    consentScope: "Pathway",
  });
  expect(r.ok).toBe(true);
  return journeyId;
}

const makeOverdue = (journeyId: string, owner?: string) =>
  admin
    .from("tasks")
    .update({ due_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), ...(owner ? { owner } : {}) })
    .eq("journey_id", journeyId)
    .is("done_at", null);

describe("sendOverdueReminders", () => {
  it("reminds an overdue patient once, restarts the clock, and records the system as the actor", async () => {
    const journeyId = await newJourney();
    await makeOverdue(journeyId);

    const first = await sendOverdueReminders(admin, JOB, Date.now());
    expect(first.sent).toBeGreaterThanOrEqual(1);

    const { data: event } = await admin.from("journey_events").select("actor_role, actor_id").eq("journey_id", journeyId).eq("event", "SEND_REMINDER").single();
    expect(event).toEqual({ actor_role: "system", actor_id: null });
    const { data: msg } = await admin.from("messages").select("channel, body").eq("journey_id", journeyId).like("body", "Reminder:%").single();
    expect(msg!.channel).toBe("SMS");
    expect(msg!.body).toMatch(/\/book\//);

    const { data: task } = await admin.from("tasks").select("due_at").eq("journey_id", journeyId).is("done_at", null).single();
    expect(new Date(task!.due_at).getTime()).toBeGreaterThan(Date.now());

    // the clock restarted, so a second run does not remind this patient again
    await sendOverdueReminders(admin, JOB, Date.now());
    const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("journey_id", journeyId).like("body", "Reminder:%");
    expect(count).toBe(1);
  });

  it("never messages the patient about an action that belongs to staff", async () => {
    const journeyId = await newJourney();
    await makeOverdue(journeyId, "Lab");

    await sendOverdueReminders(admin, JOB, Date.now());
    const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("journey_id", journeyId).like("body", "Reminder:%");
    expect(count).toBe(0);
  });
});
