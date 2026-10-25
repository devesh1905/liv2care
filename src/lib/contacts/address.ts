/**
 * A home-collection address, the way delivery apps take it: house or flat number, block, street, area, landmark and a
 * pincode, plus an optional map pin. It is kept encrypted as one JSON text and shown to the lab on that visit only.
 */
export type Address = {
  house: string;
  block: string;
  street: string;
  area: string;
  landmark: string;
  pincode: string;
  lat: number | null;
  lon: number | null;
};

const tidy = (value: unknown, max: number): string => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max + 1);

function coordinate(value: unknown, limit: number): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? Math.round(n * 1e6) / 1e6 : null;
}

/** Checks what the patient typed. Null when a required part is missing, too long, or the pincode is not 6 digits. */
export function parseAddress(raw: Record<string, unknown> | undefined): Address | null {
  if (!raw) return null;
  const house = tidy(raw.house, 60);
  const block = tidy(raw.block, 40);
  const street = tidy(raw.street, 100);
  const area = tidy(raw.area, 60);
  const landmark = tidy(raw.landmark, 80);
  const pincode = String(raw.pincode ?? "").replace(/\s/g, "");
  if (house.length < 1 || house.length > 60) return null;
  if (block.length > 40 || landmark.length > 80) return null;
  if (street.length < 2 || street.length > 100) return null;
  if (area.length < 2 || area.length > 60) return null;
  if (!/^[1-9]\d{5}$/.test(pincode)) return null;
  const lat = coordinate(raw.lat, 90);
  const lon = coordinate(raw.lon, 180);
  return { house, block, street, area, landmark, pincode, lat: lat !== null && lon !== null ? lat : null, lon: lat !== null && lon !== null ? lon : null };
}

/** The address as lines the collector can read. */
export function formatAddress(a: Address): string {
  return [
    [a.house, a.block].filter(Boolean).join(", "),
    a.street,
    `${a.area} - ${a.pincode}`,
    a.landmark ? `Landmark: ${a.landmark}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** A link that opens the pin in a maps app, or null when the patient did not drop a pin. */
export function mapsLink(a: Address): string | null {
  return a.lat !== null && a.lon !== null ? `https://www.google.com/maps?q=${a.lat},${a.lon}` : null;
}

export const encodeAddress = (a: Address): string => JSON.stringify(a);

/** Reads a stored address back. Text that is not an address is shown as plain text. */
export function decodeAddress(stored: string): { text: string; mapUrl: string | null } {
  try {
    const parsed = parseAddress(JSON.parse(stored) as Record<string, unknown>);
    if (parsed) return { text: formatAddress(parsed), mapUrl: mapsLink(parsed) };
  } catch {
    // not JSON: fall through
  }
  return { text: stored, mapUrl: null };
}
