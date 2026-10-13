/**
 * How long until a moment, in plain words: "in 2 days 3 h", "in 5 h 20 min", "in 40 min", "in under a minute".
 * Returns null once the moment has arrived.
 */
export function timeUntil(iso: string, nowMs: number): string | null {
  const ms = new Date(iso).getTime() - nowMs;
  if (Number.isNaN(ms) || ms <= 0) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "in under a minute";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days >= 1) return `in ${days} ${days === 1 ? "day" : "days"}${hours ? ` ${hours} h` : ""}`;
  if (hours >= 1) return `in ${hours} h${mins ? ` ${mins} min` : ""}`;
  return `in ${mins} min`;
}
