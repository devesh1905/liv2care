import { Suspense } from "react";
import { JourneyTable, type JourneyRow } from "@/components/journey-table";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Treating doctor · Liv2care" };

async function Journeys() {
  await requireRole("doctor");
  const supabase = await createClient();
  const { data } = await supabase
    .from("journey_status")
    .select("journey_id, patient_code, patient_name, stage, missed")
    .order("patient_code");
  return <JourneyTable rows={(data ?? []) as JourneyRow[]} />;
}

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Treating doctor</h1>
      <Suspense fallback={<p role="status" className="text-muted-foreground">Loading…</p>}>
        <Journeys />
      </Suspense>
    </>
  );
}
