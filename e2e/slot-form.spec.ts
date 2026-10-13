import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

/** The new-slot form uses a date and plain selects (hour, minute, AM/PM), so it looks the same in every browser. */
test("a lab adds a slot with the date, hour, minute and AM/PM fields", async ({ browser }) => {
  const page = await signInAs(browser, "lab");
  await page.goto("/partner");

  const day = new Date(Date.now() + (60 + (Date.now() % 200)) * 86_400_000).toISOString().slice(0, 10);
  const form = page.getByRole("form", { name: /New slot/ });
  await form.getByLabel("Date").fill(day);
  await form.getByLabel("Hour").selectOption("4");
  await form.getByLabel("Minute").selectOption("30");
  await form.getByLabel("AM or PM").selectOption("PM");
  await form.getByRole("button", { name: "Add slot" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Slot added." })).toBeVisible();
  await expect(page.getByText(/4:30 pm/i).first()).toBeVisible();
});
