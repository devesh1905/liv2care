import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { languageOf } from "@/lib/messages/language";
import { mockProvider, type Channel } from "@/lib/messages/provider";
import { templatesFor, type Templates } from "@/lib/messages/templates";
import { issueBookingLink } from "./links";

/**
 * Issues a fresh booking link for the journey and sends it to the patient (mocked), in the patient's own language.
 * `compose` receives the link and that language's templates. Returns the link.
 */
export async function sendBookingLink(
  admin: SupabaseClient,
  journeyId: string,
  compose: (url: string, t: Templates) => string,
  channel: Channel = "WhatsApp",
): Promise<string> {
  const [url, language] = await Promise.all([issueBookingLink(admin, journeyId), languageOf(admin, journeyId)]);
  await mockProvider(admin).send({ journeyId, channel, body: compose(url, templatesFor(language)) });
  return url;
}
