import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { languageOf } from "@/lib/messages/language";
import { mockProvider, type Channel } from "@/lib/messages/provider";
import { templatesFor, type Templates } from "@/lib/messages/templates";
import { issueBookingLink } from "./links";

/**
 * Issues a fresh booking link for the journey and sends it to the patient (mocked), in the patient's own language.
 * `compose` receives the link and that language's templates. When the doctor flagged the patient as urgent, the message
 * starts by saying so. Returns the link.
 */
export async function sendBookingLink(
  admin: SupabaseClient,
  journeyId: string,
  compose: (url: string, t: Templates) => string,
  channel: Channel = "WhatsApp",
): Promise<string> {
  const [url, language, { data: flags }] = await Promise.all([
    issueBookingLink(admin, journeyId),
    languageOf(admin, journeyId),
    admin.from("journeys").select("urgent").eq("id", journeyId).maybeSingle(),
  ]);
  const t = templatesFor(language);
  const body = compose(url, t);
  await mockProvider(admin).send({ journeyId, channel, body: flags?.urgent ? `${t.urgentNote()}\n${body}` : body });
  return url;
}
