import { cn } from "@/lib/utils";

const TONE = {
  neutral: "text-foreground",
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  info: "text-info",
} as const;

/** One headline number with a label. */
export function StatTile({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: number | string;
  tone?: keyof typeof TONE;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-heading text-3xl font-extrabold", TONE[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
