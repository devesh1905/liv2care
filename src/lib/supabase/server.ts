import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "./env";

/** Supabase client acting as the signed-in user (row-level security applies). For Server Components and Server Functions. */
export async function createClient() {
  // The Supabase client reads the clock while checking the session; keep that out of any prerender.
  const cookieStore = await cookies();
  await connection();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which cannot set cookies. The proxy refreshes the session instead.
        }
      },
    },
  });
}
