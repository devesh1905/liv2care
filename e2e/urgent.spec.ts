import { expect, test } from "@playwright/test";
import { addSoonSlots, admin, linkFromMessage, PARTNER, signInAs } from "./helpers";

/** The doctor flags a patient as urgent: the patient is told to book soon and the lab sees the flag. */
test("an urgent patient is flagged to the patient and to the lab", async ({ browser }) => {
  const name = `Urgent Person ${Date.now() % 100000}`;
  await addSoonSlots(PARTNER.sunrise);

  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("57");
  await doctor.getByLabel(/^Urgent\./).check();
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "booking link was sent" })).toBeVisible();

  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id, urgent").eq("patient_id", patient!.id).single();
  expect(journey!.urgent).toBe(true);
  const journeyId = journey!.id as string;

  // the message starts by saying it is urgent, and still carries the booking link
  const link = await linkFromMessage(journeyId, "Your doctor has marked this as urgent");

  const phone = await (await browser.newContext({ viewport: { width: 360, height: 800 } })).newPage();
  await phone.goto(link);
  await phone.locator("label").filter({ has: phone.locator("input[name=choice]") }).first().click();
  await phone.getByRole("button", { name: "Confirm booking" }).click();
  await expect(phone.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

  const lab = await signInAs(browser, "lab");
  await lab.goto("/partner");
  const heading = lab.getByRole("heading", { name, level: 3 });
  await expect(heading).toBeVisible();
  await expect(heading.locator("xpath=..").getByText("Urgent", { exact: true })).toBeVisible();
});
