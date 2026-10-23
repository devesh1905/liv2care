import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptPhone, decryptText, encryptPhone, encryptText } from "./phone";

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

/** Keeps the address for a home visit, encrypted. The database erases it when the journey closes. */
export async function saveAddress(admin: SupabaseClient, bookingId: string, address: string): Promise<boolean> {
  const cipher = encryptText(address, process.env.PHONE_ENCRYPTION_KEY, bookingId);
  if (!cipher) return false;
  const { error } = await admin.from("home_visits").upsert({ booking_id: bookingId, address_cipher: cipher });
  return !error;
}

/** The addresses for these bookings, by booking id. Only call this for bookings the signed-in user is allowed to see. */
export async function addressesFor(admin: SupabaseClient, bookingIds: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (bookingIds.length === 0) return found;
  const { data } = await admin.from("home_visits").select("booking_id, address_cipher").in("booking_id", bookingIds);
  for (const row of data ?? []) {
    const address = decryptText(row.address_cipher, process.env.PHONE_ENCRYPTION_KEY, row.booking_id);
    if (address) found.set(row.booking_id, address);
  }
  return found;
}
