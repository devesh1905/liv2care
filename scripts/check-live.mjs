// Checks the public parts of a deployed site without any password: home page, role buttons and the sign-in side panel,
// an invalid patient link, the health endpoint and the staff-page redirect. Takes screenshots at 360 px and 1280 px.
//   node scripts/check-live.mjs <out-dir> [base-url]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [outDir = "live-check", base = "https://liv2care.vercel.app"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ channel: "msedge" });

for (const size of [
  { name: "phone", width: 360, height: 800 },
  { name: "laptop", width: 1280, height: 800 },
]) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));

  await page.goto(base, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${outDir}/home-${size.name}.png`, fullPage: true });
  check(`[${size.name}] home page loads`, (await page.title()).includes("Liv2care"), await page.title());

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`[${size.name}] no sideways scrolling`, overflow <= 0, `${overflow}px`);

  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return ["Public Sans Variable", "Manrope Variable"].map((f) => document.fonts.check(`16px "${f}"`));
  });
  check(`[${size.name}] bundled fonts are available`, fonts.every(Boolean), JSON.stringify(fonts));

  const roles = ["Treating doctor", "Telemedicine clinician", "Lab", "Diagnostic centre", "Operations"];
  const buttons = await Promise.all(roles.map((r) => page.getByRole("button", { name: new RegExp(`^${r}`) }).first().isVisible().catch(() => false)));
  check(`[${size.name}] a button for every role`, buttons.every(Boolean), roles.filter((_, i) => !buttons[i]).join(", ") || "all five");

  if (size.name === "phone") {
    await page.getByRole("button", { name: /^Treating doctor/ }).first().click();
    const panel = page.getByRole("dialog");
    await panel.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    check("sign-in side panel opens", await panel.isVisible());
    check("panel email is filled in and locked", (await panel.getByLabel("Email").inputValue().catch(() => "")) === "doctor@demo.liv2care.test");
    await page.waitForTimeout(500); // let the panel finish sliding in
    await page.screenshot({ path: `${outDir}/panel-phone.png` });
    await panel.getByLabel("Password").fill("definitely-not-the-password");
    await panel.getByRole("button", { name: "Sign in" }).click();
    await panel.getByRole("alert").filter({ hasText: /Wrong email or password/ }).waitFor({ timeout: 15000 }).catch(() => {});
    check("a wrong password is refused", await panel.getByText("Wrong email or password").isVisible().catch(() => false));
    await page.keyboard.press("Escape");
    // the panel slides out over a fraction of a second, so wait for it rather than looking at once
    check("Escape closes the panel", await panel.waitFor({ state: "hidden", timeout: 5000 }).then(() => true, () => false));
  }
  check(`[${size.name}] no script errors`, problems.length === 0, problems.slice(0, 2).join(" | "));
  await context.close();
}

const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
const page = await context.newPage();

await page.goto(`${base}/patient/${"x".repeat(32)}`, { waitUntil: "networkidle" });
check("an invalid progress link says so", await page.getByText("This link has expired or is not valid").isVisible().catch(() => false));
await page.screenshot({ path: `${outDir}/invalid-link-phone.png` });

await page.goto(`${base}/book/${"x".repeat(32)}`, { waitUntil: "networkidle" });
check("an invalid booking link says so", await page.getByText("This link has expired or is not valid").isVisible().catch(() => false));

await page.goto(`${base}/doctor`, { waitUntil: "networkidle" });
check("a signed-out visit to /doctor goes to sign in", page.url().includes("/login"), page.url());

const health = await page.request.get(`${base}/api/health`);
check("health endpoint answers", health.ok() && (await health.json()).status === "ok");

const cron = await page.request.get(`${base}/api/cron/reminders`);
check("reminder job refuses anonymous calls", [401, 503].includes(cron.status()), String(cron.status()));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
