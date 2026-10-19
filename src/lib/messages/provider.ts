import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { relayToWhatsApp } from "./whatsapp";

export type Channel = "WhatsApp" | "SMS";

/** Sends a message to a patient. The only implementation is the mock; a real SMS or WhatsApp provider would replace it. */
export interface NotificationProvider {
  send(message: { journeyId: string; channel: Channel; body: string }): Promise<void>;
}

/**
 * Stores the message in `messages` so it shows in the message log and on the patient's-phone view. When the WhatsApp demo
 * settings are present (see whatsapp.ts) the text is also sent to the one demo phone; otherwise nothing leaves the system.
 */
export function mockProvider(admin: SupabaseClient): NotificationProvider {
  return {
    async send({ journeyId, channel, body }) {
      const { error } = await admin.from("messages").insert({ journey_id: journeyId, channel, body });
      if (error) throw error;
      await relayToWhatsApp(body);
    },
  };
}
