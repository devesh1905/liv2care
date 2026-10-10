"use server";

import { revalidatePath } from "next/cache";
import { bookForLink, loadBookingContext } from "@/lib/booking/book";
import { loadSlotOptions } from "@/lib/booking/options";
import { isLang, t, type Lang } from "@/lib/i18n/patient";
import { suggest } from "@/lib/logistics/suggest";
import type { Preference, Suggestion } from "@/lib/logistics/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type BookState = { error?: string; done?: boolean };

const PREFERENCES: readonly Preference[] = ["nearest", "earliest", "morning"];

/** The booking helper: asks the logistics layer for a place and time. It sees slots and the preference, nothing clinical. */
export async function suggestSlot(token: string, preference: string, lang: string): Promise<Suggestion | null> {
  if (!PREFERENCES.includes(preference as Preference)) return null;
  const admin = createAdminClient();
  const ctx = await loadBookingContext(admin, token);
  if (!ctx?.bookable) return null;
  const options = await loadSlotOptions(admin, ctx.kind);
  return suggest({
    language: isLang(lang) ? lang : ctx.patient.language,
    area: null,
    partnerKind: ctx.kind,
    preference: preference as Preference,
    options,
  });
}

export async function bookSlot(_prev: BookState, form: FormData): Promise<BookState> {
  const token = String(form.get("token") ?? "");
  const lang: Lang = isLang(form.get("lang")) ? (form.get("lang") as Lang) : "en";
  // Revalidate up front: Next 16.4 fails to re-render after an action that returns without revalidating.
  revalidatePath(`/book/${token}`);

  const partnerId = String(form.get("partnerId") ?? "");
  const slotId = String(form.get("slotId") ?? "");
  if (!partnerId || !slotId) return { error: t(lang, "pick") };

  const result = await bookForLink(createAdminClient(), token, partnerId, slotId);
  if (result.ok) return { done: true };
  return { error: result.code === "slot_unavailable" ? t(lang, "slotTaken") : result.code === "failed" ? t(lang, "somethingWrong") : t(lang, "linkInvalid") };
}
