"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { startJourney } from "@/lib/journey/start";
import { mockProvider } from "@/lib/messages/provider";
import { templates } from "@/lib/messages/templates";
import { checkPdf } from "@/lib/reports/pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EnrolState = { error?: string; success?: string };

const CONSENT_SCOPE = "Liver-risk assessment pathway and sharing reports with the platform clinician";

/** Option 1 (existing lab report) or Option 2 (order the preset tests). Needs the patient's consent. */
export async function enrolPatient(_prev: EnrolState, form: FormData): Promise<EnrolState> {
  const doctor = await requireRole("doctor");
  // Revalidate up front: Next 16.4 fails to re-render the layout after an action that returns without revalidating.
  revalidatePath("/doctor");

  const name = String(form.get("name") ?? "").trim();
  const age = Number(form.get("age"));
  const last4 = String(form.get("phone") ?? "").trim();
  const language = form.get("language") === "hi" ? "hi" : "en";
  const route = form.get("route") === "existing_report" ? "existing_report" : "order_tests";
  const ultrasound = route === "order_tests" && form.get("ultrasound") === "on";

  if (!name || name.length > 80) return { error: "Enter the patient's name." };
  if (!Number.isInteger(age) || age < 18 || age > 120) return { error: "Enter an age between 18 and 120." };
  if (last4 && !/^\d{4}$/.test(last4)) return { error: "Phone: enter the last 4 digits only, or leave it empty." };
  if (form.get("consent") !== "on") return { error: "The patient's consent is required to enrol." };

  const supabase = await createClient();
  const admin = createAdminClient();
  const journeyId = randomUUID();

  let report: { storagePath: string; fileName: string } | undefined;
  if (route === "existing_report") {
    const file = form.get("report");
    if (!(file instanceof File) || file.size === 0) return { error: "Upload the existing lab report (PDF)." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = checkPdf(bytes, file.name);
    if (!checked.ok) return { error: checked.message };

    // Uploaded as the doctor, so the storage policy decides whether it is allowed.
    const storagePath = `intake/${doctor.id}/${randomUUID()}.pdf`;
    const { error } = await supabase.storage.from("reports").upload(storagePath, bytes, { contentType: "application/pdf" });
    if (error) return { error: "The report could not be uploaded. Try again." };
    report = { storagePath, fileName: checked.safeName };
  }

  const started = await startJourney(
    admin,
    { id: doctor.id, role: "doctor" },
    {
      journeyId,
      name,
      age,
      phoneMasked: `98•••• ${last4 || "••••"}`,
      language,
      route,
      ultrasound,
      consentScope: CONSENT_SCOPE,
      report,
    },
  );
  if (!started.ok) {
    if (report) await admin.storage.from("reports").remove([report.storagePath]);
    return { error: started.error.message };
  }

  const { data: row } = await supabase.from("journey_status").select("patient_code").eq("journey_id", journeyId).maybeSingle();
  const code = row?.patient_code ?? "";
  try {
    await mockProvider(admin).send({
      journeyId,
      channel: "WhatsApp",
      body: route === "existing_report" ? templates.existingReportUsed() : templates.testsOrdered(code, ultrasound),
    });
  } catch {
    // The journey exists; the message log can be filled in later.
  }

  return {
    success:
      route === "existing_report"
        ? `${name} (${code}) enrolled. The existing report is with the clinician; no repeat test needed.`
        : `${name} (${code}) enrolled. A booking link was sent by WhatsApp (simulated).`,
  };
}
