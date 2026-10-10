import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/journey/derived";

const TONE: Record<StatusTone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
  bad: "bg-bad-soft text-bad",
};

/** Status chip. The dot and the word carry the meaning, so colour is never the only cue. */
export function StatusPill({ label, tone, className }: { label: string; tone: StatusTone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", TONE[tone], className)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
