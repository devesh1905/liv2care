import type { Role } from "@/lib/journey/types";

/** Staff roles stored in profiles.role. The patient has no account; they use booking links. */
export type StaffRole = Exclude<Role, "patient">;

export const STAFF_ROLES: readonly StaffRole[] = ["doctor", "clinician", "lab", "centre", "ops"];

export const ROLE_LABEL: Record<StaffRole, string> = {
  doctor: "Treating doctor",
  clinician: "Telemedicine clinician",
  lab: "Lab",
  centre: "Diagnostic centre",
  ops: "Operations",
};

/** Where each role lands after sign-in. Labs and centres share /partner. */
export const ROLE_HOME: Record<StaffRole, string> = {
  doctor: "/doctor",
  clinician: "/clinician",
  lab: "/partner",
  centre: "/partner",
  ops: "/ops",
};

/** Roles allowed on each staff area. Database policies are the real gate; this keeps people on their own page. */
export const AREA_ROLES: Record<string, readonly StaffRole[]> = {
  "/doctor": ["doctor"],
  "/clinician": ["clinician"],
  "/partner": ["lab", "centre"],
  "/ops": ["ops"],
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

/** The staff area a path belongs to, or null for public paths. */
export function areaOf(pathname: string): string | null {
  return Object.keys(AREA_ROLES).find((a) => pathname === a || pathname.startsWith(`${a}/`)) ?? null;
}

/** Only same-site relative paths are accepted as a post-login destination. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}
