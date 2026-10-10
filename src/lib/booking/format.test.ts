import { describe, expect, it } from "vitest";
import { formatSlot } from "./format";

describe("formatSlot", () => {
  it("shows India time", () => {
    expect(formatSlot("2026-10-24T03:30:00Z")).toBe("Sat 24 Oct, 9:00 am");
    expect(formatSlot("2026-10-24T10:30:00Z")).toBe("Sat 24 Oct, 4:00 pm");
  });
});
