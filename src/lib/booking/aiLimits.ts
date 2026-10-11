import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SuggestDeps } from "@/lib/logistics/suggest";

/** Most model calls one caller (a booking link, or one patient on the operations screen) may make in a minute. */
export const BURST_MAX = 6;

/**
 * The limits around the AI helper, kept in the database so they hold across servers: a daily budget for the whole app
 * and a smaller one per caller (set up inside `suggest()`), plus this short-burst limit. Over the burst limit the model is
 * skipped and the plain suggestion is still returned, so nobody is blocked from booking.
 */
export async function aiDeps(admin: SupabaseClient, callerKey: string, now: Date = new Date()): Promise<SuggestDeps> {
  const consume = async (key: string, cap: number) => {
    const { data, error } = await admin.rpc("ai_consume", { p_key: key, p_cap: cap });
    return !error && data === true;
  };
  const minute = now.toISOString().slice(0, 16);
  if (!(await consume(`burst:${callerKey}:${minute}`, BURST_MAX))) return { apiKey: "" };
  return { consume, callerKey };
}
