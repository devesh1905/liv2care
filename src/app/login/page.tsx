import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoLogins } from "@/components/demo-logins";
import { Logo } from "@/components/logo";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ROLE_HOME, safeNext } from "@/lib/auth/roles";
import { getStaffUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getStaffUser();
  if (user) redirect(ROLE_HOME[user.role]);

  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw) ?? "";
  const demo = process.env.DEMO_LOGINS === "on";
  const demoProblem = (await searchParams).demo;

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

      {demoProblem && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
          {demoProblem === "unavailable" ? "Demo sign-in is not set up on this site." : "The demo account could not sign in. Please tell the team."}
        </p>
      )}

      {demo && (
        <Card aria-labelledby="demo-heading" className="flex flex-col gap-3 bg-secondary/60">
          <div>
            <h2 id="demo-heading" className="font-heading font-extrabold">
              Try a demo account
            </h2>
            <CardDescription>Fake data. One click signs you in as that role.</CardDescription>
          </div>
          <DemoLogins />
        </Card>
      )}
    </main>
  );
}
