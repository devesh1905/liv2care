import { Users } from "lucide-react";
import { Suspense } from "react";
import { JourneyTable, type JourneyRow } from "@/components/journey-table";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { requireRole } from "@/lib/auth/session";
import { STAGE } from "@/lib/journey/stages";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Operations" };

async function Dashboard() {
  await requireRole("ops");
  const supabase = await createClient();
  const { data } = await supabase
    .from("journey_status")
    .select("journey_id, patient_code, patient_name, stage, missed")
    .order("patient_code");
  const rows = (data ?? []) as JourneyRow[];

  const open = rows.filter((r) => r.stage !== STAGE.COMPLETE && r.stage !== STAGE.DECLINED);
  const missed = rows.filter((r) => r.missed).length;
  const done = rows.filter((r) => r.stage === STAGE.COMPLETE).length;
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Patients" value={rows.length} />
        <StatTile label="Open journeys" value={open.length} tone="info" />
        <StatTile label="Missed visits" value={missed} tone="bad" />
        <StatTile label="Pathway completion" value={`${pct}%`} tone="ok" hint={`${done} of ${rows.length} complete`} />
      </div>
      <section aria-labelledby="all" className="flex flex-col gap-3">
        <h2 id="all" className="font-heading text-xl font-extrabold">
          All patients
        </h2>
        <JourneyTable rows={rows} />
      </section>
    </>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader
        title="Operations"
        description="Track pending actions across every patient. Reminders, the audit trail and metrics arrive in a later phase."
        icon={<Users className="size-5" />}
      />
      <Suspense fallback={<div role="status" aria-label="Loading" className="h-24 animate-pulse rounded-xl bg-muted" />}>
        <Dashboard />
      </Suspense>
    </>
  );
}
