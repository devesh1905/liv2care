import { ArrowRight, CalendarCheck, Check, ClipboardList, FileCheck2, MessageSquareText, ShieldCheck, Stethoscope } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: Stethoscope,
    title: "Doctor decides",
    text: "The treating doctor picks the patient and the route: use an existing lab report, or order the preset tests.",
  },
  {
    icon: ClipboardList,
    title: "Liv2care coordinates",
    text: "Reports reach a licensed clinician, appointments are booked and tracked, and every step is logged.",
  },
  {
    icon: CalendarCheck,
    title: "Patient completes",
    text: "The patient books a nearby lab or centre from a simple link, in their own language.",
  },
  {
    icon: FileCheck2,
    title: "Doctor sees the outcome",
    text: "The doctor reviews the report and picks the next step. Nothing is left without an owner.",
  },
];

/** An invented example for the hero card: one patient moving between the five people who look after them. */
const journey = [
  { who: "Treating doctor", what: "Orders the blood tests", state: "done" },
  { who: "Lab", what: "Collects at home, uploads the report", state: "done" },
  {
    who: "Telemedicine clinician",
    what: "Sends FIB-4 and a summary",
    state: "done",
  },
  { who: "Treating doctor", what: "Approves a FibroScan", state: "now" },
  {
    who: "Diagnostic centre",
    what: "Scan booked by the patient",
    state: "next",
  },
] as const;

const safeguards = [
  {
    title: "No diagnosis by software",
    text: "The clinician types FIB-4 and the summary. The app never calculates a score or applies a threshold.",
  },
  {
    title: "AI for logistics only",
    text: "The AI helper sees language, area and open slots. Lab values never reach it.",
  },
  {
    title: "A trail for every step",
    text: "Every stage change and every report action records who did what, and when.",
  },
  {
    title: "Access by role",
    text: "The database itself decides who can see a report. Hiding a button is never the safeguard.",
  },
];

export default function Home() {
  const demo = process.env.DEMO_LOGINS === "on";
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          {demo && (
            <Button render={<Link href="/demo" />} variant="ghost" size="sm">
              Demo access
            </Button>
          )}
          <Button render={<a href="/login" />} variant="outline" size="sm">
            Staff sign in
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mesh-bg mesh-drift relative overflow-hidden border-b">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:py-24">
            <div className="flex flex-col gap-8">
              <p className="inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-bold tracking-wide text-primary shadow-sm">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Health-a-thon 2026 · Team LIVACARE
              </p>
              <h1 className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-6xl">
                Closing the loop on liver-risk care in type 2 diabetes
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Liv2care is an EHR-independent coordination platform. The doctor decides, Liv2care coordinates, the patient completes, and the doctor sees the
                outcome.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button render={<a href="/login" />} size="lg">
                  Staff sign in
                  <ArrowRight aria-hidden="true" />
                </Button>
                {demo ? (
                  <Button render={<Link href="/demo" />} variant="outline" size="lg">
                    Try the demo
                  </Button>
                ) : (
                  <Button render={<a href="#who" />} variant="outline" size="lg">
                    Who is it for?
                  </Button>
                )}
              </div>
            </div>

            <figure className="glass rise-in rounded-3xl p-6" aria-labelledby="journey-title">
              <figcaption className="mb-5 flex items-center justify-between gap-3">
                <span id="journey-title" className="font-heading text-lg font-extrabold">
                  One patient&apos;s journey
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-primary">Example</span>
              </figcaption>
              <div className="relative">
                <span aria-hidden="true" className="blueprint-line-v draw-y absolute top-3 bottom-3 left-[15px] w-0.5 opacity-60" />
                <ol className="flex flex-col gap-5">
                  {journey.map((step, i) => (
                    <li key={i} className="relative flex items-start gap-4">
                      <span
                        aria-hidden="true"
                        className={
                          step.state === "done"
                            ? "grid size-8 shrink-0 place-items-center rounded-full bg-ok text-white"
                            : step.state === "now"
                              ? "grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-primary/20 motion-safe:animate-pulse"
                              : "grid size-8 shrink-0 place-items-center rounded-full border-2 border-dashed border-primary/50 bg-card"
                        }
                      >
                        {step.state === "done" ? <Check className="size-4" strokeWidth={3} /> : <span className="size-2 rounded-full bg-current" />}
                      </span>
                      <span className="flex flex-col">
                        <span className="font-heading font-extrabold">{step.who}</span>
                        <span className="text-sm text-muted-foreground">
                          {step.what}
                          <span className="sr-only">{step.state === "done" ? " (done)" : step.state === "now" ? " (now)" : " (next)"}</span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </figure>
          </div>
        </section>

        <section aria-labelledby="who" className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6">
          <h2 id="who" className="font-heading text-2xl font-extrabold sm:text-3xl">
            Who is it for?
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-card">
              <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
                <Stethoscope className="size-5" />
              </span>
              <h3 className="font-heading text-xl font-extrabold">For doctors and care teams</h3>
              <p className="text-muted-foreground">
                Pick a patient with type 2 diabetes, choose the route, and see the whole liver-check pathway on one page: tests, clinician review, your
                decision, the FibroScan and follow-up. Anything overdue is flagged, and every step is logged.
              </p>
              <div>
                <Button render={<a href="/login" />}>
                  Staff sign in
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            </article>
            <article className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-card">
              <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
                <MessageSquareText className="size-5" />
              </span>
              <h3 className="font-heading text-xl font-extrabold">For patients</h3>
              <p className="text-muted-foreground">
                There is nothing to download and no account to make. Your doctor sends you a text message with a private link. Open it to pick a nearby lab or
                centre and a time that suits you, in English or Hindi, and to see where you are in the process.
              </p>
              <p className="text-sm text-muted-foreground">
                Have a message from your doctor? Open the link in it. If it has expired, ask your doctor&apos;s office for a new one.
              </p>
            </article>
          </div>
        </section>

        <section aria-labelledby="pathway" className="blueprint-grid mt-14 border-y">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <h2 id="pathway" className="font-heading text-2xl font-extrabold sm:text-3xl">
              One pathway, four owners
            </h2>
            <div className="relative mt-8">
              {/* blueprint connector: across the cards on wide screens, down the side on phones */}
              <span aria-hidden="true" className="blueprint-line draw-x absolute top-[2.85rem] right-[12%] left-[12%] hidden h-0.5 lg:block" />
              <span aria-hidden="true" className="blueprint-line-v draw-y absolute top-8 bottom-8 left-[2.6rem] w-0.5 sm:hidden" />
              <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {steps.map(({ icon: Icon, title, text }, i) => (
                  <li key={title} className="glass relative flex flex-col gap-3 rounded-xl p-5">
                    <span className="flex items-center justify-between">
                      <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
                        <Icon className="size-5" />
                      </span>
                      <span aria-hidden="true" className="font-heading text-sm font-extrabold text-muted-foreground">
                        0{i + 1}
                      </span>
                    </span>
                    <h3 className="font-heading text-lg font-extrabold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section aria-labelledby="problem" className="border-b bg-card">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 id="problem" className="font-heading text-2xl font-extrabold sm:text-3xl">
                The tests exist. The follow-through does not.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Guidelines recommend a fibrosis-risk check in type 2 diabetes. In real care, patients fall between the lab, the clinical review, the referral
                and the follow-up.
              </p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-secondary/60 p-5">
                <dt className="font-heading text-4xl font-extrabold text-primary">0.95%</dt>
                <dd className="mt-2 text-sm text-muted-foreground">
                  of 11,980 primary-care patients with an indeterminate or high-risk FIB-4 had elastography. Xiao et al., J Gen Intern Med, 2024.
                </dd>
              </div>
              <div className="rounded-xl bg-secondary/60 p-5">
                <dt className="font-heading text-4xl font-extrabold text-primary">&lt; 3%</dt>
                <dd className="mt-2 text-sm text-muted-foreground">
                  of 188 patients with fatty liver disease and an abnormal FIB-4 were referred for elastography or to hepatology. Spann et al., Hepatol Commun,
                  2023.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section aria-labelledby="safeguards" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <h2 id="safeguards" className="font-heading text-2xl font-extrabold sm:text-3xl">
            Built so the software never practises medicine
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {safeguards.map((s) => (
              <li key={s.title} className="flex gap-3 rounded-xl border bg-card p-5">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
                <div>
                  <h3 className="font-heading font-extrabold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <Logo />
          <p>Demo build. Fake patients and simulated messages only.</p>
        </div>
      </footer>
    </div>
  );
}
