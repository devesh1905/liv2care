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

/**
 * One-click sign-in with the seeded local accounts, for development and the browser tests only. It is never shown on a
 * production build, and the action behind it refuses to run there.
 */
export function LocalDemoLogins() {
  if (process.env.DEMO_LOGINS !== "on" || process.env.NODE_ENV === "production") return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {STAFF_ROLES.map((role) => {
        const Icon = ROLE_ICON[role];
        return (
          <form key={role} action={demoLogin}>
            <input type="hidden" name="role" value={role} />
            <Button type="submit" variant="outline" className="w-full justify-start">
              <Icon aria-hidden="true" />
              {ROLE_LABEL[role]}
            </Button>
          </form>
        );
      })}
    </div>
  );
}
