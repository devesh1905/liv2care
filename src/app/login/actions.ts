"use server";

import { redirect } from "next/navigation";
import { isStaffRole, ROLE_HOME, safeNext, STAFF_ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

// Demo accounts (fake data), used only when DEMO_LOGINS=on. Locally they are the seeded accounts in supabase/seed.sql.
// On a hosted site the shared demo password must come from DEMO_PASSWORD (set it in Vercel, never in the repo).
const LOCAL_DEMO_PASSWORD = "demo-liv2care-only";

function demoPassword(): string | null {
  if (process.env.DEMO_PASSWORD) return process.env.DEMO_PASSWORD;
  return process.env.NODE_ENV === "production" ? null : LOCAL_DEMO_PASSWORD;
}

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
  if (process.env.DEMO_LOGINS !== "on") return;
  const role = String(form.get("role") ?? "");
  if (!(STAFF_ROLES as readonly string[]).includes(role)) return;
  const password = demoPassword();
  if (!password) redirect("/login?demo=unavailable");
  const error = await signIn(`${role}@demo.liv2care.test`, password, null);
  if (error) redirect("/login?demo=failed");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
