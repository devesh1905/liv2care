"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { encryptionReady, maskPhone, normalisePhone } from "@/lib/contacts/phone";
import { saveContact } from "@/lib/contacts/store";
import { startJourney } from "@/lib/journey/start";
import { issueProgressLink } from "@/lib/booking/links";
import { sendBookingLink } from "@/lib/booking/notify";
import { mockProvider } from "@/lib/messages/provider";
import { templatesFor } from "@/lib/messages/templates";
import { normaliseReport } from "@/lib/reports/pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EnrolState = {
  error?: string;
  success?: string;
  patientLink?: string;
  phoneLink?: string;
  /** What was typed when the server refused the form, so the form can show it again. */
  typed?: { name: string; age: string; phone: string; language: string; consent: boolean };
};

const CONSENT_SCOPE = "Liver-risk assessment pathway and sharing reports with the platform clinician";

/** Option 1 (existing lab report) or Option 2 (order the preset tests). Needs the patient's consent. */
export async function enrolPatient(_prev: EnrolState, form: FormData): Promise<EnrolState> {
  const doctor = await requireRole("doctor");
  // Revalidate up front: Next 16.4 fails to re-render the layout after an action that returns without revalidating.
  revalidatePath("/doctor");

  const name = String(form.get("name") ?? "").trim();
  const age = Number(form.get("age"));
  const phoneText = String(form.get("phone") ?? "").trim();
  const language = form.get("language") === "hi" ? "hi" : "en";
  const route = form.get("route") === "existing_report" ? "existing_report" : "order_tests";
  const ultrasound = route === "order_tests" && form.get("ultrasound") === "on";
  const lft = route === "order_tests" && form.get("lft") === "on";
  const urgent = form.get("urgent") === "on";

  if (!name || name.length > 80) return { error: "Enter the patient's name." };
  if (!Number.isInteger(age) || age < 18 || age > 120) return { error: "Enter an age between 18 and 120." };
  const phone = phoneText ? normalisePhone(phoneText) : null;
  if (phoneText && !phone) return { error: "Phone: enter a 10-digit mobile number (or start with + and the country code), or leave it empty." };
  if (phone && !encryptionReady(process.env.PHONE_ENCRYPTION_KEY)) {
    return { error: "Phone numbers cannot be kept yet: the server has no PHONE_ENCRYPTION_KEY. Leave the phone empty." };
  }
  if (form.get("consent") !== "on") return { error: "The patient's consent is required to enrol." };

  const supabase = await createClient();
  const admin = createAdminClient();
  // The form sends a fresh key for each new patient. Using it as the journey id means the same form sent twice (a double tap,
  // a retry on a slow connection) starts one journey, not two.
  const submissionKey = String(form.get("submissionKey") ?? "");
  const journeyId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(submissionKey) ? submissionKey : randomUUID();

  // Option 1: the doctor attaches the report now (a PDF, or a photo that is turned into a PDF), or asks the patient to send it.
  const patientSends = route === "existing_report" && form.get("patientUploads") === "on";
  let report: { storagePath: string; fileName: string } | undefined;
  if (route === "existing_report" && !patientSends) {
    const file = form.get("report");
    if (!(file instanceof File) || file.size === 0) return { error: "Attach the existing lab report, or ask the patient to upload it." };
    const checked = await normaliseReport(new Uint8Array(await file.arrayBuffer()), file.name);
    if (!checked.ok) return { error: checked.message };

    // Uploaded as the doctor, so the storage policy decides whether it is allowed.
    const storagePath = `intake/${doctor.id}/${randomUUID()}.pdf`;
    const { error } = await supabase.storage.from("reports").upload(storagePath, checked.bytes, { contentType: "application/pdf" });
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
      phoneMasked: phone ? maskPhone(phone) : "••••• ••••",
      language,
      route,
      ultrasound,
      consentScope: CONSENT_SCOPE,
      report,
    },
  );
  if (!started.ok) {
    if (report) await admin.storage.from("reports").remove([report.storagePath]);
    if (started.error.code === "duplicate") return { success: `${name} was already enrolled. Nothing was sent twice.`, phoneLink: `/phone/${journeyId}` };
    return { error: started.error.message };
  }

  // Remember whether liver function tests (LFT) were ordered, so the lab can see it on the visit.
  // and whether the doctor flagged it as urgent (it puts the patient first in everyone's list)
  if (lft || urgent) await admin.from("journeys").update({ lft, urgent }).eq("id", journeyId);

  // The full number is kept encrypted, only to send this patient their links, and is erased when the journey closes.
  const kept = phone ? await saveContact(admin, journeyId, phone) : false;

  const { data: row } = await supabase.from("journey_status").select("patient_code").eq("journey_id", journeyId).maybeSingle();
  const code = row?.patient_code ?? "";
  let demoLink: string | undefined;
  try {
    // The first message also carries the patient's progress page, which stays valid for weeks.
    const progress = await issueProgressLink(admin, journeyId);
    if (patientSends) {
      demoLink = await sendBookingLink(admin, journeyId, (url, m) => m.uploadRequest(url, progress));
    } else if (route === "existing_report") {
      await mockProvider(admin).send({ journeyId, channel: "WhatsApp", body: templatesFor(language).existingReportUsed(progress) });
      demoLink = progress; // nothing for the patient to book yet, so the demo link shows their progress
    } else {
      demoLink = await sendBookingLink(admin, journeyId, (url, m) => m.testsOrdered(url, ultrasound, progress, lft));
    }
  } catch {
    // The journey exists; the message log can be filled in later.
  }

  const via = kept ? "to the patient's WhatsApp number" : "by WhatsApp (simulated)";
  return {
    success:
      patientSends
        ? `${name} (${code}) enrolled. A link to upload their report was sent ${via}.`
        : route === "existing_report"
        ? `${name} (${code}) enrolled. The existing report is with the clinician; no repeat test needed.`
        : `${name} (${code}) enrolled. A booking link was sent ${via}.`,
    // In a demo, the message is pretend, so show the link the patient would have tapped. Never shown on a real deployment.
    patientLink: process.env.DEMO_LOGINS === "on" ? demoLink : undefined,
    phoneLink: `/phone/${journeyId}`,
  };
}
