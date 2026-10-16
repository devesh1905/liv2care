import { CalendarCheck, Check, CircleAlert, Languages } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { loadTimelineView, type TimelineView } from "@/lib/booking/timeline-view";
import { isLang, t, type Lang, type PatientKey } from "@/lib/i18n/patient";
import { nextForPatient, timelineSteps } from "@/lib/journey/timeline";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Your progress",
  // A progress link is private: keep it out of search results and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Ready = Extract<TimelineView, { kind: "ready" }>;

function Progress({ view, lang }: { view: Ready; lang: Lang }) {
  const steps = timelineSteps(view.stage);
  const next = nextForPatient({ stage: view.stage, missed: view.missed, awaitingReport: view.awaitingReport });

  return (
    <>
      <div>
        <p className="text-lg font-semibold">
          {t(lang, "hello")} {view.firstName}.
        </p>
        <p className="text-muted-foreground">{t(lang, "progressIntro")}</p>
      </div>

      <section
        aria-labelledby="next"
        className={cn("flex flex-col gap-2 rounded-2xl border p-5", view.missed ? "border-warn/40 bg-warn-soft" : "bg-secondary/60")}
      >
        <h2 id="next" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t(lang, "nextLabel")}
        </h2>
        {next.who && <p className="text-sm font-bold text-primary">{t(lang, next.who)}</p>}
        <p className="text-lg font-semibold">{t(lang, next.text)}</p>
      </section>

      {view.appointment && (
        <section aria-labelledby="appt" className="flex items-start gap-3 rounded-2xl border bg-card p-5 shadow-card">
          <CalendarCheck className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 id="appt" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {t(lang, "appointmentLabel")}
            </h2>
            <p className="text-lg font-semibold">{view.appointment.place}</p>
            <p className="text-muted-foreground">{view.appointment.slot}</p>
          </div>
        </section>
      )}

      <ol className="flex flex-col" aria-label={t(lang, "progressTitle")}>
        {steps.map((step) => (
          <li key={step.index} aria-current={step.status === "current" ? "step" : undefined} className="relative flex gap-4 pb-6 last:pb-0">
            {step.index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn("absolute left-4 top-8 -ml-px h-[calc(100%-2rem)] w-0.5", step.status === "done" ? "bg-ok" : "bg-border")}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold",
                step.status === "done" && "border-ok bg-ok text-white",
                step.status === "current" && "border-primary bg-card text-primary ring-4 ring-primary/20",
                step.status === "upcoming" && "border-border bg-card text-muted-foreground",
              )}
            >
              {step.status === "done" ? <Check className="size-4" strokeWidth={3} /> : step.index + 1}
            </span>
            <div className="pt-1">
              <p className={cn("font-semibold", step.status === "upcoming" && "text-muted-foreground")}>
                {t(lang, `m${step.index + 1}` as PatientKey)}
              </p>
              <p className="text-xs text-muted-foreground">
                {step.status === "done" ? t(lang, "stepDone") : step.status === "current" ? t(lang, "stepNow") : t(lang, "stepLater")}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

async function Content({ params, searchParams }: Pick<PageProps<"/patient/[token]">, "params" | "searchParams">) {
  await connection();
  const { token } = await params;
  const wanted = (await searchParams).lang;
  const view = await loadTimelineView(token);

  const lang: Lang = isLang(wanted) ? wanted : view.kind === "ready" ? view.language : "en";
  const other: Lang = lang === "en" ? "hi" : "en";

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <a
            href={`?lang=${other}`}
            lang={other}
            className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-semibold shadow-sm hover:bg-muted"
          >
            <Languages className="size-4" aria-hidden="true" />
            {t(lang, "language")}
          </a>
        </div>
      </header>

      <main lang={lang} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">{t(lang, "progressTitle")}</h1>

        {view.kind === "invalid" && (
          <p role="alert" className="flex gap-3 rounded-2xl bg-bad-soft p-4 font-medium text-bad">
            <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            {t(lang, "linkInvalid")}
          </p>
        )}

        {view.kind === "ready" && <Progress view={view} lang={lang} />}
      </main>
    </div>
  );
}

export default function Page(props: PageProps<"/patient/[token]">) {
  return (
    <Suspense fallback={<p role="status" className="p-8 text-muted-foreground">Loading…</p>}>
      <Content params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
