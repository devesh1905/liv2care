import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, ROLE_HOME, type StaffRole } from "./roles";

export type StaffUser = {
  id: string;
  email: string | undefined;
  role: StaffRole;
  displayName: string;
  partnerId: string | null;
};

/**
 * The signed-in staff member, or null. The session token's signature is checked (getClaims verifies it with the project's
 * signing keys, without a round trip to Supabase Auth on every page); the database still applies row-level security to
 * every query, so a token alone never grants access to data.
 */
export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  // profiles is readable by any signed-in user under row-level security.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, partner_id")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!profile || !isStaffRole(profile.role)) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    role: profile.role,
    displayName: profile.display_name,
    partnerId: profile.partner_id,
  };
});

/** Page guard: sends signed-out users to /login and other roles to their own page. */
export async function requireRole(...allowed: StaffRole[]): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) redirect("/login");
  if (!allowed.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
