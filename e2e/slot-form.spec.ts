import { expect, test } from "@playwright/test";
import { addSoonSlots, admin, linkFromMessage, PARTNER, signInAs, startVisitNow } from "./helpers";

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

test("Mark missed and Mark attended are greyed out, with the time left, until the slot starts", async ({ browser }) => {
  const name = `Wait Person ${Date.now() % 100000}`;
  await addSoonSlots(PARTNER.sunrise);
  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("52");
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "enrolled" })).toBeVisible();
  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id").eq("patient_id", patient!.id).single();

  const patientPage = await (await browser.newContext()).newPage();
  await patientPage.goto(await linkFromMessage(journey!.id, "Your doctor has requested"));
  await patientPage.getByRole("button", { name: "Nearest" }).click();
  await patientPage.getByRole("button", { name: "Confirm booking" }).click();
  await expect(patientPage.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

  const lab = await signInAs(browser, "lab");
  await lab.goto("/partner");
  const visit = lab.locator("section:has(> header)").filter({ hasText: name });
  await expect(visit.getByRole("button", { name: "Mark missed" })).toBeDisabled();
  await expect(visit.getByRole("button", { name: "Mark attended" })).toBeDisabled();
  await expect(visit.getByText(/Opens when the slot starts, in /).first()).toBeVisible();

  await startVisitNow(journey!.id);
  await lab.goto("/partner");
  await expect(visit.getByRole("button", { name: "Mark missed" })).toBeEnabled();
  await expect(visit.getByRole("button", { name: "Mark attended" })).toBeEnabled();
});
