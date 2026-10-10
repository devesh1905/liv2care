import { Stethoscope } from "lucide-react";
import { Suspense } from "react";
import { JourneyTable, type JourneyRow } from "@/components/journey-table";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { requireRole } from "@/lib/auth/session";
import { STAGE } from "@/lib/journey/stages";
import { createClient } from "@/lib/supabase/server";
import { EnrolForm } from "./enrol-form";

export const metadata = { title: "Treating doctor" };

async function Dashboard() {
  await requireRole("doctor");
  const supabase = await createClient();
  const { data } = await supabase
    .from("journey_status")
    .select("journey_id, patient_code, patient_name, stage, missed")
    .order("patient_code");
  const rows = (data ?? []) as JourneyRow[];

  const needsYou = rows.filter((r) => !r.missed && (r.stage === STAGE.REVIEWED || r.stage === STAGE.VCTE_REPORT)).length;
  const missed = rows.filter((r) => r.missed).length;
  const done = rows.filter((r) => r.stage === STAGE.COMPLETE).length;
  const waiting = rows.length - needsYou - missed - done - rows.filter((r) => r.stage === STAGE.DECLINED).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Needs your decision" value={needsYou} tone="warn" hint="Review or FibroScan decision" />
        <StatTile label="With others" value={waiting} tone="info" hint="Patient, lab or clinician" />
        <StatTile label="Missed" value={missed} tone="bad" hint="Waiting to reschedule" />
        <StatTile label="Completed" value={done} tone="ok" hint="Next step booked and attended" />
      </div>
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

export default function Page() {
  return (
    <>
      <PageHeader
        title="Treating doctor"
        description="Identify patients, decide on FibroScan and review outcomes."
        icon={<Stethoscope className="size-5" />}
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
      <EnrolForm />
    </>
  );
}
