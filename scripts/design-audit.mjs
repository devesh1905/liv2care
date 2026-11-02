// Design audit for the signed-in pages, which Hallmark and Impeccable cannot reach (they have no session).
// Signs in through /demo (needs DEMO_LOGINS=on), then on each page at 1440 and 390 px wide checks:
//   axe        WCAG 2.0-2.2 A/AA (contrast, labels, headings, target size ...), serious + critical counted as fails
//   targets    Apple HIG: every visible control is at least 44 x 44 px, counting the invisible hit area of our Button
//   fields     inputs and selects have an edge of at least 3:1 against the surface behind them
//   motion     no running animation when the visitor asks for reduced motion
// Usage: BASE=http://localhost:3100 node scripts/design-audit.mjs [out.json]
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const PAGES = {
  public: [
    "/",
    "/demo",
    "/login",
    ...(process.env.PATIENT_PATHS ?? "").split(",").filter(Boolean),
  ],
  doctor: ["/doctor"],
  clinician: ["/clinician"],
  lab: ["/partner"],
  centre: ["/partner"],
  specialist: ["/specialist"],
  ops: ["/ops"],
};
const WIDTHS = [1440, 390];

const browser = await chromium.launch({ channel: "chrome" });
const report = [];

for (const [role, paths] of Object.entries(PAGES)) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    if (role !== "public") {
      await page.goto(`${BASE}/demo`);
      await page
        .locator(`input[name=role][value=${role}]`)
        .locator("xpath=..")
        .getByRole("button")
        .click();
      await page.waitForURL((u) => !u.pathname.startsWith("/demo"), {
        timeout: 30000,
      });
    }
    for (const path of paths) {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const checks = await page.evaluate(() => {
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return (
            r.width > 0 &&
            r.height > 0 &&
            s.visibility !== "hidden" &&
            s.display !== "none"
          );
        };
        const label = (el) =>
          (
            el.getAttribute("aria-label") ||
            el.textContent ||
            el.getAttribute("name") ||
            el.tagName
          )
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 50);
        const small = [];
        for (const el of document.querySelectorAll(
          "a[href], button, input:not([type=hidden]), select, textarea, [role=button], summary",
        )) {
          if (!visible(el)) continue;
          // links inside running text are exempt (HIG and WCAG 2.5.8 both allow inline links)
          if (
            el.tagName === "A" &&
            getComputedStyle(el).display === "inline" &&
            el.closest("p, li, dd")
          )
            continue;
          // checkboxes and radios count their whole label as the target
          const target =
            (el.type === "checkbox" || el.type === "radio") &&
            el.closest("label")
              ? el.closest("label")
              : el;
          const r = target.getBoundingClientRect();
          const after = getComputedStyle(target, "::after");
          const hitW = Math.max(
            r.width,
            after.content !== "none" ? parseFloat(after.minWidth) || 0 : 0,
          );
          const hitH = Math.max(
            r.height,
            after.content !== "none" ? parseFloat(after.minHeight) || 0 : 0,
          );
          if (hitW < 44 || hitH < 44)
            small.push(`${label(el)} ${Math.round(hitW)}x${Math.round(hitH)}`);
        }
        const lum = (c) => {
          const m = c.match(/[\d.]+/g);
          if (!m) return null;
          const [r, g, b] = m.slice(0, 3).map((v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const surface = (el) => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const bg = getComputedStyle(p).backgroundColor;
            if (bg && !bg.endsWith(", 0)") && bg !== "transparent") return bg;
          }
          return "rgb(255, 255, 255)";
        };
        const weakFields = [];
        for (const el of document.querySelectorAll(
          "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea",
        )) {
          if (!visible(el)) continue;
          const a = lum(getComputedStyle(el).borderTopColor);
          const b = lum(surface(el));
          if (a == null || b == null) continue;
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          if (ratio < 3) weakFields.push(`${label(el)} ${ratio.toFixed(2)}:1`);
        }
        const running = document
          .getAnimations()
          .filter((a) => a.playState === "running").length;
        return { small, weakFields, running };
      });
      const serious = axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      );
      report.push({
        role,
        path,
        width,
        axeSerious: serious.map((v) => `${v.id}: ${v.nodes.length}`),
        axeMinor: axe.violations
          .filter((v) => !serious.includes(v))
          .map((v) => `${v.id}: ${v.nodes.length}`),
        smallTargets: [...new Set(checks.small)],
        weakFields: [...new Set(checks.weakFields)],
        runningAnimations: checks.running,
      });
      console.log(
        `${role} ${path} @${width}: axe ${serious.length} serious, ${checks.small.length} small targets, ${checks.weakFields.length} weak fields, ${checks.running} animations`,
      );
    }
    await ctx.close();
  }
}

await browser.close();
if (process.argv[2])
  writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
