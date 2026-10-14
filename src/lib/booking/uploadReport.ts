import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseJourneyStore, transition } from "@/lib/journey/transition";
import { mockProvider } from "@/lib/messages/provider";
import { templatesFor } from "@/lib/messages/templates";
import { normaliseReport } from "@/lib/reports/pdf";
import { loadBookingContext } from "./book";

const PATIENT = { id: "booking-link", role: "patient" } as const;

export type UploadResult =
  | { ok: true }
  | { ok: false; code: "invalid_link" | "not_requested" | "bad_file" | "failed"; message: string };

/**
 * The patient sends their existing lab report through the private link (Option 1 without a file from the doctor).
 * A PDF or a photo is stored as a PDF in private storage, the journey moves to the clinician's queue, and the patient
 * is thanked by message. All stage changes go through transition().
 */
export async function uploadReportForLink(admin: SupabaseClient, token: string, bytes: Uint8Array, fileName: string): Promise<UploadResult> {
  const ctx = await loadBookingContext(admin, token);
  if (!ctx) return { ok: false, code: "invalid_link", message: "This link is no longer valid." };
  if (!ctx.state.awaitingReport) return { ok: false, code: "not_requested", message: "No report is needed right now." };

  const file = await normaliseReport(bytes, fileName);
  if (!file.ok) return { ok: false, code: "bad_file", message: file.message };

  const storagePath = `journeys/${ctx.journeyId}/patient-${randomUUID()}.pdf`;
  const { error: uploadError } = await admin.storage.from("reports").upload(storagePath, file.bytes, { contentType: "application/pdf" });
  if (uploadError) return { ok: false, code: "failed", message: "The report could not be stored." };

  const result = await transition(
    supabaseJourneyStore(admin),
    ctx.journeyId,
    { type: "PATIENT_UPLOAD" },
    PATIENT,
    {},
    { report: { kind: "lab", partnerId: null, storagePath, fileName: file.safeName } },
  );
  if (!result.ok) {
    await admin.storage.from("reports").remove([storagePath]);
    return { ok: false, code: "failed", message: result.error.message };
  }

  await mockProvider(admin)
    .send({ journeyId: ctx.journeyId, channel: "SMS", body: templatesFor(ctx.patient.language).reportReceived() })
    .catch(() => undefined);
  return { ok: true };
}
