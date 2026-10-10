import Link from "next/link";
import { redirect } from "next/navigation";
import { Stethoscope, FlaskConical, Microscope, ClipboardList, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ROLE_HOME, ROLE_LABEL, safeNext, STAFF_ROLES, type StaffRole } from "@/lib/auth/roles";
import { getStaffUser } from "@/lib/auth/session";
import { demoLogin } from "./actions";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const ROLE_ICON: Record<StaffRole, typeof Stethoscope> = {
  doctor: Stethoscope,
  clinician: ClipboardList,
  lab: FlaskConical,
  centre: Microscope,
  ops: Users,
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getStaffUser();
  if (user) redirect(ROLE_HOME[user.role]);

  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw) ?? "";
  const demo = process.env.DEMO_LOGINS === "on";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Link href="/" className="w-fit" aria-label="Liv2care home">
        <Logo size="lg" />
      </Link>

      <Card className="flex flex-col gap-5">
        <div>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>For doctors, clinicians, labs, centres and operations staff.</CardDescription>
        </div>
        <LoginForm next={next} />
      </Card>

      {demo && (
        <Card aria-labelledby="demo-heading" className="flex flex-col gap-3 bg-secondary/60">
          <div>
            <h2 id="demo-heading" className="font-heading font-extrabold">
              Try a demo account
            </h2>
            <CardDescription>Fake data. One click signs you in as that role.</CardDescription>
          </div>
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
        </Card>
      )}
    </main>
  );
}
