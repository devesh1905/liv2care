import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins class names and lets the last Tailwind class win", () => {
    expect(cn("p-2", "text-sm", "p-4")).toBe("text-sm p-4");
  });

  it("skips falsy values", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });
});
