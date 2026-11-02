import { cn } from "@/lib/utils";

/**
 * The Liv2care mark: a liver with a heartbeat line through it. The liver takes the text colour; the heartbeat is cut out in
 * the brand blue, so the mark sits on a blue tile (white liver) or on a light background (blue liver, white heartbeat).
 */
export function LiverMark({ className, pulse = "var(--primary)", strokeWidth = 2.6 }: { className?: string; pulse?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="3 2 42 42" fill="none" aria-hidden="true" className={cn("shrink-0", className)}>
      <path
        d="M5 19C5 11.5 11 8 19 8H37C42.5 8 44.5 12.5 41.5 16C37.5 21 30 28.5 22.5 34.5C15.5 40 5 37 5 27Z"
        fill="currentColor"
      />
      <path
        d="M10 22.5H16.5L19.5 17L24 27L27 22.5H33"
        stroke={pulse}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
