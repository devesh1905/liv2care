import type { Preference, SlotOption, Suggestion } from "./types";

const IST_OFFSET_MIN = 330;

/** Hour of day (0 to 23.99) in India Standard Time. */
export function istHour(iso: string): number {
  const d = new Date(iso);
  return (((d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MIN) % 1440) + 1440) % 1440 / 60;
}

const byTime = (a: SlotOption, b: SlotOption) => a.startsAt.localeCompare(b.startsAt);
const byDistance = (a: SlotOption, b: SlotOption) => a.distanceKm - b.distanceKm;

type Lang = "en" | "hi";

/** Plain reasons shown when the AI is off or fails. Hindi wording is a draft for review. */
const REASON = {
  nearest: { en: (km: number) => `Nearest, ${km} km away`, hi: (km: number) => `सबसे नज़दीक, ${km} किमी दूर` },
  earliest: { en: () => "Earliest time available", hi: () => "सबसे जल्दी उपलब्ध समय" },
  morning: { en: () => "Earliest morning time", hi: () => "सबसे जल्दी सुबह का समय" },
  noMorning: { en: () => "No morning times, so the earliest time", hi: () => "सुबह का कोई समय नहीं, इसलिए सबसे जल्दी का समय" },
} as const;

/**
 * The choice itself is always made here, by code: nearest place, earliest time, or earliest morning slot.
 * A language model is bad at picking the minimum of many timestamps, so it is only used to phrase the reason.
 */
export function pickSlot(options: SlotOption[], preference: Preference): { pick: SlotOption; morningFound: boolean } | null {
  if (options.length === 0) return null;
  if (preference === "nearest") return { pick: [...options].sort((a, b) => byDistance(a, b) || byTime(a, b))[0], morningFound: true };
  if (preference === "morning") {
    const mornings = options.filter((o) => istHour(o.startsAt) < 12);
    const pool = mornings.length > 0 ? mornings : options;
    return { pick: [...pool].sort((a, b) => byTime(a, b) || byDistance(a, b))[0], morningFound: mornings.length > 0 };
  }
  return { pick: [...options].sort((a, b) => byTime(a, b) || byDistance(a, b))[0], morningFound: true };
}

export function localReason(pick: SlotOption, preference: Preference, morningFound: boolean, language: Lang): string {
  if (preference === "nearest") return REASON.nearest[language](pick.distanceKm);
  if (preference === "morning") return (morningFound ? REASON.morning : REASON.noMorning)[language]();
  return REASON.earliest[language]();
}

/** Deterministic suggestion with a plain reason. Used directly when the AI is unavailable. */
export function localSuggest(options: SlotOption[], preference: Preference, language: Lang = "en"): Suggestion | null {
  const chosen = pickSlot(options, preference);
  if (!chosen) return null;
  return {
    partnerId: chosen.pick.partnerId,
    slotId: chosen.pick.slotId,
    reason: localReason(chosen.pick, preference, chosen.morningFound, language),
    source: "local",
  };
}
