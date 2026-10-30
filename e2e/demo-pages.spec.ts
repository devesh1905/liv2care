import { expect, test } from "@playwright/test";

/**
 * The demo access pages: /demo has a one-click sign-in button per person, and each person also has their own sign-in
 * page where the visitor can type that account's password. Runs against the local seed (password in supabase/seed.sql); fake data only.
 */
const LOCAL_PASSWORD = "demo-liv2care-only";

test("the home page speaks to doctors and patients and has no role buttons", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "For doctors and care teams" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "For patients" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Treating doctor/ })).toHaveCount(0);
  // the button styles on a link are announced as buttons, like the other header buttons
  await page.getByRole("button", { name: "Demo access" }).click();
  await page.waitForURL("**/demo");
});

test("one click signs in as each person, the FibroScan centre included", async ({ browser }) => {
  for (const [label, path] of [["Treating doctor", "/doctor"], ["FibroScan centre", "/partner"], ["Telemedicine clinician", "/clinician"]] as const) {
    const page = await (await browser.newContext()).newPage();
    await page.goto("/demo");
    await page.getByRole("button", { name: `Sign in as ${label}` }).click();
    await page.waitForURL(`**${path}`);
    if (path === "/partner") await expect(page.getByRole("heading", { name: "FibroScan centre", level: 1 })).toBeVisible();
  }
});

test("each person also has a password page", async ({ page }) => {
  await page.goto("/demo");
  for (const label of ["Treating doctor", "Telemedicine clinician", "Lab", "FibroScan centre", "Operations"]) {
    await expect(page.getByRole("button", { name: `Sign in as ${label}`, exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "Use the password instead" }).first().click();
  await page.waitForURL("**/demo/doctor");
  await expect(page.getByRole("heading", { name: "Sign in as the treating doctor" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("doctor@demo.liv2care.test");
  await expect(page.getByLabel("Email")).not.toBeEditable(); // the role is fixed; only the password is typed

  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Wrong email or password" })).toBeVisible();
});

test("the right password signs in as that role and lands on its own page", async ({ page }) => {
  await page.goto("/demo/clinician");
  await page.getByLabel("Password").fill(LOCAL_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/clinician");
  await expect(page.getByRole("heading", { name: "Telemedicine clinician", level: 1 })).toBeVisible();
});

test("an unknown role is not found", async ({ page }) => {
  await page.goto("/demo/not-a-role");
  // the page streams, so the status line is already 200; the visitor sees the not-found page
  await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
});
