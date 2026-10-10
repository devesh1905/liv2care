import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { nextAction, statusOf } from "@/lib/journey/derived";
import { visitActions } from "@/lib/journey/partnerActions";
import { STAGE_LABEL, type Stage } from "@/lib/journey/stages";
import { createClient } from "@/lib/supabase/server";
import { AddSlotForm, AttendedButton, MissedButton, RemoveSlotButton, UploadForm } from "./partner-forms";

export const metadata = { title: "Lab and centre · Liv2care" };

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
      <p className="text-muted-foreground">
        {partner?.name} · {partner?.area}
      </p>

      <section className="flex flex-col gap-4" aria-labelledby="visits">
        <h2 id="visits" className="text-lg font-extrabold">
          Booked visits
        </h2>
        {rows.length === 0 && <p className="text-muted-foreground">No booked visits right now.</p>}
        {rows.map((v) => {
          const j = v.journeys;
          if (!j?.patients) return null;
          const state = { stage: j.stage as Stage, missed: j.missed };
          const actions = visitActions(state, user.role as "lab" | "centre");
          const status = statusOf(state);
          const next = nextAction(state);
          return (
            <article key={v.id} className="flex flex-col gap-3 rounded-lg border p-4">
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-extrabold">
                  {j.patients.name} <span className="font-normal text-muted-foreground">{j.patients.code}</span>
                </h3>
                <span className="text-sm font-semibold">{status.label}</span>
              </header>
              <p className="text-sm text-muted-foreground">
                {STAGE_LABEL[state.stage]} · booked for {v.slot_label ?? "a time to be confirmed"}
                {next ? ` · Next: ${next.who}, ${next.what.toLowerCase()}` : ""}
              </p>
              {actions.waitingForPatient && (
                <p className="text-sm font-semibold">Missed. Waiting for the patient to choose a new time.</p>
              )}
              {actions.uploadReport && <UploadForm journeyId={v.journey_id} label={uploadLabel} />}
              <div className="flex flex-wrap gap-3">
                {actions.markAttended && <AttendedButton journeyId={v.journey_id} />}
                {actions.markMissed && <MissedButton journeyId={v.journey_id} />}
              </div>
            </article>
          );
        })}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="slots">
        <h2 id="slots" className="text-lg font-extrabold">
          Open slots
        </h2>
        <AddSlotForm />
        {(slots ?? []).length === 0 ? (
          <p className="text-muted-foreground">No upcoming slots. Add some so patients can book.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {(slots ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span>
                  {when(s.starts_at)} <span className="text-sm text-muted-foreground">{s.taken ? "Taken" : "Open"}</span>
                </span>
                {!s.taken && <RemoveSlotButton slotId={s.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Lab and centre</h1>
      <Suspense fallback={<p role="status" className="text-muted-foreground">Loading…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
