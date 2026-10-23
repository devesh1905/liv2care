import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * A patient's phone number as digits with the country code first (for example 919876543210), or null when it is not a
 * usable number. A plain 10-digit Indian mobile gets 91 in front; anything else needs its own country code.
 */
export function normalisePhone(input: string): string | null {
  const text = input.trim();
  if (!/^[+\d\s()-]+$/.test(text)) return null;
  const plus = text.startsWith("+");
  const digits = text.replace(/\D/g, "");
  if (!plus && /^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (!plus && /^0[6-9]\d{9}$/.test(digits)) return `91${digits.slice(1)}`;
  if (/^\d{8,15}$/.test(digits) && (plus || digits.length > 10)) return digits;
  return null;
}

/** What the rest of the app shows: never the full number. */
export function maskPhone(digits: string): string {
  return `${digits.slice(-10, -8)}•••• ${digits.slice(-4)}`;
}

function keyFrom(base64: string | undefined): Buffer | null {
  if (!base64) return null;
  const key = Buffer.from(base64, "base64");
  return key.length === 32 ? key : null;
}

/** True when PHONE_ENCRYPTION_KEY holds 32 bytes, base64 encoded. */
export function encryptionReady(base64: string | undefined): boolean {
  return keyFrom(base64) !== null;
}

/** AES-256-GCM. The patient's id is bound in, so a stored value cannot be moved to another patient. */
export function encryptPhone(digits: string, base64Key: string | undefined, patientId: string): string | null {
  const key = keyFrom(base64Key);
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(patientId));
  const body = Buffer.concat([cipher.update(digits, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** Returns the digits, or null when the key is missing or wrong, or the value was changed. Never throws. */
export function decryptPhone(stored: string, base64Key: string | undefined, patientId: string): string | null {
  try {
    const key = keyFrom(base64Key);
    const [version, iv, tag, body] = stored.split(".");
    if (!key || version !== "v1" || !iv || !tag || !body) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(patientId));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const digits = Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
    return /^\d{8,15}$/.test(digits) ? digits : null;
  } catch {
    return null;
  }
}
