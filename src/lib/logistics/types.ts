/**
 * The logistics layer sees logistics only: language, area, partner kind, preference and slot availability.
 * It must never import report, review or journey types. ESLint enforces that for this folder.
 */
export type Preference = "nearest" | "earliest" | "morning";
export type PartnerKind = "lab" | "centre" | "eval" | "specialist" | "routine";

export type SlotOption = {
  partnerId: string;
  partnerName: string;
  area: string;
  distanceKm: number;
  slotId: string;
  /** ISO 8601 instant. */
  startsAt: string;
};

export type SuggestInput = {
  language: "en" | "hi";
  /** The patient's area, if known. Never a street address. */
  area: string | null;
  partnerKind: PartnerKind;
  preference: Preference;
  options: SlotOption[];
};

export type Suggestion = {
  partnerId: string;
  slotId: string;
  /** Short plain-language reason shown to the patient. */
  reason: string;
  source: "local" | "gemini";
};
