import { HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";

/** Liv2care mark and wordmark. Kanya's icon set replaces the glyph when it lands. */
export function Logo({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-heading font-extrabold tracking-tight", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm",
          size === "lg" ? "size-11" : "size-8",
        )}
      >
        <HeartPulse className={size === "lg" ? "size-6" : "size-4.5"} strokeWidth={2.4} />
      </span>
      <span className={size === "lg" ? "text-2xl" : "text-lg"}>Liv2care</span>
    </span>
  );
}
