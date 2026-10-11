import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessageLang } from "./templates";

/** The language a patient's messages go out in. English if the patient or the journey cannot be found. */
export async function languageOf(admin: SupabaseClient, journeyId: string): Promise<MessageLang> {
  const { data } = await admin.from("journeys").select("patients(language)").eq("id", journeyId).maybeSingle();
  const patient = data?.patients as unknown as { language?: string } | null;
  return patient?.language === "hi" ? "hi" : "en";
}
