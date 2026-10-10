import { CalendarCheck, CircleCheck, FileText, Stethoscope } from "lucide-react";
import { Suspense } from "react";
import { JourneyTable, type JourneyRow } from "@/components/journey-table";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { STAGE } from "@/lib/journey/stages";
import { createClient } from "@/lib/supabase/server";
import { ApproveButton, DeclineForm, FollowUpButtons, NextStepForm, RereviewButton } from "./decision-forms";
import { EnrolForm } from "./enrol-form";

export const metadata = { title: "Treating doctor" };

const NOTICES: Record<string, string> = {
  approved: "FibroScan approved. A booking link was sent to the patient (simulated).",
  declined: "FibroScan not approved. The case stays on your dashboard.",
  rereview: "Sent back to the clinician for re-review.",
  routine: "Routine follow-up booked at your clinic. The patient was told (simulated).",
  eval: "Further evaluation ordered. A booking link was sent to the patient (simulated).",
  specialist: "Specialist referral made. A booking link was sent to the patient (simulated).",
  attended: "Visit marked attended. The journey is complete.",
  missed: "Marked missed. A reschedule link was sent to the patient (simulated).",
};

type WorkItem = {
  id: string;
  stage: number;
  next_step: string | null;
  patients: { code: string; name: string; age: number } | null;
  reviews: { fib4_text: string; summary: string; recommends_vcte: boolean; created_at: string }[];
  reports: { id: string; kind: string; file_name: string; created_at: string }[];
  bookings: { status: string; slot_label: string | null; partners: { name: string } | null; created_at: string }[];
};

const ReportLink = ({ id, label }: { id: string; label: string }) => (
  <a
    href={`/reports/${id}`}
    target="_blank"
    rel="noopener"
    className="inline-flex w-fit items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold shadow-sm hover:bg-muted"
  >
    <FileText className="size-4 text-primary" aria-hidden="true" />
    {label}
    <span className="sr-only"> (opens in a new tab; the access is recorded)</span>
  </a>
);

function WorkCard({ item }: { item: WorkItem }) {
  const latest = [...item.reviews].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const labReports = item.reports.filter((r) => r.kind === "lab");
  const scans = item.reports.filter((r) => r.kind === "fibroscan");
  const followUp = [...item.bookings].filter((b) => b.status === "booked").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  return (
    <Card className="flex flex-col gap-4">
      <header>
        <h3 className="font-heading text-lg font-extrabold">{item.patients?.name}</h3>
        <p className="text-xs text-muted-foreground">
          {item.patients?.code} · {item.patients?.age} years
        </p>
      </header>

      {item.stage !== STAGE.NEXT_BOOKED && latest && (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Clinician&apos;s review</p>
          <p className="text-sm">
            <span className="font-semibold">FIB-4 typed by the clinician:</span> {latest.fib4_text}
            {latest.recommends_vcte && <span className="ml-2 rounded-full bg-info-soft px-2 py-0.5 text-xs font-bold text-info">FibroScan recommended</span>}
          </p>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{latest.summary}</p>
        </div>
      )}

      {item.stage === STAGE.NEXT_BOOKED && (
        <p className="flex items-center gap-2 text-sm">
          <CalendarCheck className="size-4 text-info" aria-hidden="true" />
          <span>
            <span className="font-semibold">{followUp?.partners?.name ?? "Follow-up"}</span> · {followUp?.slot_label ?? "booked"}
          </span>
        </p>
      )}

      {item.stage !== STAGE.NEXT_BOOKED && (
        <div className="flex flex-wrap gap-2">
          {labReports.map((r) => (
            <ReportLink key={r.id} id={r.id} label="Open original lab report" />
          ))}
          {scans.map((r) => (
            <ReportLink key={r.id} id={r.id} label="Open FibroScan report" />
          ))}
        </div>
      )}

      {item.stage === STAGE.REVIEWED && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ApproveButton journeyId={item.id} />
            <RereviewButton journeyId={item.id} />
          </div>
          <DeclineForm journeyId={item.id} />
        </div>
      )}
      {item.stage === STAGE.VCTE_REPORT && <NextStepForm journeyId={item.id} />}
      {item.stage === STAGE.NEXT_BOOKED && <FollowUpButtons journeyId={item.id} canMiss={item.next_step !== "routine"} />}
    </Card>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/doctor">["searchParams"] }) {
  await requireRole("doctor");
  const raw = (await searchParams).notice;
  const notice = NOTICES[Array.isArray(raw) ? raw[0] : (raw ?? "")];
  const supabase = await createClient();

  const [{ data }, { data: work }] = await Promise.all([
    supabase.from("journey_status").select("journey_id, patient_code, patient_name, stage, missed").order("patient_code"),
    // Row-level security: only this doctor's journeys, with the reviews and reports they are allowed to read.
    supabase
      .from("journeys")
      .select(
        "id, stage, next_step, patients(code, name, age), reviews(fib4_text, summary, recommends_vcte, created_at), reports(id, kind, file_name, created_at), bookings(status, slot_label, created_at, partners(name))",
      )
      .in("stage", [STAGE.REVIEWED, STAGE.VCTE_REPORT, STAGE.NEXT_BOOKED])
      .eq("missed", false)
      .order("updated_at"),
  ]);
  const rows = (data ?? []) as JourneyRow[];
  const items = (work ?? []) as unknown as WorkItem[];
  const decisions = items.filter((i) => i.stage === STAGE.REVIEWED || i.stage === STAGE.VCTE_REPORT);
  const followUps = items.filter((i) => i.stage === STAGE.NEXT_BOOKED);

  const needsYou = rows.filter((r) => !r.missed && (r.stage === STAGE.REVIEWED || r.stage === STAGE.VCTE_REPORT)).length;
  const missed = rows.filter((r) => r.missed).length;
  const done = rows.filter((r) => r.stage === STAGE.COMPLETE).length;
  const waiting = rows.length - needsYou - missed - done - rows.filter((r) => r.stage === STAGE.DECLINED).length;

  return (
    <>
      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-ok-soft px-4 py-3 font-semibold text-ok">
          <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Needs your decision" value={needsYou} tone="warn" hint="Review or FibroScan decision" />
        <StatTile label="With others" value={waiting} tone="info" hint="Patient, lab or clinician" />
        <StatTile label="Missed" value={missed} tone="bad" hint="Waiting to reschedule" />
        <StatTile label="Completed" value={done} tone="ok" hint="Next step booked and attended" />
      </div>

      {decisions.length > 0 && (
        <section aria-labelledby="decide" className="flex flex-col gap-3">
          <h2 id="decide" className="font-heading text-xl font-extrabold">
            Needs your decision
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {decisions.map((i) => (
              <WorkCard key={i.id} item={i} />
            ))}
          </div>
        </section>
      )}

      {followUps.length > 0 && (
        <section aria-labelledby="followups" className="flex flex-col gap-3">
          <h2 id="followups" className="font-heading text-xl font-extrabold">
            Follow-up visits
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {followUps.map((i) => (
              <WorkCard key={i.id} item={i} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="patients" className="flex flex-col gap-3">
        <h2 id="patients" className="font-heading text-xl font-extrabold">
          Your patients
        </h2>
        <JourneyTable rows={rows} />
      </section>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

export default function Page(props: PageProps<"/doctor">) {
  return (
    <>
      <PageHeader
        title="Treating doctor"
        description="Identify patients, decide on FibroScan and review outcomes."
        icon={<Stethoscope className="size-5" />}
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard searchParams={props.searchParams} />
      </Suspense>
      <EnrolForm />
    </>
  );
}
