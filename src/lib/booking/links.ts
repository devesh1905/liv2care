import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

/** A link token is 24 random bytes (192 bits), URL-safe. Only its SHA-256 hash is stored. */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{32}$/;

export function looksLikeToken(token: string): boolean {
  return TOKEN_SHAPE.test(token);
}

export function bookingUrl(token: string, base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"): string {
  return `${base.replace(/\/$/, "")}/book/${token}`;
}

/** Issues a new link for the journey (revoking earlier ones) and returns its URL. Server only. */
export async function issueBookingLink(admin: SupabaseClient, journeyId: string, hours = 168): Promise<string> {
  const token = newToken();
  const { error } = await admin.rpc("issue_booking_link", { p_journey: journeyId, p_token_hash: hashToken(token), p_hours: hours });
  if (error) throw error;
  return bookingUrl(token);
}

/** The journey a live link belongs to, or null for an unknown, expired or revoked link. */
export async function resolveBookingLink(admin: SupabaseClient, token: string): Promise<string | null> {
  if (!looksLikeToken(token)) return null;
  const { data, error } = await admin.rpc("resolve_booking_link", { p_token_hash: hashToken(token) });
  if (error) throw error;
  return (data as string | null) ?? null;
}
