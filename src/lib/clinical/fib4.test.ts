import { describe, expect, it } from "vitest";
import { fib4 } from "./fib4";

describe("fib4", () => {
  it("follows the published formula (age x AST) / (platelets x sqrt(ALT))", () => {
    // 50 x 40 / (200 x sqrt(25)) = 2000 / 1000 = 2
    expect(fib4({ age: 50, ast: 40, alt: 25, platelets: 200 })).toBe(2);
    // 62 x 35 / (180 x sqrt(30)) = 2170 / 985.9 = 2.20
    expect(fib4({ age: 62, ast: 35, alt: 30, platelets: 180 })).toBe(2.2);
  });

  it("gives nothing for missing or impossible values", () => {
    expect(fib4({ age: Number.NaN, ast: 40, alt: 25, platelets: 200 })).toBeNull();
    expect(fib4({ age: 50, ast: 40, alt: 0, platelets: 200 })).toBeNull();
    expect(fib4({ age: 50, ast: 40, alt: 25, platelets: 0 })).toBeNull();
    expect(fib4({ age: 12, ast: 40, alt: 25, platelets: 200 })).toBeNull();
  });
});
