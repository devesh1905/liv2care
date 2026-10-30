import { LogIn } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { quickDemoSignIn } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ROLE_BLURB, ROLE_ICON } from "@/components/demo-roles";
import { ROLE_LABEL, STAFF_ROLES } from "@/lib/auth/roles";
import { FailedNotice } from "./failed-notice";

export const metadata = { title: "Demo access" };

/**
 * Demo access for reviewers: one button per person signs straight in as that demo account (no password to type). Each card
 * also links to that account's password page. Hidden unless DEMO_LOGINS=on.
 */
export default function DemoIndex() {
  if (process.env.DEMO_LOGINS !== "on") notFound();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <Link href="/" className="w-fit" aria-label="Liv2care home">
        <Logo size="lg" />
      </Link>

      <div>
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">Try the demo</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Everything here uses pretend patients and pretend messages, so nothing is real and nothing is sent. Pick who you want to be: one
          click signs you in. Sign out from the top of any page to switch to another person.
        </p>
      </div>

      <Suspense fallback={null}>
        <FailedNotice />
      </Suspense>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STAFF_ROLES.map((role) => {
          const Icon = ROLE_ICON[role];
          return (
            <li key={role} className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
              <span className="flex items-center gap-2 font-heading text-base font-semibold">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                {ROLE_LABEL[role]}
              </span>
              <span className="flex-1 text-sm text-muted-foreground">{ROLE_BLURB[role]}</span>
              <form action={quickDemoSignIn}>
                <input type="hidden" name="role" value={role} />
                <Button type="submit" className="w-full">
                  <LogIn aria-hidden="true" />
                  Sign in as {ROLE_LABEL[role]}
                </Button>
              </form>
              <Link href={`/demo/${role}`} className="w-fit text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground">
                Use the password instead
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="rounded-2xl border bg-secondary/60 p-5 sm:p-6">
        <h2 className="font-heading text-lg font-extrabold">The patient has no login</h2>
        <p className="mt-2 text-sm sm:text-base">
          After the doctor enrols a pretend patient and orders tests, a link appears to open the patient&apos;s own page. There they pick a
          lab and a time, in English or Hindi, and follow a simple progress page.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Tip: start as the doctor and add a patient, then sign out and come back as the other roles to follow that patient along.
        </p>
      </div>
    </main>
  );
}
