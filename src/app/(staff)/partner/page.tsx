import { Building2, CalendarClock, FlaskConical } from "lucide-react";
import { Suspense } from "react";
import { JourneyProgress } from "@/components/journey-progress";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { nextAction, statusOf } from "@/lib/journey/derived";
import { visitActions } from "@/lib/journey/partnerActions";
import { STAGE_LABEL, type Stage } from "@/lib/journey/stages";
import { createClient } from "@/lib/supabase/server";
import { AddSlotForm, AttendedButton, MissedButton, RemoveSlotButton, UploadForm } from "./partner-forms";

export const metadata = { title: "Lab and centre" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

type Visit = {
  id: string;
  journey_id: string;
  slot_label: string | null;
  journeys: { stage: number; missed: boolean; patients: { code: string; name: string } | null } | null;
};

async function Content() {
  const user = await requireRole("lab", "centre");
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [{ data: partner }, { data: visits }, { data: slots }] = await Promise.all([
    supabase.from("partners").select("name, area").eq("id", user.partnerId!).maybeSingle(),
    supabase
      .from("bookings")
      .select("id, journey_id, slot_label, journeys(stage, missed, patients(code, name))")
      .in("status", ["booked", "missed"])
      .order("created_at"),
    supabase.from("slots").select("id, starts_at, taken").eq("partner_id", user.partnerId!).gte("starts_at", nowIso).order("starts_at"),
  ]);

  const rows = (visits ?? []) as unknown as Visit[];
  const uploadLabel = user.role === "lab" ? "Lab report" : "FibroScan report";

  return (
    <>
      <p className="flex items-center gap-2 text-muted-foreground">
        <Building2 className="size-4" aria-hidden="true" />
        {partner?.name} · {partner?.area}
      </p>

      <section className="flex flex-col gap-3" aria-labelledby="visits">
        <h2 id="visits" className="font-heading text-xl font-extrabold">
          Booked visits
        </h2>
        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">No booked visits right now.</p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((v) => {
            const j = v.journeys;
            if (!j?.patients) return null;
            const state = { stage: j.stage as Stage, missed: j.missed };
            const actions = visitActions(state, user.role as "lab" | "centre");
            const status = statusOf(state);
            const next = nextAction(state);
            return (
              <Card key={v.id} className="flex flex-col gap-4">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-lg font-extrabold">{j.patients.name}</h3>
                    <p className="text-xs text-muted-foreground">{j.patients.code}</p>
                  </div>
                  <StatusPill {...status} />
                </header>
                <JourneyProgress stage={state.stage} missed={state.missed} />
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Stage</dt>
                    <dd className="font-semibold">{STAGE_LABEL[state.stage]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Booked for</dt>
                    <dd className="font-semibold">{v.slot_label ?? "To be confirmed"}</dd>
                  </div>
                </dl>
                {next && !actions.waitingForPatient && (
                  <p className="text-sm text-muted-foreground">
                    Next: {next.who}: {next.what}
                  </p>
                )}
                {actions.waitingForPatient && (
                  <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
                    Missed. Waiting for the patient to choose a new time.
                  </p>
                )}
                {actions.uploadReport && <UploadForm journeyId={v.journey_id} label={uploadLabel} />}
                <div className="flex flex-wrap gap-3">
                  {actions.markAttended && <AttendedButton journeyId={v.journey_id} />}
                  {actions.markMissed && <MissedButton journeyId={v.journey_id} />}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <Card aria-labelledby="slots" className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <CalendarClock className="size-5" />
          </span>
          <div>
            <CardTitle id="slots">Open slots</CardTitle>
            <CardDescription>Patients choose from these. Keep them up to date.</CardDescription>
          </div>
        </div>
        <AddSlotForm />
        {(slots ?? []).length === 0 ? (
          <p className="text-muted-foreground">No upcoming slots. Add some so patients can book.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {(slots ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex flex-wrap items-center gap-x-3">
                  <span className="whitespace-nowrap font-semibold">{when(s.starts_at)}</span>
                  <StatusPill label={s.taken ? "Taken" : "Open"} tone={s.taken ? "info" : "ok"} />
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

export default function Page() {
  return (
    <>
      <PageHeader
        title="Lab and centre"
        description="Upload reports for booked visits, mark visits, and keep your slots current."
        icon={<FlaskConical className="size-5" />}
      />
      <Suspense fallback={<div role="status" aria-label="Loading" className="h-32 animate-pulse rounded-xl bg-muted" />}>
        <Content />
      </Suspense>
    </>
  );
}
