import { ArrowRight, CalendarCheck, ClipboardList, FileCheck2, ShieldCheck, Stethoscope } from "lucide-react";
import { DemoLogins } from "@/components/demo-logins";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const steps = [
  { icon: Stethoscope, title: "Doctor decides", text: "The treating doctor picks the patient and the route: use an existing lab report, or order the preset tests." },
  { icon: ClipboardList, title: "Liv2care coordinates", text: "Reports reach a licensed clinician, appointments are booked and tracked, and every step is logged." },
  { icon: CalendarCheck, title: "Patient completes", text: "The patient books a nearby lab or centre from a simple link, in their own language." },
  { icon: FileCheck2, title: "Doctor sees the outcome", text: "The doctor reviews the report and picks the next step. Nothing is left without an owner." },
];

const safeguards = [
  { title: "No diagnosis by software", text: "The clinician types FIB-4 and the summary. The app never calculates a score or applies a threshold." },
  { title: "AI for logistics only", text: "The AI helper sees language, area and open slots. Lab values never reach it." },
  { title: "A trail for every step", text: "Every stage change and every report action records who did what, and when." },
  { title: "Access by role", text: "The database itself decides who can see a report. Hiding a button is never the safeguard." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <Button render={<a href="/login" />} variant="outline" size="sm">
          Staff sign in
        </Button>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b bg-linear-to-b from-secondary/70 to-background">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-bold tracking-wide text-primary shadow-sm">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Health-a-thon 2026 · Team LIVACARE
            </p>
            <h1 className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-6xl">
              Closing the loop on liver-risk care in type 2 diabetes
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Liv2care is an EHR-independent coordination platform. The doctor decides, Liv2care coordinates, the patient completes, and the doctor sees the outcome.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button render={<a href="/login" />} size="lg">
                Staff sign in
                <ArrowRight aria-hidden="true" />
              </Button>
              <Button render={<a href="https://github.com/devesh1905/liv2care-prototype" />} variant="outline" size="lg">
                See the prototype
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="try" className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6">
          <h2 id="try" className="font-heading text-2xl font-extrabold sm:text-3xl">
            Try it yourself
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Everything here uses pretend patients and pretend messages, so nothing is real and nothing is sent. Pick who you want to be and you are signed in with one click.
          </p>
          <div className="mt-6">
            <DemoLogins />
          </div>

          <div className="mt-6 rounded-2xl border bg-secondary/60 p-5 sm:p-6">
            <h3 className="font-heading text-lg font-extrabold">What you can try today</h3>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm sm:text-base">
              <li>
                <strong>The doctor</strong> can add a pretend patient, either by uploading a lab report the patient already has or by ordering the tests. Once the clinician has replied, the doctor can approve or decline a FibroScan and choose what happens next.
              </li>
              <li>
                <strong>The clinician</strong> can open the uploaded report, type the FIB-4 value and a short summary, and send them back to the doctor. The app never works out any result itself.
              </li>
              <li>
                <strong>Labs and scan centres</strong> can add appointment times, upload reports, and mark visits as attended or missed.
              </li>
              <li>
                <strong>Operations</strong> can see every patient, where they are in the journey, and the overall progress numbers.
              </li>
              <li>
                <strong>The patient</strong> has no login. After the doctor orders tests for a pretend patient, a link appears to open the patient&apos;s own page, where they pick a lab and a time (in English or Hindi).
              </li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              Tip: start as the doctor and add a patient, then sign out and come back as the other roles to follow that patient along. Reminders and a full activity log for operations are coming next.
            </p>
          </div>
        </section>

        <section aria-labelledby="pathway" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <h2 id="pathway" className="font-heading text-2xl font-extrabold sm:text-3xl">
            One pathway, four owners
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
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
        </section>

        <section aria-labelledby="problem" className="border-y bg-card">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 id="problem" className="font-heading text-2xl font-extrabold sm:text-3xl">
                The tests exist. The follow-through does not.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Guidelines recommend a fibrosis-risk check in type 2 diabetes. In real care, patients fall between the lab, the clinical review, the referral and the follow-up.
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
                  of 188 patients with fatty liver disease and an abnormal FIB-4 were referred for elastography or to hepatology. Spann et al., Hepatol Commun, 2023.
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
