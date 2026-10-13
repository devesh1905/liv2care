/**
 * Turns the slot form's four fields (date, hour 1-12, minute, AM/PM) into a moment in time, read as India time.
 * The form uses plain selects instead of the browser's date-time picker because that picker looks different in every
 * browser (some show AM/PM, some do not).
 */
export function parseSlotInput(date: string, hour: string, minute: string, period: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isInteger(h) || h < 1 || h > 12) return null;
  if (!Number.isInteger(m) || m < 0 || m > 59) return null;
  if (period !== "AM" && period !== "PM") return null;
  const hour24 = (h % 12) + (period === "PM" ? 12 : 0);
  const when = new Date(`${date}T${String(hour24).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);
  return Number.isNaN(when.getTime()) ? null : when;
}
