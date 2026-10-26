"use server";

import { revalidatePath } from "next/cache";
import { bookForLink, loadBookingContext } from "@/lib/booking/book";
import { aiDeps } from "@/lib/booking/aiLimits";
import { hashToken } from "@/lib/booking/links";
import { loadSlotOptions } from "@/lib/booking/options";
import { uploadReportForLink } from "@/lib/booking/uploadReport";
import { isLang, t, type Lang } from "@/lib/i18n/patient";
import { suggest } from "@/lib/logistics/suggest";
import type { Preference, Suggestion } from "@/lib/logistics/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type BookState = { error?: string; done?: boolean };

const PREFERENCES: readonly Preference[] = ["nearest", "earliest", "morning"];

/** The booking helper: asks the logistics layer for a place and time. It sees slots and the preference, nothing clinical. */
export async function suggestSlot(token: string, preference: string, lang: string, home = false): Promise<Suggestion | null> {
  if (!PREFERENCES.includes(preference as Preference)) return null;
  const admin = createAdminClient();
  const ctx = await loadBookingContext(admin, token);
  if (!ctx?.bookable) return null;
  const options = await loadSlotOptions(admin, ctx.kind, 6, home && ctx.kind === "lab");
  return suggest(
    {
      language: isLang(lang) ? lang : ctx.patient.language,
      area: null,
      partnerKind: ctx.kind,
      preference: preference as Preference,
      options,
    },
    await aiDeps(admin, hashToken(token).slice(0, 16)),
  );
}

export async function bookSlot(_prev: BookState, form: FormData): Promise<BookState> {
  const token = String(form.get("token") ?? "");
  const lang: Lang = isLang(form.get("lang")) ? (form.get("lang") as Lang) : "en";
  // Revalidate up front: Next 16.4 fails to re-render after an action that returns without revalidating.
  revalidatePath(`/book/${token}`);

  const partnerId = String(form.get("partnerId") ?? "");
  const slotId = String(form.get("slotId") ?? "");
  if (!partnerId || !slotId) return { error: t(lang, "pick") };

  const address = Object.fromEntries(["house", "block", "street", "area", "landmark", "pincode", "lat", "lon"].map((k) => [k, form.get(k) ?? ""]));
  const result = await bookForLink(createAdminClient(), token, partnerId, slotId, address);
  // Nothing left to book means this exact form was already accepted a moment ago (a double tap): show the confirmation.
  if (result.ok || result.code === "not_bookable") return { done: true };
  if (result.code === "address_needed") return { error: t(lang, "addressNeeded") };
  return { error: result.code === "slot_unavailable" ? t(lang, "slotTaken") : result.code === "failed" ? t(lang, "somethingWrong") : t(lang, "linkInvalid") };
}

export type UploadState = { error?: string; done?: boolean };

/** The patient sends their existing lab report (a PDF or a photo) through the private link. */
export async function sendReport(_prev: UploadState, form: FormData): Promise<UploadState> {
  const token = String(form.get("token") ?? "");
  const lang: Lang = isLang(form.get("lang")) ? (form.get("lang") as Lang) : "en";
  // Revalidate up front: Next 16.4 fails to re-render after an action that returns without revalidating.
  revalidatePath(`/book/${token}`);

  const file = form.get("report");
  if (!(file instanceof File) || file.size === 0) return { error: t(lang, "uploadChoose") };
  const result = await uploadReportForLink(createAdminClient(), token, new Uint8Array(await file.arrayBuffer()), file.name);
  // No report is needed any more: the same upload was already accepted (a double tap), so show "received".
  if (result.ok || result.code === "not_requested") return { done: true };
  return { error: result.code === "invalid_link" ? t(lang, "linkInvalid") : result.code === "bad_file" ? result.message : t(lang, "uploadFailed") };
}
