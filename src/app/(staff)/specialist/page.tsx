import {
  Building2,
  CalendarClock,
  CircleCheck,
  FileText,
  HeartPulse,
} from "lucide-react";
import { Suspense } from "react";
import {
  AddSlotForm,
  AttendedButton,
  MissedButton,
  RemoveSlotButton,
} from "@/app/(staff)/partner/partner-forms";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { StatusPill } from "@/components/status-pill";
import { UrgentPill } from "@/components/urgent-pill";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { timeUntil } from "@/lib/format/countdown";
import { decide } from "@/lib/journey/stateMachine";
import type { Stage } from "@/lib/journey/stages";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Specialist" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const NOTICES: Record<string, string> = {
  missed:
    "Marked missed. A reschedule message was sent to the patient (simulated).",
  attended:
    "Visit marked attended. The treating doctor sees the journey as complete.",
};

type Referral = {
  id: string;
  journey_id: string;
  status: string;
  slot_label: string | null;
  slots: { starts_at: string } | null;
  journeys: {
    stage: number;
    missed: boolean;
    urgent: boolean;
    doctor_id: string;
    patients: { code: string; name: string; age: number } | null;
    reports: { id: string; kind: string; created_at: string }[];
    reviews: {
      report_id: string | null;
      fib4_text: string;
      summary: string;
      created_at: string;
    }[];
  } | null;
};

const Label = ({ children }: { children: string }) => (
  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
    {children}
  </p>
);

/** The clinician's latest note on each report: the first is about the blood test, the second about the FibroScan. */
function Summaries({ j }: { j: NonNullable<Referral["journeys"]> }) {
  const kindOf = new Map(j.reports.map((r) => [r.id, r.kind]));
  const latest = (kind: string) =>
    [...j.reviews]
      .filter((r) => r.report_id && kindOf.get(r.report_id) === kind)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const notes = [
    {
      title: "Clinician's summary of the FibroScan report",
      label: "FibroScan result typed by the clinician:",
      review: latest("fibroscan"),
    },
    {
      title: "Clinician's summary of the lab report",
      label: "FIB-4 typed by the clinician:",
      review: latest("lab"),
    },
  ].filter((n) => n.review);
  if (notes.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No clinician&apos;s summary is on record yet.
      </p>
    );
  return (
    <>
      {notes.map((n) => (
        <div
          key={n.title}
          className="flex flex-col gap-2 rounded-xl border bg-card p-4"
        >
          <Label>{n.title}</Label>
          <p className="text-sm">
            <span className="font-semibold">{n.label}</span>{" "}
            {n.review!.fib4_text}
          </p>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {n.review!.summary}
          </p>
        </div>
      ))}
    </>
  );
}

function ReferralCard({
  r,
  doctor,
  nowMs,
  done,
}: {
  r: Referral;
  doctor: string | undefined;
  nowMs: number;
  done?: boolean;
}) {
  const j = r.journeys!;
  const state = { stage: j.stage as Stage, missed: j.missed };
  const actor = { id: "x", role: "specialist" } as const;
  const canAttend = !done && decide(state, { type: "MARK_ATTENDED" }, actor).ok;
  const canMiss = !done && decide(state, { type: "MARK_MISSED" }, actor).ok;
  const waitUntil = r.slots ? timeUntil(r.slots.starts_at, nowMs) : null;
  const reports = [...j.reports].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  return (
    <Card className="flex flex-col gap-4" data-testid="referral">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-extrabold">
            {j.patients?.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {j.patients?.code} · {j.patients?.age} years
            {doctor ? ` · referred by ${doctor}` : ""}
          </p>
          {j.urgent && <UrgentPill />}
        </div>
        <StatusPill
          label={done ? "Seen" : j.missed ? "Missed" : "Booked"}
          tone={done ? "ok" : j.missed ? "bad" : "info"}
        />
      </header>
      <p className="flex items-center gap-2 text-sm">
        <CalendarClock className="size-4 text-info" aria-hidden="true" />
        <span className="font-semibold">
          {r.slot_label ?? "To be confirmed"}
        </span>
      </p>

      {!done && <Summaries j={j} />}

      {reports.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {reports.map((rep) => (
            <a
              key={rep.id}
              href={`/reports/${rep.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold shadow-sm hover:bg-muted"
            >
              <FileText className="size-4 text-primary" aria-hidden="true" />
              {rep.kind === "fibroscan"
                ? "Open FibroScan report"
                : "Open lab report"}
              <span className="sr-only">
                {" "}
                (opens in a new tab; the access is recorded)
              </span>
            </a>
          ))}
        </div>
      )}

      {j.missed && !done && (
        <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
          Missed. Waiting for the patient to choose a new time.
        </p>
      )}
      {(canAttend || canMiss) && (
        <div className="flex flex-wrap gap-3">
          {canAttend && (
            <AttendedButton journeyId={r.journey_id} waitUntil={waitUntil} />
          )}
          {canMiss && (
            <MissedButton journeyId={r.journey_id} waitUntil={waitUntil} />
          )}
        </div>
      )}
    </Card>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: PageProps<"/specialist">["searchParams"];
}) {
  const user = await requireRole("specialist");
  const raw = (await searchParams).notice;
  const notice = NOTICES[Array.isArray(raw) ? raw[0] : (raw ?? "")];
  const supabase = await createClient();
  const now = new Date();
  const nowMs = now.getTime();

  // Row-level security: only patients referred to this specialist's own site, with their reports and the clinician's notes.
  const [{ data: partner }, { data: bookings }, { data: slots }] =
    await Promise.all([
      supabase
        .from("partners")
        .select("name, area")
        .eq("id", user.partnerId!)
        .maybeSingle(),
      supabase
        .from("bookings")
        .select(
          "id, journey_id, status, slot_label, slots(starts_at), journeys(stage, missed, urgent, doctor_id, patients(code, name, age), reports(id, kind, created_at), reviews(report_id, fib4_text, summary, created_at))",
        )
        .in("status", ["booked", "missed", "attended"])
        .order("created_at", { ascending: false }),
      supabase
        .from("slots")
        .select("id, starts_at, taken")
        .eq("partner_id", user.partnerId!)
        .gte("starts_at", now.toISOString())
        .order("starts_at"),
    ]);

  const rows = ((bookings ?? []) as unknown as Referral[]).filter(
    (r) => r.journeys?.patients,
  );
  // urgent patients first, then the newest referral
  const open = rows
    .filter((r) => r.status !== "attended")
    .sort(
      (a, b) => Number(!!b.journeys?.urgent) - Number(!!a.journeys?.urgent),
    );
  const seen = rows.filter((r) => r.status === "attended").slice(0, 10);

  const doctorIds = [...new Set(rows.map((r) => r.journeys!.doctor_id))];
  const { data: doctors } = doctorIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", doctorIds)
    : { data: [] as { id: string; display_name: string }[] };
  const doctorName = new Map(
    (doctors ?? []).map((d) => [d.id, d.display_name]),
  );

  return (
    <>
      {notice && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-ok-soft px-4 py-3 font-semibold text-ok"
        >
          <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}
      <p className="flex items-center gap-2 text-muted-foreground">
        <Building2 className="size-4" aria-hidden="true" />
        {partner?.name} · {partner?.area}
      </p>

      <section className="flex flex-col gap-3" aria-labelledby="referrals">
        <h2 id="referrals" className="font-heading text-xl font-extrabold">
          Referred patients
        </h2>
        {open.length === 0 && (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
            No referrals right now. They appear here once a treating doctor
            refers a patient and the patient books a time.
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {open.map((r) => (
            <ReferralCard
              key={r.id}
              r={r}
              doctor={doctorName.get(r.journeys!.doctor_id)}
              nowMs={nowMs}
            />
          ))}
        </div>
      </section>

      {seen.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="seen">
          <h2 id="seen" className="font-heading text-xl font-extrabold">
            Recently seen
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {seen.map((r) => (
              <ReferralCard
                key={r.id}
                r={r}
                doctor={doctorName.get(r.journeys!.doctor_id)}
                nowMs={nowMs}
                done
              />
            ))}
          </div>
        </section>
      )}

      <Card aria-labelledby="slots" className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"
          >
            <CalendarClock className="size-5" />
          </span>
          <div>
            <CardTitle id="slots">Open slots</CardTitle>
            <CardDescription>
              Referred patients choose from these. Keep them up to date.
            </CardDescription>
          </div>
        </div>
        <AddSlotForm />
        {(slots ?? []).length === 0 ? (
          <p className="text-muted-foreground">
            No upcoming slots. Add some so referred patients can book.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {(slots ?? []).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="flex flex-wrap items-center gap-x-3">
                  <span className="whitespace-nowrap font-semibold">
                    {when(s.starts_at)}
                  </span>
                  <StatusPill
                    label={s.taken ? "Taken" : "Open"}
                    tone={s.taken ? "info" : "ok"}
                  />
                </span>
                {!s.taken && <RemoveSlotButton slotId={s.id} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function Page(props: PageProps<"/specialist">) {
  return (
    <>
      <PageHeader
        title="Specialist"
        description="Hepatology and gastroenterology: patients referred by their treating doctor after the clinician's FibroScan summary."
        icon={<HeartPulse className="size-5" />}
      />
      <Suspense fallback={<PageSkeleton tiles={0} cards={2} />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
