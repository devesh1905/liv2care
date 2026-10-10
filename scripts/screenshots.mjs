// Takes screenshots of the main screens at phone (360 px) and laptop (1280 px) widths, using the installed Microsoft Edge.
// Needs the app running with DEMO_LOGINS=on and the local Supabase stack seeded.
//   node scripts/screenshots.mjs <out-dir> [base-url] [booking-url]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [outDir = "screenshots", base = "http://localhost:3000", bookingUrl] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const SIZES = [
  { name: "phone", width: 360, height: 800 },
  { name: "laptop", width: 1280, height: 800 },
];

const PAGES = [
  { role: null, path: "/", name: "home" },
  { role: null, path: "/login", name: "login" },
  { role: "doctor", path: "/doctor", name: "doctor" },
  { role: "ops", path: "/ops", name: "ops" },
  { role: "clinician", path: "/clinician", name: "clinician" },
  { role: "lab", path: "/partner", name: "lab" },
  { role: "centre", path: "/partner", name: "centre" },
];
if (bookingUrl) PAGES.push({ role: null, url: bookingUrl, name: "book" }, { role: null, url: `${bookingUrl}?lang=hi`, name: "book-hi" });

const browser = await chromium.launch({ channel: "msedge" });
for (const size of SIZES) {
  for (const page of PAGES) {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
    const tab = await context.newPage();
    if (page.role) {
      await tab.goto(`${base}/login`);
      await tab.locator(`input[name=role][value=${page.role}]`).locator("xpath=..").getByRole("button").click();
      await tab.waitForURL((u) => !u.pathname.startsWith("/login"));
    }
    await tab.goto(page.url ?? `${base}${page.path}`);
    await tab.waitForLoadState("networkidle");
    await tab.waitForTimeout(1200);
    await tab.screenshot({ path: `${outDir}/${page.name}-${size.name}.png`, fullPage: true });
    // horizontal overflow check: the page must not scroll sideways
    const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) console.log(`OVERFLOW ${page.name} at ${size.width}px: ${overflow}px`);
    await context.close();
  }
}
await browser.close();
console.log("done");
