import { MILESTONES, MILESTONES_DONE, STAGE, type Stage } from "@/lib/journey/stages";
import { cn } from "@/lib/utils";

/** Nine-step progress bar (prototype `progress`). Green when complete, red when a visit was missed, amber when held. */
export function JourneyProgress({ stage, missed }: { stage: Stage; missed: boolean }) {
  const done = MILESTONES_DONE[stage];
  const tone = stage === STAGE.COMPLETE ? "bg-ok" : missed ? "bg-bad" : stage === STAGE.DECLINED ? "bg-warn" : "bg-primary";
  return (
    <div
      role="img"
      aria-label={`${done} of ${MILESTONES.length} steps done: ${MILESTONES[Math.max(0, done - 1)]}`}
      className="flex gap-0.5"
    >
      {MILESTONES.map((m, i) => (
        <span key={m} className={cn("h-1.5 flex-1 rounded-full", i < done ? tone : "bg-border")} />
      ))}
    </div>
  );
}
