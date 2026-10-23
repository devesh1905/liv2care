/** A home-collection address as typed by the patient: tidy it up, and refuse one that is too short or far too long. */
export function cleanAddress(input: string | null | undefined): string | null {
  const text = (input ?? "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  return text.length >= 10 && text.length <= 300 ? text : null;
}
