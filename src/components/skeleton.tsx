import { cn } from "@/lib/utils";

/** A grey placeholder block. It only pulses for people who have not asked their device for less motion. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-xl bg-muted motion-safe:animate-pulse", className)} />;
}

/** One card's worth of placeholder: a title, a pill, a progress bar and two lines. */
function CardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/**
 * What a page shows while its data loads: the shape of the page (numbers on top, then cards) instead of an empty grey box,
 * so the page does not jump when the real content arrives.
 */
export function PageSkeleton({ tiles = 0, cards = 2 }: { tiles?: number; cards?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-6">
      {tiles > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: tiles }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: cards }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
