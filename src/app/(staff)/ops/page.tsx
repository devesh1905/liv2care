import { CircleCheck, Users } from "lucide-react";
import { Suspense } from "react";
import { JourneyTable, type JourneyRow } from "@/components/journey-table";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { StatusPill } from "@/components/status-pill";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { statusOf } from "@/lib/journey/derived";
import { STAGE, STAGE_LABEL, type Stage } from "@/lib/journey/stages";
import { actorLabel, dueText, eventLabel, maskLinks, percent } from "@/lib/ops/format";
import { createClient } from "@/lib/supabase/server";
import { MissedButton, ReminderButton } from "./ops-forms";

export const metadata = { title: "Operations" };

const NOTICES: Record<string, string> = {
  reminded: "Reminder sent to the patient (simulated). The clock on that action starts again.",
  missed: "Marked missed. A reschedule link was sent to the patient (simulated).",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const BOOKED_STAGES: number[] = [STAGE.LAB_BOOKED, STAGE.VCTE_BOOKED, STAGE.NEXT_BOOKED];

type Task = { id: string; journey_id: string; owner: string; description: string; due_at: string };
type Kpi = {
  patients: number;
  completed: number;
  lab_ordered: number;
  lab_booked: number;
  fibroscan_approved: number;
  fibroscan_booked: number;
  fibroscan_done: number;
  missed_now: number;
  missed_total: number;
  overdue_actions: number;
  reminders_sent: number;
  report_turnaround_hours: number | null;
  doctor_actions_per_patient: number | null;
};
type EventRow = { id: number; journey_id: string; actor_role: string; event: string; from_stage: number | null; to_stage: number | null; created_at: string };
type MessageRow = { id: string; journey_id: string; channel: string; body: string; created_at: string };

async function Dashboard({ searchParams }: { searchParams: PageProps<"/ops">["searchParams"] }) {
  await requireRole("ops");
  const raw = (await searchParams).notice;
  const notice = NOTICES[Array.isArray(raw) ? raw[0] : (raw ?? "")];
  const supabase = await createClient();
  const now = new Date().getTime();

  // Row-level security: operations reads the status view, tasks, audit rows, messages and the KPI view, and nothing clinical.
  const [{ data: status }, { data: tasks }, { data: kpiRow }, { data: events }, { data: messages }] = await Promise.all([
    supabase.from("journey_status").select("journey_id, patient_code, patient_name, stage, missed").order("patient_code"),
    supabase.from("tasks").select("id, journey_id, owner, description, due_at").is("done_at", null).order("due_at"),
    supabase.from("kpi_summary").select("*").maybeSingle(),
    supabase.from("journey_events").select("id, journey_id, actor_role, event, from_stage, to_stage, created_at").order("id", { ascending: false }).limit(40),
    supabase.from("messages").select("id, journey_id, channel, body, created_at").order("created_at", { ascending: false }).limit(25),
  ]);

  const rows = (status ?? []) as JourneyRow[];
  const byJourney = new Map(rows.map((r) => [r.journey_id, r]));
  const pending = ((tasks ?? []) as Task[]).filter((t) => byJourney.has(t.journey_id));
  const kpi = kpiRow as Kpi | null;
  const nameOf = (id: string) => byJourney.get(id)?.patient_name ?? "Unknown";

  return (
    <>
      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-ok-soft px-4 py-3 font-semibold text-ok">
          <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Pathway completion"
          value={`${percent(kpi?.completed ?? 0, kpi?.patients ?? 0)}%`}
          tone="ok"
          hint={`${kpi?.completed ?? 0} of ${kpi?.patients ?? 0} patients`}
        />
        <StatTile label="Overdue actions" value={kpi?.overdue_actions ?? 0} tone={(kpi?.overdue_actions ?? 0) > 0 ? "bad" : "neutral"} hint="Past their due time" />
        <StatTile label="Missed visits" value={kpi?.missed_now ?? 0} tone="bad" hint={`${kpi?.missed_total ?? 0} marked missed in total`} />
        <StatTile label="Reminders sent" value={kpi?.reminders_sent ?? 0} tone="info" />
        <StatTile
          label="Lab booking"
          value={`${percent(kpi?.lab_booked ?? 0, kpi?.lab_ordered ?? 0)}%`}
          hint={`${kpi?.lab_booked ?? 0} of ${kpi?.lab_ordered ?? 0} ordered`}
        />
        <StatTile
          label="FibroScan done"
          value={`${percent(kpi?.fibroscan_done ?? 0, kpi?.fibroscan_approved ?? 0)}%`}
          hint={`${kpi?.fibroscan_done ?? 0} of ${kpi?.fibroscan_approved ?? 0} approved · ${kpi?.fibroscan_booked ?? 0} booked`}
        />
        <StatTile
          label="Report turnaround"
          value={kpi?.report_turnaround_hours == null ? "n/a" : `${kpi.report_turnaround_hours} h`}
          hint="Report in to clinician review sent"
        />
        <StatTile label="Doctor actions per patient" value={kpi?.doctor_actions_per_patient ?? "n/a"} hint="A proxy for coordination time" />
      </div>

      <section aria-labelledby="pending" className="flex flex-col gap-3">
        <h2 id="pending" className="font-heading text-xl font-extrabold">
          Pending actions
        </h2>
        {pending.length === 0 && <p className="rounded-xl border border-dashed bg-card p-6 text-center text-muted-foreground">Nothing is waiting.</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {pending.map((t) => {
            const row = byJourney.get(t.journey_id)!;
            const state = { stage: row.stage as Stage, missed: row.missed };
            const due = dueText(t.due_at, now);
            const pill = statusOf(state);
            return (
              <Card key={t.id} className="flex flex-col gap-3">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading font-extrabold">{row.patient_name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {row.patient_code} · {STAGE_LABEL[state.stage]}
                    </p>
                  </div>
                  <StatusPill {...pill} />
                </header>
                <p className="text-sm">
                  <span className="font-semibold">{t.owner}:</span> {t.description}
                </p>
                <p className={due.overdue ? "text-sm font-bold text-bad" : "text-sm text-muted-foreground"}>{due.text}</p>
                <div className="flex flex-wrap gap-3">
                  {t.owner === "Patient" && <ReminderButton journeyId={t.journey_id} />}
                  {BOOKED_STAGES.includes(state.stage) && !state.missed && <MissedButton journeyId={t.journey_id} />}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="all" className="flex flex-col gap-3">
        <h2 id="all" className="font-heading text-xl font-extrabold">
          All patients
        </h2>
        <JourneyTable rows={rows} />
      </section>

      <section aria-labelledby="audit" className="flex flex-col gap-3">
        <h2 id="audit" className="font-heading text-xl font-extrabold">
          Audit trail
        </h2>
        <p className="text-sm text-muted-foreground">The 40 most recent actions: who did what, and when. This list cannot be edited.</p>
        <ol className="divide-y rounded-xl border bg-card shadow-card">
          {((events ?? []) as EventRow[]).map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
              <span>
                <span className="font-semibold">{eventLabel(e.event)}</span> · {nameOf(e.journey_id)}
                {e.from_stage != null && e.to_stage != null && e.from_stage !== e.to_stage && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({STAGE_LABEL[e.from_stage as Stage]} → {STAGE_LABEL[e.to_stage as Stage]})
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {actorLabel(e.actor_role)} · {when(e.created_at)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="messages" className="flex flex-col gap-3">
        <h2 id="messages" className="font-heading text-xl font-extrabold">
          Message log
        </h2>
        <p className="text-sm text-muted-foreground">Messages are simulated, never sent. Private links are shortened here.</p>
        <ul className="grid gap-3 lg:grid-cols-2">
          {((messages ?? []) as MessageRow[]).map((m) => (
            <li key={m.id} className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {nameOf(m.journey_id)} · {m.channel}
                </span>
                <span>{when(m.created_at)}</span>
              </div>
              <p className="whitespace-pre-line break-words text-sm">{maskLinks(m.body)}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function Page(props: PageProps<"/ops">) {
  return (
    <>
      <PageHeader
        title="Operations"
        description="Track pending actions, remind patients, and see every step that was taken."
        icon={<Users className="size-5" />}
      />
      <Suspense fallback={<div role="status" aria-label="Loading" className="h-24 animate-pulse rounded-xl bg-muted" />}>
        <Dashboard searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
