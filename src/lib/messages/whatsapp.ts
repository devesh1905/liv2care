/**
 * Real WhatsApp delivery for the demo.
 *
 * Every message is still saved to the message log (so the patient's-phone view and the audit story keep working). When one of
 * the sets of settings below is present, the same text is also sent to ONE demo phone, so a doctor can watch the real
 * WhatsApp message arrive. Patients' own numbers are never stored in full, so nothing is sent to a patient.
 *
 * Twilio WhatsApp Sandbox (works without Meta's business verification; used first when set):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN   from the Twilio console (secrets: set in Vercel, never in the repo)
 *   TWILIO_WHATSAPP_FROM                    the sandbox number, for example whatsapp:+14155238886
 *   DEMO_WHATSAPP_TO                        the demo phone(s), country code first and digits only (for example 919876543210);
 *                                           up to 5 numbers separated by commas, for example 919876543210,917397313854;
 *                                           the phone must first join the sandbox by sending Twilio's join message
 *
 * Meta's WhatsApp Cloud API (needs the business verified by Meta before it can send):
 *   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, DEMO_WHATSAPP_TO
 *
 * Both only deliver free text inside 24 hours after the demo phone last messaged the sender, so the phone sends "Hi" first.
 */
const GRAPH_VERSION = "v21.0";

export type WhatsAppEnv = Partial<
  Record<
    "WHATSAPP_PHONE_NUMBER_ID" | "WHATSAPP_ACCESS_TOKEN" | "DEMO_WHATSAPP_TO" | "TWILIO_ACCOUNT_SID" | "TWILIO_AUTH_TOKEN" | "TWILIO_WHATSAPP_FROM",
    string | undefined
  >
>;

export type WhatsAppResult = { sent: boolean; reason?: string };

/** The demo phones: one or a few numbers separated by commas, each with country code first and digits only. */
export function demoNumbers(env: WhatsAppEnv): string[] {
  return (env.DEMO_WHATSAPP_TO ?? "").split(",").map((n) => n.trim()).filter(Boolean);
}

const validTo = (env: WhatsAppEnv) => {
  const numbers = demoNumbers(env);
  return numbers.length >= 1 && numbers.length <= 5 && numbers.every((n) => /^\d{8,15}$/.test(n));
};

export function twilioConfigured(env: WhatsAppEnv): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM && /^whatsapp:\+\d{8,15}$/.test(env.TWILIO_WHATSAPP_FROM) && validTo(env));
}

export function metaConfigured(env: WhatsAppEnv): boolean {
  return Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN && validTo(env));
}

/** True when a real WhatsApp sender is set up. */
export function whatsappConfigured(env: WhatsAppEnv): boolean {
  return twilioConfigured(env) || metaConfigured(env);
}

async function relayViaTwilio(body: string, to: string, env: WhatsAppEnv, fetchImpl: typeof fetch): Promise<WhatsAppResult> {
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: env.TWILIO_WHATSAPP_FROM!, To: `whatsapp:+${to}`, Body: body }).toString(),
    signal: AbortSignal.timeout(8000),
  });
  return res.ok ? { sent: true } : { sent: false, reason: `Twilio answered ${res.status}: the demo phone may not have joined the sandbox or messaged it in the last 24 hours` };
}

async function metaPost(env: WhatsAppEnv, to: string, payload: object, fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl(`https://graph.facebook.com/${GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
    signal: AbortSignal.timeout(8000),
  });
}

async function relayViaMeta(body: string, to: string, env: WhatsAppEnv, fetchImpl: typeof fetch): Promise<WhatsAppResult> {
  const text = await metaPost(env, to, { type: "text", text: { body, preview_url: true } }, fetchImpl);
  if (text.ok) return { sent: true };
  // outside the 24 hour window Meta refuses free text; send the pre-approved sample template so the phone still hears from us
  const fallback = await metaPost(env, to, { type: "template", template: { name: "hello_world", language: { code: "en_US" } } }, fetchImpl);
  return fallback.ok ? { sent: true, reason: "template only: the demo phone has not messaged the number in the last 24 hours" } : { sent: false, reason: `Meta answered ${text.status}` };
}

/** Sends the message text to the demo phone. Never throws: a failed relay must not break the booking flow. */
export async function relayToWhatsApp(body: string, env: WhatsAppEnv = process.env as WhatsAppEnv, fetchImpl: typeof fetch = fetch): Promise<WhatsAppResult> {
  if (!whatsappConfigured(env)) return { sent: false, reason: "not configured" };
  // every demo phone gets the message; one phone failing (for example, it has not joined yet) does not stop the others
  const results = await Promise.all(
    demoNumbers(env).map(async (to) => {
      try {
        return twilioConfigured(env) ? await relayViaTwilio(body, to, env, fetchImpl) : await relayViaMeta(body, to, env, fetchImpl);
      } catch {
        return { sent: false, reason: "could not reach the WhatsApp service" } as WhatsAppResult;
      }
    }),
  );
  return results.find((r) => r.sent) ?? results[0];
}
