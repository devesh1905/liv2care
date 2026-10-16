import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PhoneSimulator, type PhoneMessage } from "./phone-simulator";

export const metadata = { title: "Patient's phone", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function Content({ params }: Pick<PageProps<"/phone/[journeyId]">, "params">) {
  await connection();
  const user = await requireRole("doctor", "ops");
  const { journeyId } = await params;
  if (!UUID.test(journeyId)) notFound();

  const supabase = await createClient();
  // Row-level security decides what this staff member may read: operations sees every patient, a doctor only their own.
  const [{ data: patient }, { data: messages }] = await Promise.all([
    supabase.from("journey_status").select("patient_name, patient_code").eq("journey_id", journeyId).maybeSingle(),
    supabase.from("messages").select("id, channel, body, created_at").eq("journey_id", journeyId).order("created_at"),
  ]);
  if (!patient) notFound();

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={user.role === "ops" ? "/ops" : "/doctor"} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the {user.role === "ops" ? "operations" : "doctor"} page
        </Link>
        <h1 className="font-heading text-3xl font-extrabold">
          {patient.patient_name}&apos;s phone <span className="text-base font-semibold text-muted-foreground">{patient.patient_code}</span>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          This is what the patient sees on their phone. Messages are simulated: nothing is sent. Tap a link in a message to open the page the patient would
          open. New messages appear here by themselves as you work on the other pages.
        </p>
      </div>
      <PhoneSimulator patientName={patient.patient_name} messages={(messages ?? []) as PhoneMessage[]} />
    </>
  );
}

export default function Page(props: PageProps<"/phone/[journeyId]">) {
  return (
    <Suspense fallback={<p role="status" className="p-8 text-muted-foreground">Loading…</p>}>
      <Content params={props.params} />
    </Suspense>
  );
}
