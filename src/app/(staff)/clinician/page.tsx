import { ClipboardList, Inbox } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Telemedicine clinician" };

async function Queue() {
  await requireRole("clinician");
  const supabase = await createClient();
  // Row-level security decides what this role can see: journeys waiting for review, or already reviewed by them.
  const { count } = await supabase.from("journeys").select("id", { count: "exact", head: true });
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Journeys in your scope" value={count ?? 0} tone="info" />
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader
        title="Telemedicine clinician"
        description="Review reports, type the FIB-4 value and write the clinical summary for the treating doctor."
        icon={<ClipboardList className="size-5" />}
      />
      <Suspense fallback={<div role="status" aria-label="Loading" className="h-24 animate-pulse rounded-xl bg-muted" />}>
        <Queue />
      </Suspense>
      <div className="flex items-start gap-3 rounded-xl border border-dashed bg-card p-5 text-muted-foreground">
        <Inbox className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>The review queue is built next. You will open the original report, type the FIB-4 and summary yourself, and send both to the treating doctor.</p>
      </div>
    </>
  );
}
