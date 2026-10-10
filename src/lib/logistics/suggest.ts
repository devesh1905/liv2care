import { formatSlot } from "@/lib/format/slot";
import { localReason, pickSlot } from "./localSuggest";
import type { Preference, SlotOption, SuggestInput, Suggestion } from "./types";

/**
 * The AI booking helper, and the only module that talks to Gemini.
 *
 * Code chooses the slot (nearest, earliest or earliest morning) because small models are unreliable at picking the
 * minimum of many timestamps. Gemini is asked only to phrase one friendly reason, in the patient's language, from the
 * facts of that single slot. The reply is rejected if it is empty, too long, in the wrong script, or contains a number
 * that is not in the facts. Any failure falls back to a plain translated reason, so booking never depends on the model.
 *
 * It takes a SuggestInput (language, area, partner kind, preference, open slots) and nothing else, so no clinical value
 * can reach the model.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
/**
 * The cheapest model that passed our check (one grounded sentence, English and Hindi): Gemma 4 26B, free on the Gemini
 * API's free tier. That tier may use prompts to improve Google products; ours hold only fake slot logistics, but a real
 * pilot should set GEMINI_MODEL to a paid Flash-Lite model such as gemini-3.5-flash-lite (about 1 s) or
 * gemini-3.1-flash-lite (cheaper, about 4 s). gemini-2.5-* models reject new API keys.
 */
export const DEFAULT_MODEL = "gemma-4-26b-a4b-it";
const MAX_REASON_CHARS = 120;

export type SuggestDeps = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  /** Counts one call against a daily cap. Returns false when the cap is reached. */
  consume?: (key: string, cap: number) => Promise<boolean>;
  /** Extra per-caller key (for example one booking link) so one patient cannot use the whole budget. */
  callerKey?: string;
  dailyCap?: number;
  perCallerCap?: number;
  timeoutMs?: number;
};

const clean = (s: string) => s.replace(/[\r\n\t]+/g, " ").replace(/[^\p{L}\p{N} .,'()&/-]/gu, "").slice(0, 80);

function describe(p: Preference): string {
  return p === "nearest" ? "the nearest place" : p === "earliest" ? "the earliest time" : "a morning time (before noon)";
}

/** The facts the model may use, as plain text. Also the source of the numbers a reply is allowed to contain. */
function factsFor(pick: SlotOption): string {
  return `place: ${clean(pick.partnerName)}; area: ${clean(pick.area)}; distance: ${pick.distanceKm} km; time: ${formatSlot(pick.startsAt)} (India time)`;
}

/** The exact request body sent to Gemini. Exported so a test can assert what leaves the system. */
export function buildGeminiRequest(input: SuggestInput, pick: SlotOption) {
  const prompt = [
    `Write ONE short, friendly sentence (at most 15 words) in ${input.language === "hi" ? "Hindi" : "English"} telling a patient why this appointment was chosen for them.`,
    `The patient asked for: ${describe(input.preference)}.`,
    `Use only these facts: ${factsFor(pick)}.`,
    "Do not give medical advice. Do not add any other facts or numbers.",
    'Reply as JSON: {"reason": "<the sentence>"}.',
  ].join("\n");

  return {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 512,
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT", properties: { reason: { type: "STRING" } }, required: ["reason"] },
    },
  };
}

const DEVANAGARI_DIGITS = "०१२३४५६७८९";
const toAsciiDigits = (s: string) => s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));

/** Every number in the reply must already be in the facts (distance, day, hour, minutes). */
export function numbersAreGrounded(reply: string, facts: string): boolean {
  const allowed = new Set(toAsciiDigits(facts).match(/\d+/g) ?? []);
  return (toAsciiDigits(reply).match(/\d+/g) ?? []).every((n) => allowed.has(n) || allowed.has(String(Number(n))));
}

/** Parses and checks the model reply. Returns the sentence, or null if it must not be shown. */
export function parseReason(body: unknown, language: "en" | "hi", pick: SlotOption): string | null {
  const text = (body as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("");
  if (!text) return null;
  let reason: unknown;
  try {
    reason = (JSON.parse(text) as { reason?: unknown }).reason;
  } catch {
    return null;
  }
  if (typeof reason !== "string") return null;
  const r = reason.trim();
  if (r === "" || r.length > MAX_REASON_CHARS) return null;
  if (language === "hi" && !/[ऀ-ॿ]/.test(r)) return null;
  if (!numbersAreGrounded(r, factsFor(pick))) return null;
  return r;
}

export async function suggest(input: SuggestInput, deps: SuggestDeps = {}): Promise<Suggestion | null> {
  const chosen = pickSlot(input.options, input.preference);
  if (!chosen) return null;
  const { pick, morningFound } = chosen;
  const fallback: Suggestion = {
    partnerId: pick.partnerId,
    slotId: pick.slotId,
    reason: localReason(pick, input.preference, morningFound, input.language),
    source: "local",
  };

  const apiKey = (deps.apiKey ?? process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) return fallback;

  try {
    if (deps.consume) {
      const dailyCap = deps.dailyCap ?? Number(process.env.AI_DAILY_CAP ?? 200);
      if (!(await deps.consume("global", dailyCap))) return fallback;
      if (deps.callerKey && !(await deps.consume(`caller:${deps.callerKey}`, deps.perCallerCap ?? 20))) return fallback;
    }

    const model = deps.model ?? (process.env.GEMINI_MODEL || DEFAULT_MODEL);
    const res = await (deps.fetchImpl ?? fetch)(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(buildGeminiRequest(input, pick)),
      signal: AbortSignal.timeout(deps.timeoutMs ?? 6000),
    });
    if (!res.ok) return fallback;
    const reason = parseReason(await res.json(), input.language, pick);
    return reason ? { ...fallback, reason, source: "gemini" } : fallback;
  } catch {
    return fallback;
  }
}
