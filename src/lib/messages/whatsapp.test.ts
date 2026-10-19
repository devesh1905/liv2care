import { describe, expect, it, vi } from "vitest";
import { relayToWhatsApp, whatsappConfigured } from "./whatsapp";

const env = { WHATSAPP_PHONE_NUMBER_ID: "1234567890", WHATSAPP_ACCESS_TOKEN: "secret-token", DEMO_WHATSAPP_TO: "919876543210" };
const ok = () => Promise.resolve(new Response("{}", { status: 200 }));
const refused = () => Promise.resolve(new Response("{}", { status: 400 }));

describe("whatsappConfigured", () => {
  it("needs all three settings and a plain international number", () => {
    expect(whatsappConfigured(env)).toBe(true);
    expect(whatsappConfigured({ ...env, DEMO_WHATSAPP_TO: undefined })).toBe(false);
    expect(whatsappConfigured({ ...env, WHATSAPP_ACCESS_TOKEN: "" })).toBe(false);
    expect(whatsappConfigured({ ...env, DEMO_WHATSAPP_TO: "+91 98765 43210" })).toBe(false);
  });
});

describe("relayToWhatsApp", () => {
  it("does nothing when it is not set up", async () => {
    const fetchImpl = vi.fn(ok);
    expect(await relayToWhatsApp("hello", {}, fetchImpl)).toEqual({ sent: false, reason: "not configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the text to the demo phone through the Cloud API", async () => {
    const fetchImpl = vi.fn(ok);
    expect(await relayToWhatsApp("Tap to book: https://example.test/book/abc", env, fetchImpl)).toEqual({ sent: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/1234567890/messages");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret-token");
    expect(JSON.parse(init.body as string)).toMatchObject({ messaging_product: "whatsapp", to: "919876543210", type: "text", text: { body: "Tap to book: https://example.test/book/abc" } });
  });

  it("falls back to the sample template when free text is refused", async () => {
    const fetchImpl = vi.fn().mockImplementationOnce(refused).mockImplementationOnce(ok);
    const result = await relayToWhatsApp("hi", env, fetchImpl);
    expect(result.sent).toBe(true);
    expect(JSON.parse((fetchImpl.mock.calls[1][1] as RequestInit).body as string)).toMatchObject({ type: "template", template: { name: "hello_world" } });
  });

  it("never throws, and never repeats the token in its answer", async () => {
    const result = await relayToWhatsApp("hi", env, () => Promise.reject(new Error("network down secret-token")));
    expect(result).toEqual({ sent: false, reason: "could not reach Meta" });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(await relayToWhatsApp("hi", env, refused)).toMatchObject({ sent: false });
  });
});
