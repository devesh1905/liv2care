import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { ROLE_BLURB, ROLE_ICON } from "@/components/demo-roles";
import { ROLE_LABEL, STAFF_ROLES } from "@/lib/auth/roles";

export const metadata = { title: "Demo access" };

/**
 * Demo access for reviewers: one link per person. Each opens that person's own sign-in page, where the visitor types the
 * demo password for that account (the team gives it out; it is never shown here). Hidden unless DEMO_LOGINS=on.
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
          Everything here uses pretend patients and pretend messages, so nothing is real and nothing is sent. Pick who you want to be. You
          will be asked for that role&apos;s demo password (ask the team for it).
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STAFF_ROLES.map((role) => {
          const Icon = ROLE_ICON[role];
          return (
            <li key={role}>
              <Link
                href={`/demo/${role}`}
                className="flex h-full flex-col items-start gap-1.5 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <span className="flex items-center gap-2 font-heading text-base font-semibold">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  {ROLE_LABEL[role]}
                </span>
                <span className="text-sm text-muted-foreground">{ROLE_BLURB[role]}</span>
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
