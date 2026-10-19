/**
 * Real WhatsApp delivery for the demo, through Meta's WhatsApp Cloud API.
 *
 * Every message is still saved to the message log (so the patient's-phone view and the audit story keep working). When the
 * three settings below are present, the same text is also sent to ONE demo phone, so a doctor can watch the real WhatsApp
 * message arrive. Patients' own numbers are never stored in full, so nothing is sent to a patient.
 *
 *   WHATSAPP_PHONE_NUMBER_ID  the sender, from Meta's "API Setup" page
 *   WHATSAPP_ACCESS_TOKEN     a permanent system-user token (a secret: set in Vercel, never in the repo)
 *   DEMO_WHATSAPP_TO          the demo phone, country code first and digits only (for example 919876543210)
 *
 * On a test number WhatsApp only lets us send free text inside 24 hours after that phone last messaged the number, so the
 * demo phone sends "Hi" first. Outside that window we fall back to Meta's pre-approved "hello_world" template so something arrives.
 */
const GRAPH_VERSION = "v21.0";

export type WhatsAppEnv = Partial<Record<"WHATSAPP_PHONE_NUMBER_ID" | "WHATSAPP_ACCESS_TOKEN" | "DEMO_WHATSAPP_TO", string | undefined>>;

export type WhatsAppResult = { sent: boolean; reason?: string };

export function whatsappConfigured(env: WhatsAppEnv): boolean {
  return Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN && env.DEMO_WHATSAPP_TO && /^\d{8,15}$/.test(env.DEMO_WHATSAPP_TO));
}

async function post(env: WhatsAppEnv, payload: object, fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl(`https://graph.facebook.com/${GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: env.DEMO_WHATSAPP_TO, ...payload }),
    signal: AbortSignal.timeout(8000),
  });
}

/** Sends the message text to the demo phone. Never throws: a failed relay must not break the booking flow. */
export async function relayToWhatsApp(body: string, env: WhatsAppEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<WhatsAppResult> {
  if (!whatsappConfigured(env)) return { sent: false, reason: "not configured" };
  try {
    const text = await post(env, { type: "text", text: { body, preview_url: true } }, fetchImpl);
    if (text.ok) return { sent: true };

    // outside the 24 hour window Meta refuses free text; send the pre-approved sample template so the phone still hears from us
    const fallback = await post(env, { type: "template", template: { name: "hello_world", language: { code: "en_US" } } }, fetchImpl);
    return fallback.ok ? { sent: true, reason: "template only: the demo phone has not messaged the number in the last 24 hours" } : { sent: false, reason: `Meta answered ${text.status}` };
  } catch {
    return { sent: false, reason: "could not reach Meta" };
  }
}
