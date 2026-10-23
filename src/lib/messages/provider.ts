import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contactFor } from "@/lib/contacts/store";
import { relayToWhatsApp, type WhatsAppEnv } from "./whatsapp";

export type Channel = "WhatsApp" | "SMS";

/** Sends a message to a patient. The only implementation is the mock; a real SMS or WhatsApp provider would replace it. */
export interface NotificationProvider {
  send(message: { journeyId: string; channel: Channel; body: string }): Promise<void>;
}

/**
 * Stores the message in `messages` so it shows in the message log and on the patient's-phone view. When WhatsApp is set up
 * (see whatsapp.ts) the text is also sent: to the patient's own number if the doctor gave one (kept encrypted until the
 * journey closes), otherwise to the demo phones; with neither, nothing leaves the system.
 */
export function mockProvider(admin: SupabaseClient): NotificationProvider {
  return {
    async send({ journeyId, channel, body }) {
      const { error } = await admin.from("messages").insert({ journey_id: journeyId, channel, body });
      if (error) throw error;
      await relayToWhatsApp(body, process.env as WhatsAppEnv, fetch, await contactFor(admin, journeyId));
    },
  };
}
