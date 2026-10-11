import { describe, expect, it } from "vitest";
import { pickReminders } from "./pick";

const now = Date.parse("2026-10-20T12:00:00Z");
const task = (journey_id: string, owner: string, due_at: string) => ({ journey_id, owner, due_at });

describe("pickReminders", () => {
  it("reminds only patient-owned actions that are overdue, most overdue first", () => {
    const picked = pickReminders(
      [
        task("a", "Patient", "2026-10-20T09:00:00Z"),
        task("b", "Patient", "2026-10-19T09:00:00Z"),
        task("c", "Lab", "2026-10-18T09:00:00Z"), // staff-owned: flagged, never messaged to the patient
        task("d", "Patient", "2026-10-21T09:00:00Z"), // not due yet
      ],
      now,
    );
    expect(picked).toEqual(["b", "a"]);
  });

  it("lists a journey once", () => {
    expect(pickReminders([task("a", "Patient", "2026-10-19T09:00:00Z"), task("a", "Patient", "2026-10-20T09:00:00Z")], now)).toEqual(["a"]);
  });

  it("returns nothing when nothing is overdue", () => {
    expect(pickReminders([], now)).toEqual([]);
  });
});
