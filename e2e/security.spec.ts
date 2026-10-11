import { expect, test } from "@playwright/test";

/** Browser-facing security: headers, search-engine rules, friendly errors, and what a stranger can reach. */
const TOKEN_LIKE = "x".repeat(32);
const SOME_UUID = "00000000-0000-4000-8000-0000000000ff";

for (const path of ["/", "/login", `/book/${TOKEN_LIKE}`, `/patient/${TOKEN_LIKE}`]) {
  test(`${path.slice(0, 12)} carries the security headers`, async ({ request }) => {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["strict-transport-security"]).toContain("max-age=");
  });
}

test("search engines are kept off patient links and staff pages", async ({ request }) => {
  const text = await (await request.get("/robots.txt")).text();
  for (const rule of ["Disallow: /book/", "Disallow: /patient/", "Disallow: /doctor", "Disallow: /ops", "Disallow: /reports/"]) {
    expect(text).toContain(rule);
  }
  const page = await request.get(`/book/${TOKEN_LIKE}`);
  expect(await page.text()).toContain("noindex");
});

test("an unknown page gets a friendly 404, not a stack trace", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
  expect(await page.content()).not.toMatch(/at \w+ \(.*\.(ts|js)/);
});

test("a stranger is sent to sign in from every staff page and from the report route", async ({ request }) => {
  for (const path of ["/doctor", "/clinician", "/partner", "/ops"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(307);
    expect(res.headers().location, path).toContain("/login");
  }
  const report = await request.get(`/reports/${SOME_UUID}`, { maxRedirects: 0 });
  expect(report.status()).toBe(307);
  expect(report.headers().location).toContain("/login");
});

test("the reminder job and the health check answer strangers safely", async ({ request }) => {
  const cron = await request.get("/api/cron/reminders");
  expect([401, 503]).toContain(cron.status()); // 503 when no secret is configured, 401 for a wrong one
  const wrong = await request.get("/api/cron/reminders", { headers: { authorization: "Bearer not-the-secret" } });
  expect([401, 503]).toContain(wrong.status());
  const health = await request.get("/api/health");
  expect(await health.json()).toEqual({ status: "ok", app: "liv2care" });
});
