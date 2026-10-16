import { expect, test } from "@playwright/test";
import { addSoonSlots, admin, linkFromMessage, PARTNER, signInAs, startVisitNow } from "./helpers";

/**
 * A patient misses a lab visit. Operations asks for a suggested new time, sends it, and the patient's booking page
 * opens with that time already selected. Fake data only.
 */
test("operations offers a new time to a patient who missed a visit", async ({ browser }) => {
  const name = `Offer Person ${Date.now() % 100000}`;
  await addSoonSlots(PARTNER.sunrise, 3);

  // enrol and book (Option 2)
  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("52");
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "enrolled" })).toBeVisible();
  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id").eq("patient_id", patient!.id).single();
  const journeyId = journey!.id as string;

  const patientPage = await (await browser.newContext()).newPage();
  await patientPage.goto(await linkFromMessage(journeyId, "Your doctor has requested"));
  await patientPage.getByRole("button", { name: "Nearest" }).click();
  await expect(patientPage.getByRole("status")).toContainText(/\w/);
  await patientPage.getByRole("button", { name: "Confirm booking" }).click();
  await expect(patientPage.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

  // the visit time comes, and the lab marks the visit missed
  await startVisitNow(journeyId);
  const lab = await signInAs(browser, "lab");
  await lab.goto("/partner");
  await lab.locator("section:has(> header)").filter({ hasText: name }).getByRole("button", { name: "Mark missed" }).click();
  await expect(lab.getByRole("status").filter({ hasText: "Marked missed" })).toBeVisible();

  // marking the visit missed already sent the patient a suggested new time, with no one pressing a button
  const { data: automatic } = await admin.from("messages").select("body").eq("journey_id", journeyId).like("body", "You missed your appointment. We suggest%");
  expect(automatic).toHaveLength(1);
  expect(automatic![0].body).toContain("?pick=");

  // operations can also send a fresh suggestion by hand. Ask for it for a suggestion and sends it
  const ops = await signInAs(browser, "ops");
  const card = ops.locator("section:has(> header)").filter({ hasText: name });
  await expect(card).toContainText("Reschedule the missed appointment");
  await card.getByRole("button", { name: "Suggest a new time" }).click();
  await expect(card.getByRole("button", { name: "Send offer to the patient" })).toBeVisible();
  await expect(card).toContainText("Sunrise Diagnostics");
  await card.getByRole("button", { name: "Send offer to the patient" }).click();
  await expect(ops.getByRole("status").filter({ hasText: "New time offered" })).toBeVisible();

  const { data: msg } = await admin.from("messages").select("body").eq("journey_id", journeyId).like("body", "You missed your appointment. We suggest%").order("created_at", { ascending: false }).limit(1).single();
  expect(msg!.body).toContain("?pick=");
  const { data: event } = await admin.from("journey_events").select("actor_role").eq("journey_id", journeyId).eq("event", "RESCHEDULE_OFFER_SENT").eq("actor_role", "ops").single();
  expect(event!.actor_role).toBe("ops");
  // the audit trail names it, and the message log shows the text with the private link shortened
  await expect(ops.getByText("New time offered to the patient").first()).toBeVisible();

  // the patient opens the message's link: the offered time is already selected, and confirming books it
  await patientPage.goto(await linkFromMessage(journeyId, "You missed your appointment. We suggest"));
  await expect(patientPage.getByText("You missed this appointment")).toBeVisible();
  await expect(patientPage.getByRole("status")).toContainText("Suggested for you");
  await expect(patientPage.getByRole("button", { name: "Confirm booking" })).toBeEnabled();
  await patientPage.getByRole("button", { name: "Confirm booking" }).click();
  await expect(patientPage.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

  const { data: after } = await admin.from("journeys").select("stage, missed").eq("id", journeyId).single();
  expect(after).toEqual({ stage: 1, missed: false });
});
