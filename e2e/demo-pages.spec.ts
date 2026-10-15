import { expect, test } from "@playwright/test";

/**
 * The demo access pages: /demo lists one link per person, and each person has their own sign-in page where the visitor
 * types that account's password. Runs against the local seed (password in supabase/seed.sql); fake data only.
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

test("every person has a link, and each opens their own sign-in page", async ({ page }) => {
  await page.goto("/demo");
  for (const name of [/Treating doctor/, /Telemedicine clinician/, /^Lab/, /Diagnostic centre/, /Operations/]) {
    await expect(page.getByRole("link", { name }).first()).toBeVisible();
  }
  await page.getByRole("link", { name: /Treating doctor/ }).click();
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
  const res = await page.goto("/demo/not-a-role");
  expect(res?.status()).toBe(404);
});
