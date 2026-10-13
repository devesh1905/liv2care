import { describe, expect, it } from "vitest";
import { parseSlotInput } from "./slotInput";

describe("parseSlotInput", () => {
  it("reads the time as India time", () => {
    expect(parseSlotInput("2026-10-20", "10", "30", "AM")?.toISOString()).toBe("2026-10-20T05:00:00.000Z");
    expect(parseSlotInput("2026-10-20", "4", "15", "PM")?.toISOString()).toBe("2026-10-20T10:45:00.000Z");
  });

  it("handles 12 AM and 12 PM", () => {
    expect(parseSlotInput("2026-10-20", "12", "00", "AM")?.toISOString()).toBe("2026-10-19T18:30:00.000Z");
    expect(parseSlotInput("2026-10-20", "12", "00", "PM")?.toISOString()).toBe("2026-10-20T06:30:00.000Z");
  });

  it("rejects missing or invalid parts", () => {
    expect(parseSlotInput("", "10", "00", "AM")).toBeNull();
    expect(parseSlotInput("2026-10-20", "13", "00", "AM")).toBeNull();
    expect(parseSlotInput("2026-10-20", "10", "75", "AM")).toBeNull();
    expect(parseSlotInput("2026-10-20", "10", "00", "xm")).toBeNull();
    expect(parseSlotInput("2026-13-45", "10", "00", "AM")).toBeNull();
  });
});
