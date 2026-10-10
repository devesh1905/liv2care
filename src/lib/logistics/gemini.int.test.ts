import { describe, expect, it } from "vitest";
import { localSuggest } from "./localSuggest";
import { suggest } from "./suggest";
import type { SlotOption, SuggestInput } from "./types";

/**
 * One real call to Gemini with invented slots (logistics only). Skipped when no GEMINI_API_KEY is set.
 * Run with `npm run test:int`. It checks the key, the model name and that a reply passes our checks.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // the key may come from the environment
}

const options: SlotOption[] = [
  { partnerId: "p-near", partnerName: "Sunrise Diagnostics", area: "Andheri", distanceKm: 2, slotId: "s1", startsAt: "2026-10-20T10:30:00Z" },
  { partnerId: "p-near", partnerName: "Sunrise Diagnostics", area: "Andheri", distanceKm: 2, slotId: "s2", startsAt: "2026-10-21T03:30:00Z" },
  { partnerId: "p-far", partnerName: "CityCare Labs", area: "Thane", distanceKm: 8, slotId: "s3", startsAt: "2026-10-20T03:30:00Z" },
];
const input = (language: "en" | "hi", preference: SuggestInput["preference"]): SuggestInput => ({ language, area: "Andheri", partnerKind: "lab", preference, options });

describe.skipIf(!process.env.GEMINI_API_KEY)("Gemini booking helper (live)", () => {
  it("keeps the code's pick and returns a grounded sentence from the model", async () => {
    const s = await suggest(input("en", "nearest"), { timeoutMs: 20_000 });
    expect(s).toMatchObject({ partnerId: "p-near", slotId: "s1" }); // always the code's choice
    expect(s!.reason.length).toBeGreaterThan(3);
    // "local" here means the key, the model name (GEMINI_MODEL), the network or our checks rejected the reply
    expect(s!.source).toBe("gemini");
  });

  it("always returns the right pick, and a Devanagari reason in Hindi, even when the model slips", async () => {
    for (const preference of ["nearest", "earliest", "morning"] as const) {
      const s = await suggest(input("hi", preference), { timeoutMs: 20_000 });
      expect(s!.slotId).toBe(localSuggest(options, preference)!.slotId);
      expect(/[\u0900-\u097F]/.test(s!.reason)).toBe(true); // model reply, or the translated fallback
    }
  });
});
