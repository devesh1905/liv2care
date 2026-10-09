import { describe, expect, it } from "vitest";
import { AREA_ROLES, ROLE_HOME, STAFF_ROLES, areaOf, isStaffRole, safeNext } from "./roles";

describe("roles", () => {
  it("every role lands on an area that admits it", () => {
    for (const role of STAFF_ROLES) {
      expect(AREA_ROLES[ROLE_HOME[role]]).toContain(role);
    }
  });

  it("finds the staff area of a path", () => {
    expect(areaOf("/doctor")).toBe("/doctor");
    expect(areaOf("/doctor/patients/1")).toBe("/doctor");
    expect(areaOf("/doctors")).toBeNull();
    expect(areaOf("/login")).toBeNull();
    expect(areaOf("/book/abc")).toBeNull();
  });

  it("recognises staff roles only", () => {
    expect(isStaffRole("ops")).toBe(true);
    expect(isStaffRole("patient")).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });

  it("accepts only same-site relative redirect targets", () => {
    expect(safeNext("/doctor")).toBe("/doctor");
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
