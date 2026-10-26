import { expect, test } from "@playwright/test";
import { admin, signInAs } from "./helpers";

/** The same enrol form reaching the server twice (a double tap, a retry) makes one patient, not two. */
test("sending the enrol form twice enrols the patient once", async ({ browser }) => {
  const name = `Twice Person ${Date.now() % 100000}`;
  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("49");
  await doctor.getByLabel(/has given consent/).check();

  // submit the form twice in the same moment, before the page can react to the first
  await doctor.locator("form").filter({ has: doctor.getByLabel("Patient name", { exact: true }) }).evaluate((f) => {
    (f as HTMLFormElement).requestSubmit();
    (f as HTMLFormElement).requestSubmit();
  });
  await expect(doctor.getByRole("status").filter({ hasText: name })).toBeVisible();

  const { count } = await admin.from("patients").select("id", { count: "exact", head: true }).eq("name", name);
  expect(count).toBe(1);
});
