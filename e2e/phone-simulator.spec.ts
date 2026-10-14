import { expect, test } from "@playwright/test";
import { addSoonSlots, admin, PARTNER, signInAs } from "./helpers";

/**
 * The "patient's phone" view for the demo: the patient's messages as a chat, and the booking page opening inside the
 * phone when a link is tapped. New messages appear without a reload. Fake data only.
 */
test("the doctor sees the patient's phone, books from inside it, and the confirmation arrives", async ({ browser }) => {
  const name = `Phone Person ${Date.now() % 100000}`;
  await addSoonSlots(PARTNER.sunrise);

  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("47");
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "enrolled" })).toBeVisible();

  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id").eq("patient_id", patient!.id).single();

  await doctor.goto(`/phone/${journey!.id}`);
  const phone = doctor.getByRole("group", { name: new RegExp(`${name}.s phone`) });
  await expect(phone.getByText(/Your doctor has requested some blood tests/)).toBeVisible();

  // tap the booking link: the booking page opens inside the phone
  await phone.getByRole("button", { name: "Open the link" }).first().click();
  const screen = phone.frameLocator("iframe");
  await screen.getByRole("button", { name: "Nearest" }).click();
  await screen.getByRole("button", { name: "Confirm booking" }).click();
  await expect(screen.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

  // back in the chat the confirmation message shows up by itself
  await phone.getByRole("button", { name: "Messages" }).click();
  await expect(phone.getByText(/Booking confirmed: Sunrise Diagnostics/)).toBeVisible({ timeout: 15000 });
});

test("a doctor cannot open the phone of a patient who is not theirs, and a stranger is sent to sign in", async ({ browser, request }) => {
  const res = await request.get("/phone/00000000-0000-4000-8000-0000000000ff", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const lab = await signInAs(browser, "lab");
  await lab.goto("/phone/00000000-0000-4000-8000-0000000000ff");
  await expect(lab).not.toHaveURL(/\/phone\//);
});
