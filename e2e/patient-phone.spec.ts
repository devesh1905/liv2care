import { expect, test } from "@playwright/test";
import { admin, signInAs } from "./helpers";

/** The doctor gives the patient's mobile number: it is kept encrypted for sending their links, and never shown in full. */
test("the patient's number is kept encrypted and shown masked", async ({ browser }) => {
  const name = `Contact Person ${Date.now() % 100000}`;

  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("47");
  await doctor.getByLabel(/mobile number/).fill("98765 43210");
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "sent to the patient's WhatsApp number" })).toBeVisible();

  const { data: patient } = await admin.from("patients").select("id, phone_masked").eq("name", name).single();
  expect(patient!.phone_masked).toBe("98•••• 3210");

  const { data: contact } = await admin.from("patient_contacts").select("phone_cipher").eq("patient_id", patient!.id).single();
  expect(contact!.phone_cipher).toMatch(/^v1\./);
  expect(contact!.phone_cipher).not.toContain("9876543210");

  // the staff pages never show the number
  await expect(doctor.getByText("9876543210")).toHaveCount(0);
  await expect(doctor.getByText("98765 43210")).toHaveCount(0);
});

test("a number that cannot be right is refused and nobody is enrolled", async ({ browser }) => {
  const name = `Bad Number ${Date.now() % 100000}`;
  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("47");
  await doctor.getByLabel(/mobile number/).fill("12345");
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("alert").filter({ hasText: "10-digit mobile number" })).toBeVisible();
  const { count } = await admin.from("patients").select("id", { count: "exact", head: true }).eq("name", name);
  expect(count).toBe(0);
});
