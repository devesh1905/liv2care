"use server";

import { redirect } from "next/navigation";
import { isStaffRole, ROLE_HOME, safeNext, STAFF_ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

// One-click demo sign-in is for local development and the browser tests only. It uses the seeded account password, which
// is in the repo, so it never runs in production. The hosted demo asks the visitor to type each account's own password.
const LOCAL_DEMO_PASSWORD = "demo-liv2care-only";

async function signIn(email: string, password: string, next: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return "Wrong email or password.";

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!profile || !isStaffRole(profile.role)) {
    await supabase.auth.signOut();
    return "This account has no staff role.";
  }
  redirect(next ?? ROLE_HOME[profile.role]);
}

export type LoginState = { error?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const error = await signIn(email, password, safeNext(String(form.get("next") ?? "")));
  return error ? { error } : {};
}

export async function demoLogin(form: FormData) {
  if (process.env.DEMO_LOGINS !== "on" || process.env.NODE_ENV === "production") return;
  const role = String(form.get("role") ?? "");
  if (!(STAFF_ROLES as readonly string[]).includes(role)) return;
  const error = await signIn(`${role}@demo.liv2care.test`, LOCAL_DEMO_PASSWORD, null);
  if (error) redirect("/login?demo=failed");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
