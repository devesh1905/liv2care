"use client";

import { useSearchParams } from "next/navigation";
import { isStaffRole, ROLE_LABEL } from "@/lib/auth/roles";

/** Shown when a one-click sign-in did not work, usually because that demo account does not exist on this server. */
export function FailedNotice() {
  const failed = useSearchParams().get("failed");
  if (!isStaffRole(failed)) return null;
  return (
    <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 font-semibold text-bad">
      Could not sign in as {ROLE_LABEL[failed]}. Its demo account may not be set up on this server. Try its password page
      instead, or ask the team.
    </p>
  );
}
