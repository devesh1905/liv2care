import { cn } from "@/lib/utils";
import { LiverMark } from "./liver-mark";

/** Liv2care mark (a liver with a heartbeat line) and wordmark. */
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
        <LiverMark className={size === "lg" ? "size-8" : "size-6"} />
      </span>
      <span className={size === "lg" ? "text-2xl" : "text-lg"}>Liv2care</span>
    </span>
  );
}
