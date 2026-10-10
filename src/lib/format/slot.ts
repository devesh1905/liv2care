/** "Sat 24 Oct, 9:00 am" in India Standard Time. */
export function formatSlot(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`;
}

/** The same time split in two for narrow buttons: { day: "Sat 24 Oct", time: "9:00 am" }. */
export function formatSlotParts(iso: string): { day: string; time: string } {
  const [day, time] = formatSlot(iso).split(", ");
  return { day, time };
}
