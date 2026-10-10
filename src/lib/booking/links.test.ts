import { describe, expect, it } from "vitest";
import { bookingUrl, hashToken, looksLikeToken, newToken } from "./links";

describe("booking link tokens", () => {
  it("are long, URL-safe and unique", () => {
    const a = newToken();
    expect(a).toHaveLength(32);
    expect(looksLikeToken(a)).toBe(true);
    expect(newToken()).not.toBe(a);
  });

  it("are stored only as a SHA-256 hash", () => {
    const t = newToken();
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
    expect(hashToken(t)).toBe(hashToken(t));
  });

  it("reject anything that is not shaped like a token", () => {
    expect(looksLikeToken("")).toBe(false);
    expect(looksLikeToken("p-1001")).toBe(false);
    expect(looksLikeToken("../../etc/passwd")).toBe(false);
    expect(looksLikeToken("a".repeat(33))).toBe(false);
  });

  it("build the patient URL", () => {
    expect(bookingUrl("abc", "https://liv2care.example/")).toBe("https://liv2care.example/book/abc");
  });
});
