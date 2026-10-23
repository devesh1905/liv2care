import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptPhone, encryptPhone } from "./phone";

/** Keeps the patient's number, encrypted, for sending their links. The database erases it when the journey closes. */
export async function saveContact(admin: SupabaseClient, journeyId: string, digits: string): Promise<boolean> {
  const { data } = await admin.from("journeys").select("patient_id").eq("id", journeyId).maybeSingle();
  if (!data) return false;
  const cipher = encryptPhone(digits, process.env.PHONE_ENCRYPTION_KEY, data.patient_id);
  if (!cipher) return false;
  const { error } = await admin.from("patient_contacts").upsert({ patient_id: data.patient_id, phone_cipher: cipher });
  return !error;
}

/** The patient's number for this journey, or undefined when none is kept (or it cannot be read). */
export async function contactFor(admin: SupabaseClient, journeyId: string): Promise<string | undefined> {
  const { data: journey } = await admin.from("journeys").select("patient_id").eq("id", journeyId).maybeSingle();
  if (!journey) return undefined;
  const { data } = await admin.from("patient_contacts").select("phone_cipher").eq("patient_id", journey.patient_id).maybeSingle();
  if (!data) return undefined;
  return decryptPhone(data.phone_cipher, process.env.PHONE_ENCRYPTION_KEY, journey.patient_id) ?? undefined;
}
