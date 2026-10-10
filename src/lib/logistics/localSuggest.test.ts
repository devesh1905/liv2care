import { describe, expect, it } from "vitest";
import { istHour, localSuggest } from "./localSuggest";
import type { SlotOption } from "./types";

const opt = (partnerId: string, distanceKm: number, startsAt: string): SlotOption => ({
  partnerId,
  partnerName: partnerId,
  area: "x",
  distanceKm,
  slotId: `${partnerId}-${startsAt}`,
  startsAt,
});

// 03:30Z is 09:00 IST, 06:00Z is 11:30 IST, 10:30Z is 16:00 IST.
const near_late = opt("near", 2, "2026-10-20T10:30:00Z");
const near_morning = opt("near", 2, "2026-10-21T03:30:00Z");
const far_early = opt("far", 8, "2026-10-20T06:00:00Z");

describe("istHour", () => {
  it("converts to India time", () => {
    expect(istHour("2026-10-20T03:30:00Z")).toBe(9);
    expect(istHour("2026-10-20T20:00:00Z")).toBeCloseTo(1.5);
  });
});

describe("localSuggest", () => {
  const all = [near_late, near_morning, far_early];

  it("nearest picks the closest place, then its earliest slot", () => {
    expect(localSuggest(all, "nearest")).toMatchObject({ partnerId: "near", slotId: near_late.slotId, source: "local" });
  });

  it("earliest picks the earliest time anywhere", () => {
    expect(localSuggest(all, "earliest")).toMatchObject({ partnerId: "far" });
  });

  it("morning picks the earliest morning slot", () => {
    // 11:30 IST on the 20th beats 9:00 IST on the 21st, and the 16:00 slot is not a morning
    expect(localSuggest(all, "morning")).toMatchObject({ slotId: far_early.slotId });
    expect(localSuggest([near_late, near_morning], "morning")).toMatchObject({ slotId: near_morning.slotId });
    expect(localSuggest([near_late], "morning")?.reason).toMatch(/earliest time/i);
  });

  it("gives the reason in Hindi when asked", () => {
    expect(localSuggest(all, "nearest", "hi")?.reason).toBe("सबसे नज़दीक, 2 किमी दूर");
    expect(localSuggest(all, "earliest", "hi")?.reason).toMatch(/[ऀ-ॿ]/);
    expect(localSuggest([near_late], "morning", "hi")?.reason).toMatch(/[ऀ-ॿ]/);
  });

  it("returns null when nothing is open", () => {
    expect(localSuggest([], "nearest")).toBeNull();
  });
});
