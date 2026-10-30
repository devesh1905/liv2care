import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily keep-alive (see vercel.json). A free Supabase project is paused after about a week with no activity, which takes
 * the whole site down; one tiny read a day keeps it awake. It reads nothing private and returns only "ok", so it needs no secret.
 */
export async function GET() {
  await connection();
  const { error } = await createAdminClient().from("partners").select("id", { head: true, count: "exact" }).limit(1);
  return Response.json({ ok: !error }, { status: error ? 503 : 200 });
}
