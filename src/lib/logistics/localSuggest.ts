import type { Preference, SlotOption, Suggestion } from "./types";

const IST_OFFSET_MIN = 330;

/** Hour of day (0 to 23.99) in India Standard Time. */
export function istHour(iso: string): number {
  const d = new Date(iso);
  return (((d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MIN) % 1440) + 1440) % 1440 / 60;
}

const byTime = (a: SlotOption, b: SlotOption) => a.startsAt.localeCompare(b.startsAt);
const byDistance = (a: SlotOption, b: SlotOption) => a.distanceKm - b.distanceKm;

/** Deterministic fallback for the AI helper: nearest place, earliest time, or earliest morning slot. */
export function localSuggest(options: SlotOption[], preference: Preference): Suggestion | null {
  if (options.length === 0) return null;
  let pick: SlotOption;
  let reason: string;

  if (preference === "nearest") {
    pick = [...options].sort((a, b) => byDistance(a, b) || byTime(a, b))[0];
    reason = `Nearest, ${pick.distanceKm} km away`;
  } else if (preference === "morning") {
    const mornings = options.filter((o) => istHour(o.startsAt) < 12);
    const pool = mornings.length > 0 ? mornings : options;
    pick = [...pool].sort((a, b) => byTime(a, b) || byDistance(a, b))[0];
    reason = mornings.length > 0 ? "Earliest morning time" : "No morning times, so the earliest time";
  } else {
    pick = [...options].sort((a, b) => byTime(a, b) || byDistance(a, b))[0];
    reason = "Earliest time available";
  }
  return { partnerId: pick.partnerId, slotId: pick.slotId, reason, source: "local" };
}
