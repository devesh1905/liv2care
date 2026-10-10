import { formatSlot } from "@/lib/format/slot";
import { localSuggest } from "./localSuggest";
import type { Preference, SlotOption, SuggestInput, Suggestion } from "./types";

/**
 * The AI booking helper, and the only module that talks to Gemini.
 * It takes a SuggestInput (language, area, partner kind, preference, open slots) and nothing else, so no clinical
 * value can reach the model. It falls back to the local sort whenever the model is off, capped, slow or wrong.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_OPTIONS = 24;
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

/** The exact request body sent to Gemini. Exported so a test can assert what leaves the system. */
export function buildGeminiRequest(input: SuggestInput, options: SlotOption[]) {
  const lines = options.map(
    (o, i) => `${i}: ${clean(o.partnerName)}, ${clean(o.area)}, ${o.distanceKm} km away, ${formatSlot(o.startsAt)}`,
  );
  const prompt = [
    "You help a patient pick a booking slot. Choose exactly one option from the list.",
    `Kind of place: ${input.partnerKind}.`,
    `Patient preference: ${describe(input.preference)}.`,
    input.area ? `Patient area: ${clean(input.area)}.` : "Patient area: unknown.",
    "Options (index: place, area, distance, time in India time):",
    ...lines,
    `Reply as JSON: {"choice": <option index>, "reason": "<at most 12 words, in ${input.language === "hi" ? "Hindi" : "English"}>"}.`,
    "Give no medical advice and mention nothing except the place, distance and time.",
  ].join("\n");

  return {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 200,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: { choice: { type: "INTEGER" }, reason: { type: "STRING" } },
        required: ["choice", "reason"],
      },
    },
  };
}

function describe(p: Preference): string {
  return p === "nearest" ? "the nearest place" : p === "earliest" ? "the earliest time" : "a morning time (before noon)";
}

/** Parses the model reply. Returns null unless it names a real option. */
export function parseGeminiReply(body: unknown, options: SlotOption[]): Suggestion | null {
  const text = (body as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") return null;
  let parsed: { choice?: unknown; reason?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const { choice, reason } = parsed;
  if (typeof choice !== "number" || !Number.isInteger(choice) || choice < 0 || choice >= options.length) return null;
  if (typeof reason !== "string" || reason.trim() === "") return null;
  const pick = options[choice];
  return { partnerId: pick.partnerId, slotId: pick.slotId, reason: reason.trim().slice(0, MAX_REASON_CHARS), source: "gemini" };
}

export async function suggest(input: SuggestInput, deps: SuggestDeps = {}): Promise<Suggestion | null> {
  const fallback = localSuggest(input.options, input.preference);
  if (!fallback) return null;

  const apiKey = deps.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;

  try {
    if (deps.consume) {
      const dailyCap = deps.dailyCap ?? Number(process.env.AI_DAILY_CAP ?? 200);
      if (!(await deps.consume("global", dailyCap))) return fallback;
      if (deps.callerKey && !(await deps.consume(`caller:${deps.callerKey}`, deps.perCallerCap ?? 20))) return fallback;
    }

    // Keep the prompt small and stable: the earliest options, each with its place and time.
    const options = [...input.options].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, MAX_OPTIONS);
    const model = deps.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    const res = await (deps.fetchImpl ?? fetch)(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(buildGeminiRequest(input, options)),
      signal: AbortSignal.timeout(deps.timeoutMs ?? 6000),
    });
    if (!res.ok) return fallback;
    return parseGeminiReply(await res.json(), options) ?? fallback;
  } catch {
    return fallback;
  }
}
