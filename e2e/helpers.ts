import { createClient } from "@supabase/supabase-js";
import type { Browser, Page } from "@playwright/test";

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
