import { describe, expect, it } from "vitest";
import { timeUntil } from "./countdown";

const now = Date.parse("2026-10-20T10:00:00Z");
const at = (ms: number) => new Date(now + ms).toISOString();
const MIN = 60_000;

describe("timeUntil", () => {
  it("says days and hours", () => {
    expect(timeUntil(at(2 * 1440 * MIN + 3 * 60 * MIN), now)).toBe("in 2 days 3 h");
    expect(timeUntil(at(1440 * MIN), now)).toBe("in 1 day");
  });
  it("says hours and minutes", () => {
    expect(timeUntil(at(5 * 60 * MIN + 20 * MIN), now)).toBe("in 5 h 20 min");
    expect(timeUntil(at(3 * 60 * MIN), now)).toBe("in 3 h");
  });
  it("says minutes, and under a minute", () => {
    expect(timeUntil(at(40 * MIN), now)).toBe("in 40 min");
    expect(timeUntil(at(20_000), now)).toBe("in under a minute");
  });
  it("is null once the time has come", () => {
    expect(timeUntil(at(0), now)).toBeNull();
    expect(timeUntil(at(-5 * MIN), now)).toBeNull();
    expect(timeUntil("not a date", now)).toBeNull();
  });
});
