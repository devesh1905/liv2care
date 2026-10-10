import { describe, expect, it } from "vitest";
import { templates } from "./templates";

describe("message templates", () => {
  it("mention the ultrasound only when ordered", () => {
    expect(templates.testsOrdered("P-1007", true)).toContain("and an ultrasound");
    expect(templates.testsOrdered("P-1007", false)).not.toContain("ultrasound");
    expect(templates.testsOrdered("P-1007", false)).toContain("liv2care.demo/b/p-1007");
  });
});
