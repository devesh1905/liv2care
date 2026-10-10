import { CircleCheck, ClipboardList, FileText, Inbox, RotateCcw } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { STAGE_LABEL, type Stage } from "@/lib/journey/stages";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "./review-form";

export const metadata = { title: "Telemedicine clinician" };

type QueueItem = {
  id: string;
  updated_at: string;
  patients: { code: string; name: string; age: number } | null;
  reports: { id: string; kind: string; file_name: string; created_at: string }[];
  reviews: { id: string }[];
};

type SentReview = {
  id: string;
  fib4_text: string;
  summary: string;
  recommends_vcte: boolean;
  created_at: string;
  journeys: { stage: number; patients: { code: string; name: string } | null } | null;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

async function Content({ searchParams }: { searchParams: PageProps<"/clinician">["searchParams"] }) {
  await requireRole("clinician");
  const raw = (await searchParams).notice;
  const sent = (Array.isArray(raw) ? raw[0] : raw) === "sent";
  const supabase = await createClient();

  // Row-level security limits both lists to this clinician's scope; reports are readable only for those journeys.
  const [{ data: queue }, { data: reviews }] = await Promise.all([
    supabase
      .from("journeys")
      .select("id, updated_at, patients(code, name, age), reports(id, kind, file_name, created_at), reviews(id)")
      .eq("stage", 2)
      .order("updated_at"),
    supabase
      .from("reviews")
      .select("id, fib4_text, summary, recommends_vcte, created_at, journeys(stage, patients(code, name))")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const items = (queue ?? []) as unknown as QueueItem[];
  const done = (reviews ?? []) as unknown as SentReview[];

  return (
    <>
      {sent && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-ok-soft px-4 py-3 font-semibold text-ok">
          <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
          Review sent to the treating doctor, with the original report.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Waiting for review" value={items.length} tone="warn" />
        <StatTile label="Sent by you" value={done.length} tone="ok" hint="Most recent eight shown" />
      </div>

      <section aria-labelledby="queue" className="flex flex-col gap-3">
        <h2 id="queue" className="font-heading text-xl font-extrabold">
          Review queue
        </h2>
        {items.length === 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-dashed bg-card p-6 text-muted-foreground">
            <Inbox className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>Nothing is waiting. New lab reports appear here as soon as they are uploaded.</p>
          </div>
        )}
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => {
            const reports = [...item.reports].sort((a, b) => a.created_at.localeCompare(b.created_at));
            return (
              <Card key={item.id} className="flex flex-col gap-4">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-lg font-extrabold">{item.patients?.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {item.patients?.code} · {item.patients?.age} years · waiting since {when(item.updated_at)}
                    </p>
                  </div>
                  {item.reviews.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-bold text-warn">
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      Re-review requested
                    </span>
                  )}
                </header>

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Original report</p>
                  {reports.length === 0 && <p className="text-sm text-muted-foreground">No report file is attached.</p>}
                  {reports.map((r) => (
                    <a
                      key={r.id}
                      href={`/reports/${r.id}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex w-fit items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold shadow-sm hover:bg-muted"
                    >
                      <FileText className="size-4 text-primary" aria-hidden="true" />
                      Open {r.file_name}
                      <span className="sr-only"> (opens in a new tab; the access is recorded)</span>
                    </a>
                  ))}
                  <p className="text-xs text-muted-foreground">Opening a report is recorded in the audit trail.</p>
                </div>

                <ReviewForm journeyId={item.id} />
              </Card>
            );
          })}
        </div>
      </section>

      {done.length > 0 && (
        <section aria-labelledby="sent" className="flex flex-col gap-3">
          <h2 id="sent" className="font-heading text-xl font-extrabold">
            Recently sent
          </h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {done.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-heading font-extrabold">
                    {r.journeys?.patients?.name} <span className="text-xs font-normal text-muted-foreground">{r.journeys?.patients?.code}</span>
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">{when(r.created_at)}</span>
                </div>
                <p className="text-sm">
                  <span className="font-semibold">FIB-4 you typed:</span> {r.fib4_text}
                  {r.recommends_vcte && <span className="ml-2 rounded-full bg-info-soft px-2 py-0.5 text-xs font-bold text-info">FibroScan recommended</span>}
                </p>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{r.summary}</p>
                <p className="text-xs text-muted-foreground">Now: {r.journeys ? STAGE_LABEL[r.journeys.stage as Stage] : ""}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function Page(props: PageProps<"/clinician">) {
  return (
    <>
      <PageHeader
        title="Telemedicine clinician"
        description="Open the original report, type the FIB-4 and write the clinical summary for the treating doctor."
        icon={<ClipboardList className="size-5" />}
      />
      <Suspense fallback={<div role="status" aria-label="Loading" className="h-32 animate-pulse rounded-xl bg-muted" />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
