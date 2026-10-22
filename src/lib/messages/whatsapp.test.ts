import { describe, expect, it, vi } from "vitest";
import { demoNumbers, relayToWhatsApp, twilioConfigured, whatsappConfigured } from "./whatsapp";

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
    expect(result).toEqual({ sent: false, reason: "could not reach the WhatsApp service" });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(await relayToWhatsApp("hi", env, refused)).toMatchObject({ sent: false });
  });
});

const twilio = { TWILIO_ACCOUNT_SID: "ACtest", TWILIO_AUTH_TOKEN: "twilio-secret", TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886", DEMO_WHATSAPP_TO: "919876543210" };

describe("Twilio sandbox", () => {
  it("is configured with an account, a token, the sandbox sender and a plain number", () => {
    expect(twilioConfigured(twilio)).toBe(true);
    expect(whatsappConfigured(twilio)).toBe(true);
    expect(twilioConfigured({ ...twilio, TWILIO_WHATSAPP_FROM: "+14155238886" })).toBe(false);
    expect(twilioConfigured({ ...twilio, TWILIO_AUTH_TOKEN: "" })).toBe(false);
  });

  it("sends the text to the demo phone and is used before Meta", async () => {
    const fetchImpl = vi.fn(ok);
    expect(await relayToWhatsApp("Tap to book: https://example.test/book/abc", { ...env, ...twilio }, fetchImpl)).toEqual({ sent: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json");
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("ACtest:twilio-secret").toString("base64")}`);
    const form = new URLSearchParams(init.body as string);
    expect(form.get("From")).toBe("whatsapp:+14155238886");
    expect(form.get("To")).toBe("whatsapp:+919876543210");
    expect(form.get("Body")).toBe("Tap to book: https://example.test/book/abc");
  });

  it("says why when Twilio refuses, without repeating the token", async () => {
    const result = await relayToWhatsApp("hi", twilio, refused);
    expect(result.sent).toBe(false);
    expect(result.reason).toContain("sandbox");
    expect(JSON.stringify(result)).not.toContain("twilio-secret");
    expect((await relayToWhatsApp("hi", twilio, () => Promise.reject(new Error("down twilio-secret")))).sent).toBe(false);
  });
});

describe("more than one demo phone", () => {
  const two = { ...twilio, DEMO_WHATSAPP_TO: "919876543210, 917397313854" };

  it("reads a comma-separated list of up to five plain numbers", () => {
    expect(demoNumbers(two)).toEqual(["919876543210", "917397313854"]);
    expect(twilioConfigured(two)).toBe(true);
    expect(twilioConfigured({ ...twilio, DEMO_WHATSAPP_TO: "919876543210,+91 73973" })).toBe(false);
    expect(twilioConfigured({ ...twilio, DEMO_WHATSAPP_TO: "1111111111,2222222222,3333333333,4444444444,5555555555,6666666666" })).toBe(false);
  });

  it("sends to every phone, and one failing does not stop the other", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const to = new URLSearchParams(init!.body as string).get("To")!;
      calls.push(to);
      return new Response("{}", { status: to.endsWith("3210") ? 400 : 200 });
    });
    const result = await relayToWhatsApp("hi", two, fetchImpl as unknown as typeof fetch);
    expect(calls.sort()).toEqual(["whatsapp:+917397313854", "whatsapp:+919876543210"]);
    expect(result.sent).toBe(true);
  });
});
