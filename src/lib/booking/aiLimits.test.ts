import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { aiDeps, BURST_MAX } from "./aiLimits";

/** A stand-in for the database function: counts calls per key and refuses past each cap, like ai_consume does. */
function fakeAdmin() {
  const calls = new Map<string, number>();
  const rpc = async (_fn: string, args: { p_key: string; p_cap: number }) => {
    const n = (calls.get(args.p_key) ?? 0) + 1;
    if (n > args.p_cap) return { data: false, error: null };
    calls.set(args.p_key, n);
    return { data: true, error: null };
  };
  return { admin: { rpc } as unknown as SupabaseClient, calls };
}

describe("aiDeps", () => {
  const now = new Date("2026-10-20T10:15:30Z");

  it("allows the model for the first calls in a minute", async () => {
    const { admin, calls } = fakeAdmin();
    for (let i = 0; i < BURST_MAX; i++) {
      const deps = await aiDeps(admin, "caller1", now);
      expect(deps.apiKey).toBeUndefined(); // undefined means: use the configured key
      expect(deps.callerKey).toBe("caller1");
    }
    expect(calls.get("burst:caller1:2026-10-20T10:15")).toBe(BURST_MAX);
  });

  it("skips the model past the burst limit, but still lets the caller carry on", async () => {
    const { admin } = fakeAdmin();
    for (let i = 0; i < BURST_MAX; i++) await aiDeps(admin, "caller1", now);
    const over = await aiDeps(admin, "caller1", now);
    expect(over).toEqual({ apiKey: "" });
  });

  it("counts each caller and each minute separately", async () => {
    const { admin } = fakeAdmin();
    for (let i = 0; i < BURST_MAX; i++) await aiDeps(admin, "caller1", now);
    expect((await aiDeps(admin, "caller2", now)).callerKey).toBe("caller2");
    expect((await aiDeps(admin, "caller1", new Date("2026-10-20T10:16:00Z"))).callerKey).toBe("caller1");
  });

  it("treats a database error as over the limit (fails closed to the plain suggestion)", async () => {
    const broken = { rpc: async () => ({ data: null, error: { message: "down" } }) } as unknown as SupabaseClient;
    expect(await aiDeps(broken, "caller1", now)).toEqual({ apiKey: "" });
  });
});
