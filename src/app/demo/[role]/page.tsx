import Link from "next/link";
import { notFound } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { Logo } from "@/components/logo";
import { ROLE_BLURB, ROLE_ICON } from "@/components/demo-roles";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { isStaffRole, ROLE_LABEL, STAFF_ROLES } from "@/lib/auth/roles";

export function generateStaticParams() {
  return STAFF_ROLES.map((role) => ({ role }));
}

export async function generateMetadata({ params }: PageProps<"/demo/[role]">) {
  const { role } = await params;
  return { title: isStaffRole(role) ? `Demo: ${ROLE_LABEL[role]}` : "Demo access" };
}

/** One person's own sign-in page for the demo. The email is fixed to that role's demo account; the visitor types the password. */
export default async function DemoRolePage({ params }: PageProps<"/demo/[role]">) {
  const { role } = await params;
  if (process.env.DEMO_LOGINS !== "on" || !isStaffRole(role)) notFound();
  const Icon = ROLE_ICON[role];
  const local = process.env.NODE_ENV !== "production";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Link href="/" className="w-fit" aria-label="Liv2care home">
        <Logo size="lg" />
      </Link>

      <Card className="flex flex-col gap-5">
        <div>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Icon className="size-6 text-primary" aria-hidden="true" />
            Sign in as the {ROLE_LABEL[role].toLowerCase()}
          </CardTitle>
          <CardDescription>{ROLE_BLURB[role]}</CardDescription>
        </div>
        <LoginForm next="" defaultEmail={`${role}@demo.liv2care.test`} lockEmail />
        <p className="text-sm text-muted-foreground">
          Ask the team for this demo account&apos;s password. Everything here uses pretend patients and pretend messages.
        </p>
        {local && (
          <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
            Local development only: the seeded demo password is demo-liv2care-only.
          </p>
        )}
      </Card>

      <Link href="/demo" className="w-fit text-sm font-semibold text-primary underline-offset-4 hover:underline">
        Back to all demo roles
      </Link>
    </main>
  );
}
