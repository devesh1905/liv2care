import { expect, test } from "@playwright/test";

/**
 * The home page "Try it yourself" buttons: each person opens a side panel with their own sign-in, and the visitor
 * types that account's password. Runs against the local seed (password in supabase/seed.sql); fake data only.
 */
const LOCAL_PASSWORD = "demo-liv2care-only";

test("a role button opens a side panel with that role's sign-in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Treating doctor/ }).click();

  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("heading", { name: "Sign in as the treating doctor" })).toBeVisible();
  await expect(panel.getByLabel("Email")).toHaveValue("doctor@demo.liv2care.test");
  await expect(panel.getByLabel("Email")).not.toBeEditable(); // the role is fixed; only the password is typed

  // a wrong password is refused and the panel stays open
  await panel.getByLabel("Password").fill("not-the-password");
  await panel.getByRole("button", { name: "Sign in" }).click();
  await expect(panel.getByRole("alert")).toContainText("Wrong email or password");

  // Escape closes it
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("the right password signs in as that role and lands on its own page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Telemedicine clinician/ }).click();
  const panel = page.getByRole("dialog");
  await panel.getByLabel("Password").fill(LOCAL_PASSWORD);
  await panel.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/clinician");
  await expect(page.getByRole("heading", { name: "Telemedicine clinician", level: 1 })).toBeVisible();
});

test("every person has a button", async ({ page }) => {
  await page.goto("/");
  for (const name of [/Treating doctor/, /Telemedicine clinician/, /^Lab/, /Diagnostic centre/, /Operations/]) {
    await expect(page.getByRole("button", { name }).first()).toBeVisible();
  }
});
