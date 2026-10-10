import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mockProvider, type Channel } from "@/lib/messages/provider";
import { issueBookingLink } from "./links";

/** Issues a fresh booking link for the journey and sends it to the patient (mocked). Returns the link. */
export async function sendBookingLink(
  admin: SupabaseClient,
  journeyId: string,
  compose: (url: string) => string,
  channel: Channel = "WhatsApp",
): Promise<string> {
  const url = await issueBookingLink(admin, journeyId);
  await mockProvider(admin).send({ journeyId, channel, body: compose(url) });
  return url;
}
