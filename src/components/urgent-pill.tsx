import { Siren } from "lucide-react";

/** Marks a patient the treating doctor flagged as urgent. */
export function UrgentPill() {
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-bad-soft px-2.5 py-0.5 text-xs font-bold text-bad">
      <Siren className="size-3.5" aria-hidden="true" />
      Urgent
    </span>
  );
}
