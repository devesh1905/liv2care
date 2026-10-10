import { createClient } from "@supabase/supabase-js";
import { expect, type Browser, type Page } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // variables may come from the environment
}

/** Service-role client for checking the database after an action. Tests only. */
export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

/** Signs in through the demo buttons (needs DEMO_LOGINS=on locally) in a fresh browser context. */
export async function signInAs(browser: Browser, role: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.locator(`input[name=role][value=${role}]`).locator("xpath=..").getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

export const PDF = { name: "report.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") };

/** The booking link in the newest message that starts with `prefix`, once that message exists. */
export async function linkFromMessage(journeyId: string, prefix: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("messages")
        .select("body")
        .eq("journey_id", journeyId)
        .like("body", `${prefix}%`)
        .order("created_at", { ascending: false })
        .limit(1);
      link = data?.[0]?.body.match(/https?:\/\/\S+/)?.[0];
      return link;
    })
    .toBeTruthy();
  return link!;
}

/** Fresh early slots at a partner, so a test does not depend on how many earlier runs used the seed slots. */
export async function addSoonSlots(partnerId: string, count = 2) {
  const soon = Date.now() + 60 * 60 * 1000;
  await admin.from("slots").insert(
    Array.from({ length: count }, (_, i) => ({
      partner_id: partnerId,
      starts_at: new Date(soon + i * 2e6 + Math.floor(Math.random() * 1e6)).toISOString(),
    })),
  );
}

export const PARTNER = {
  sunrise: "00000000-0000-4000-8000-0000000000a1",
  hepatic: "00000000-0000-4000-8000-0000000000b1",
  metroEval: "00000000-0000-4000-8000-0000000000c1",
  hepatology: "00000000-0000-4000-8000-0000000000d1",
} as const;
