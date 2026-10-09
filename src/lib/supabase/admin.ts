import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv, supabaseUrl } from "./env";

/**
 * Service-role client: bypasses row-level security. Server only, and only for journey.transition(),
 * start_journey() and the mocked message sender. Never use it to read data on behalf of a page.
 */
export function createAdminClient() {
  return createClient(supabaseUrl(), requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
