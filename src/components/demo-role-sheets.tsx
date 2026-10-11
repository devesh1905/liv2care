"use client";

import { ClipboardList, FlaskConical, Microscope, Stethoscope, Users } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { LoginForm } from "@/app/login/login-form";
import { ROLE_LABEL, STAFF_ROLES, type StaffRole } from "@/lib/auth/roles";

const ROLE_ICON: Record<StaffRole, typeof Stethoscope> = {
  doctor: Stethoscope,
  clinician: ClipboardList,
  lab: FlaskConical,
  centre: Microscope,
  ops: Users,
};

/** What each person can do, in plain words, so a visitor can choose where to start. */
const ROLE_BLURB: Record<StaffRole, string> = {
  doctor: "Add a pretend patient, review the clinician's note, approve or decline a FibroScan, and choose the next step.",
  clinician: "Open a patient's report, type the FIB-4 and a short summary, and send it back to the doctor.",
  lab: "Add appointment times, upload a report, and mark visits as attended or missed.",
  centre: "The same for FibroScan visits: upload the scan report and mark the visit.",
  ops: "See every patient, where they are in the journey, and the overall progress numbers.",
};

/**
 * One button per person. Each opens a side panel with that person's sign-in: the email is filled in and the visitor
 * types the demo password for that account (the team gives it out; it is never shown on the site).
 */
export function DemoRoleSheets({ localHint }: { localHint?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {STAFF_ROLES.map((role) => {
        const Icon = ROLE_ICON[role];
        return (
          <Sheet
            key={role}
            title={`Sign in as the ${ROLE_LABEL[role].toLowerCase()}`}
            description={ROLE_BLURB[role]}
            triggerClassName="flex h-full w-full flex-col items-start gap-1.5 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
            trigger={
              <>
                <span className="flex items-center gap-2 font-heading text-base font-semibold">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  {ROLE_LABEL[role]}
                </span>
                <span className="text-sm font-normal text-muted-foreground">{ROLE_BLURB[role]}</span>
              </>
            }
          >
            <LoginForm next="" defaultEmail={`${role}@demo.liv2care.test`} lockEmail />
            <p className="text-sm text-muted-foreground">
              Ask the team for this demo account&apos;s password. Everything here uses pretend patients and pretend messages.
            </p>
            {localHint && <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">{localHint}</p>}
          </Sheet>
        );
      })}
    </div>
  );
}
