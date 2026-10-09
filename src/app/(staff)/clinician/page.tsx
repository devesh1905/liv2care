import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Telemedicine clinician · Liv2care" };

async function Visible() {
  await requireRole("clinician");
  const supabase = await createClient();
  // Row-level security decides what this role can see.
  const { count } = await supabase.from("journeys").select("id", { count: "exact", head: true });
  return (
    <p className="text-muted-foreground">
      {count ?? 0} journeys are visible to you. The working screens for this role arrive in a later phase.
    </p>
  );
}

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Telemedicine clinician</h1>
      <Suspense fallback={<p role="status" className="text-muted-foreground">Loading…</p>}>
        <Visible />
      </Suspense>
    </>
  );
}
