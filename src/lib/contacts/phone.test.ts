import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptPhone, encryptionReady, encryptPhone, maskPhone, normalisePhone } from "./phone";

const key = randomBytes(32).toString("base64");
const PATIENT = "11111111-1111-4111-8111-111111111111";

describe("normalisePhone", () => {
  it("adds 91 to a plain Indian mobile and strips spaces, dashes and a leading 0", () => {
    expect(normalisePhone("98765 43210")).toBe("919876543210");
    expect(normalisePhone("098765-43210")).toBe("919876543210");
    expect(normalisePhone("+91 98765 43210")).toBe("919876543210");
    expect(normalisePhone("919876543210")).toBe("919876543210");
  });
  it("takes another country when the code is given", () => {
    expect(normalisePhone("+44 7700 900123")).toBe("447700900123");
  });
  it("refuses what is not a number", () => {
    for (const bad of ["", "abc", "12345", "5876543210", "98765 4321x", "+1234567", "1234567890123456"]) expect(normalisePhone(bad)).toBeNull();
  });
});

describe("maskPhone", () => {
  it("shows two digits and the last four", () => expect(maskPhone("919876543210")).toBe("98•••• 3210"));
});

describe("encryptPhone", () => {
  it("round-trips, and is different every time", () => {
    const a = encryptPhone("919876543210", key, PATIENT)!;
    const b = encryptPhone("919876543210", key, PATIENT)!;
    expect(a).not.toBe(b);
    expect(a).not.toContain("919876543210");
    expect(decryptPhone(a, key, PATIENT)).toBe("919876543210");
  });
  it("is refused for another patient, another key or a changed value", () => {
    const a = encryptPhone("919876543210", key, PATIENT)!;
    expect(decryptPhone(a, key, "22222222-2222-4222-8222-222222222222")).toBeNull();
    expect(decryptPhone(a, randomBytes(32).toString("base64"), PATIENT)).toBeNull();
    expect(decryptPhone(a.slice(0, -2) + "AA", key, PATIENT)).toBeNull();
    expect(decryptPhone("junk", key, PATIENT)).toBeNull();
  });
  it("needs a 32-byte key", () => {
    expect(encryptionReady(key)).toBe(true);
    expect(encryptionReady(undefined)).toBe(false);
    expect(encryptionReady(randomBytes(16).toString("base64"))).toBe(false);
    expect(encryptPhone("919876543210", "short", PATIENT)).toBeNull();
  });
});
