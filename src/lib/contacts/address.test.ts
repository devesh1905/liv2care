import { describe, expect, it } from "vitest";
import { cleanAddress } from "./address";

describe("cleanAddress", () => {
  it("tidies spaces and keeps line breaks", () => {
    expect(cleanAddress("  Flat 4B,   Green Park \n\n  near the temple, Hyderabad ")).toBe("Flat 4B, Green Park\nnear the temple, Hyderabad");
  });
  it("refuses an address that is empty, too short or too long", () => {
    for (const bad of [undefined, null, "", "   ", "Hyd", "x".repeat(301)]) expect(cleanAddress(bad)).toBeNull();
    expect(cleanAddress("x".repeat(300))).not.toBeNull();
  });
});
