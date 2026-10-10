import { describe, expect, it } from "vitest";
import { formatSlot, formatSlotParts } from "@/lib/format/slot";

describe("formatSlot", () => {
  it("shows India time", () => {
    expect(formatSlot("2026-10-24T03:30:00Z")).toBe("Sat 24 Oct, 9:00 am");
    expect(formatSlot("2026-10-24T10:30:00Z")).toBe("Sat 24 Oct, 4:00 pm");
  });

  it("splits into day and time", () => {
    expect(formatSlotParts("2026-10-24T03:30:00Z")).toEqual({ day: "Sat 24 Oct", time: "9:00 am" });
  });
});
