import { describe, expect, it } from "vitest";
import { decodeAddress, encodeAddress, formatAddress, mapsLink, parseAddress } from "./address";

const ok = { house: "Flat 4B", block: "Block C", street: "Green Park Road", area: "Jubilee Hills", landmark: "near the temple", pincode: "500033" };

describe("parseAddress", () => {
  it("accepts a full address, tidies spaces and keeps the pin", () => {
    const a = parseAddress({ ...ok, house: "  Flat   4B ", lat: "17.385044", lon: "78.486671" })!;
    expect(a.house).toBe("Flat 4B");
    expect(a).toMatchObject({ lat: 17.385044, lon: 78.486671 });
  });
  it("block, landmark and the pin are optional", () => {
    const a = parseAddress({ house: "12", street: "MG Road", area: "Indiranagar", pincode: "560038" })!;
    expect(a).toMatchObject({ block: "", landmark: "", lat: null, lon: null });
  });
  it("refuses a missing house, street or area, and a pincode that is not 6 digits", () => {
    for (const bad of [{ house: "" }, { street: "" }, { street: "x" }, { area: "" }, { pincode: "50003" }, { pincode: "0500033" }, { pincode: "abcdef" }, { house: "x".repeat(61) }]) {
      expect(parseAddress({ ...ok, ...bad })).toBeNull();
    }
    expect(parseAddress(undefined)).toBeNull();
  });
  it("ignores a pin that is half given or out of range", () => {
    expect(parseAddress({ ...ok, lat: "17.4" })).toMatchObject({ lat: null, lon: null });
    expect(parseAddress({ ...ok, lat: "95", lon: "78" })).toMatchObject({ lat: null, lon: null });
  });
});

describe("formatAddress and the stored form", () => {
  it("reads as lines for the collector, with a maps link when there is a pin", () => {
    const a = parseAddress({ ...ok, lat: 17.385044, lon: 78.486671 })!;
    expect(formatAddress(a)).toBe("Flat 4B, Block C\nGreen Park Road\nJubilee Hills - 500033\nLandmark: near the temple");
    expect(mapsLink(a)).toBe("https://www.google.com/maps?q=17.385044,78.486671");
    expect(mapsLink(parseAddress(ok)!)).toBeNull();
  });
  it("round-trips, and shows older plain text as it is", () => {
    const a = parseAddress(ok)!;
    expect(decodeAddress(encodeAddress(a)).text).toContain("Jubilee Hills - 500033");
    expect(decodeAddress("Flat 9, somewhere")).toEqual({ text: "Flat 9, somewhere", mapUrl: null });
  });
});
