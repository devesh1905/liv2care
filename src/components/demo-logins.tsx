import { ClipboardList, FlaskConical, Microscope, Stethoscope, Users } from "lucide-react";
import { demoLogin } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
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

/** One-click sign-in for each person, using the demo accounts. Shown only when DEMO_LOGINS=on; fake data only. */
export function DemoLogins() {
  if (process.env.DEMO_LOGINS !== "on") return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {STAFF_ROLES.map((role) => {
        const Icon = ROLE_ICON[role];
        return (
          <form key={role} action={demoLogin}>
            <input type="hidden" name="role" value={role} />
            <Button type="submit" variant="outline" className="h-full w-full flex-col items-start justify-start gap-1.5 whitespace-normal p-4 text-left">
              <span className="flex items-center gap-2 text-base">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                {ROLE_LABEL[role]}
              </span>
              <span className="font-sans text-sm font-normal text-muted-foreground">{ROLE_BLURB[role]}</span>
            </Button>
          </form>
        );
      })}
    </div>
  );
}
