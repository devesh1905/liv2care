import { describe, expect, it } from "vitest";
import { MILESTONES, MILESTONES_DONE, STAGE, STAGE_LABEL } from "./stages";

describe("journey stages", () => {
  const stages = Object.values(STAGE);

  it("has a label for every stage", () => {
    expect(Object.keys(STAGE_LABEL)).toHaveLength(stages.length);
    for (const s of stages) expect(STAGE_LABEL[s]).toBeTruthy();
  });

  it("numbers the stages 0 to 10 with no gaps", () => {
    expect([...stages].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("never reports more milestones done than exist", () => {
    for (const s of stages) expect(MILESTONES_DONE[s]).toBeLessThanOrEqual(MILESTONES.length);
  });

  it("completes every milestone only when the journey is complete", () => {
    for (const s of stages) {
      const allDone = MILESTONES_DONE[s] === MILESTONES.length;
      expect(allDone).toBe(s === STAGE.COMPLETE);
    }
  });
});
