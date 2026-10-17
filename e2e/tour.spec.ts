import { expect, test, type Page } from "@playwright/test";
import { addSoonSlots, admin, linkFromMessage, PARTNER, signInAs } from "./helpers";

/**
 * A guided tour of the whole product that saves a screenshot at every step into tour-shots/ (CI keeps them as a
 * downloadable "tour-shots" file). It lets anyone see how every page and role looks, on a laptop and on a phone,
 * without signing in to anything. Fake data only.
 */
const LAPTOP = { width: 1280, height: 1300 };
const PHONE = { width: 360, height: 800 };
const DIR = "tour-shots";

const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });

test("tour: every role and the patient's phone, step by step", async ({ browser }) => {
  test.setTimeout(240_000);
  await addSoonSlots(PARTNER.sunrise, 3);

  // a visitor on a phone
  const visitor = await (await browser.newContext({ viewport: PHONE })).newPage();
  for (const [path, name] of [["/", "01-home-phone"], ["/demo", "02-demo-roles-phone"], ["/demo/doctor", "03-demo-doctor-signin-phone"]] as const) {
    await visitor.goto(path);
    await visitor.waitForLoadState("networkidle");
    await shot(visitor, name);
  }
  const wide = await (await browser.newContext({ viewport: LAPTOP })).newPage();
  await wide.goto("/");
  await wide.waitForLoadState("networkidle");
  await shot(wide, "01-home-laptop");

  // the doctor enrols a patient
  const doctor = await signInAs(browser, "doctor", LAPTOP);
  const name = `Tour Person ${Date.now() % 100000}`;
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("54");
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: `${name} (` })).toBeVisible();
  await shot(doctor, "10-doctor-after-enrolling");

  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id").eq("patient_id", patient!.id).single();
  const journeyId = journey!.id as string;

  // the patient's phone: the message, the booking page inside the phone, the confirmation
  await doctor.goto(`/phone/${journeyId}`);
  const phone = doctor.getByRole("group", { name: /phone/ });
  await expect(phone.getByText(/Your doctor has requested some blood tests/)).toBeVisible();
  await shot(doctor, "11-phone-message");
  await phone.getByRole("button", { name: "Open the link" }).first().click();
  const screen = phone.frameLocator("iframe");
  await expect(screen.getByRole("button", { name: "Nearest" })).toBeVisible();
  await shot(doctor, "12-phone-booking-page");
  await screen.getByRole("button", { name: "Nearest" }).click();
  await expect(screen.getByRole("button", { name: "Confirm booking" })).toBeEnabled();
  await shot(doctor, "13-phone-helper-suggestion");
  await screen.getByRole("button", { name: "Confirm booking" }).click();
  await expect(screen.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
  await shot(doctor, "14-phone-booking-confirmed");
  await phone.getByRole("button", { name: "Messages" }).click();
  await expect(phone.getByText(/Booking confirmed: /)).toBeVisible({ timeout: 15000 });
  await shot(doctor, "15-phone-confirmation-message");

  // the lab sees the visit with the buttons greyed out until the slot
  const lab = await signInAs(browser, "lab", LAPTOP);
  await lab.goto("/partner");
  await expect(lab.getByText(name).first()).toBeVisible();
  await shot(lab, "20-lab-page-buttons-greyed");

  // the visit time comes: the lab marks it missed and the patient is sent a new time at once
  const { data: booking } = await admin.from("bookings").select("slot_id").eq("journey_id", journeyId).eq("status", "booked").single();
  await admin.from("slots").update({ starts_at: new Date(Date.now() - 3_600_000).toISOString() }).eq("id", booking!.slot_id);
  await lab.goto("/partner");
  await lab.locator("section:has(> header)").filter({ hasText: name }).getByRole("button", { name: "Mark missed" }).click();
  await expect(lab.getByRole("status").filter({ hasText: "Marked missed" })).toBeVisible();
  await shot(lab, "21-lab-marked-missed");
  await doctor.goto(`/phone/${journeyId}`);
  await expect(doctor.getByRole("group", { name: /phone/ }).getByText(/We suggest/)).toBeVisible();
  await shot(doctor, "22-phone-automatic-new-time");

  // Option 1 where the patient sends the report from a phone
  await doctor.goto("/doctor");
  const second = `Tour Upload ${Date.now() % 100000}`;
  await doctor.getByLabel("Patient name", { exact: true }).fill(second);
  await doctor.getByLabel("Age", { exact: true }).fill("62");
  await doctor.getByText("Option 1: use an existing report").click();
  await doctor.getByLabel(/The patient will upload the report/).check();
  await shot(doctor, "30-doctor-option1-patient-uploads");
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: `${second} (` })).toBeVisible();
  const { data: p2 } = await admin.from("patients").select("id").eq("name", second).single();
  const { data: j2 } = await admin.from("journeys").select("id").eq("patient_id", p2!.id).single();
  const link = await linkFromMessage(j2!.id as string, "Your doctor would like to see your latest lab report");
  const patientPhone = await (await browser.newContext({ viewport: PHONE })).newPage();
  await patientPhone.goto(link);
  await expect(patientPhone.getByRole("heading", { name: "Send your lab report" })).toBeVisible();
  await shot(patientPhone, "31-patient-upload-page-phone");
  await patientPhone.goto(`${link}?lang=hi`);
  await shot(patientPhone, "32-patient-upload-page-hindi");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  await patientPhone.goto(link);
  await patientPhone.getByLabel("Your report").setInputFiles({ name: "report.png", mimeType: "image/png", buffer: png });
  await patientPhone.getByRole("button", { name: "Send report" }).click();
  await expect(patientPhone.getByRole("heading", { name: "Report received" })).toBeVisible();
  await shot(patientPhone, "33-patient-report-received");

  // the clinician, the centre and operations
  for (const [role, path, file] of [["clinician", "/clinician", "40-clinician-queue"], ["centre", "/partner", "41-fibroscan-centre"], ["ops", "/ops", "42-operations"]] as const) {
    const page = await signInAs(browser, role, LAPTOP);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await shot(page, file);
  }
  const doctorPhoneView = await signInAs(browser, "doctor", PHONE);
  await doctorPhoneView.goto("/doctor");
  await doctorPhoneView.waitForLoadState("networkidle");
  await shot(doctorPhoneView, "50-doctor-page-on-a-phone");
});
