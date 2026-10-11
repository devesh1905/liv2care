import { expect, test, type Page } from "@playwright/test";
import { addSoonSlots, admin, linkFromMessage, PARTNER, signInAs } from "./helpers";

/**
 * Every screen must work on a 360 px phone, and a Hindi-speaking patient gets Hindi pages and Hindi messages.
 * Fake data only.
 */
const PHONE = { width: 360, height: 800 };

const sidewaysOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("public pages fit a 360 px phone", async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: PHONE })).newPage();
  for (const path of ["/", "/login"]) {
    await page.goto(path);
    await expect(page.locator("main, body").first()).toBeVisible();
    expect(await sidewaysOverflow(page), `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  }
});

for (const [role, path, heading] of [
  ["doctor", "/doctor", "Treating doctor"],
  ["clinician", "/clinician", "Telemedicine clinician"],
  ["lab", "/partner", "Lab and centre"],
  ["ops", "/ops", "Operations"],
] as const) {
  test(`the ${role} page fits a 360 px phone`, async ({ browser }) => {
    const page = await signInAs(browser, role, PHONE);
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await expect(page.getByText("Loading…")).toBeHidden();
    expect(await sidewaysOverflow(page), `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  });
}

test("a Hindi-speaking patient gets Hindi messages, booking page, confirmation and progress page", async ({ browser }) => {
  const name = `Hindi Person ${Date.now() % 100000}`;
  await addSoonSlots(PARTNER.sunrise);

  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("49");
  await doctor.getByLabel("Message language").selectOption("hi");
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "enrolled" })).toBeVisible();
  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id").eq("patient_id", patient!.id).single();
  const journeyId = journey!.id as string;

  // the first message is in Hindi and carries both links
  const { data: first } = await admin.from("messages").select("body").eq("journey_id", journeyId).like("body", "आपके डॉक्टर ने कुछ ब्लड टेस्ट%").single();
  expect(first!.body).toMatch(/\/book\//);
  expect(first!.body).toMatch(/\/patient\//);
  expect(first!.body).not.toMatch(/Your doctor/);

  // the booking page opens in Hindi on a phone, the helper and confirm button are Hindi, and nothing scrolls sideways
  const phone = await (await browser.newContext({ viewport: PHONE })).newPage();
  await phone.goto(await linkFromMessage(journeyId, "आपके डॉक्टर ने कुछ ब्लड टेस्ट"));
  await expect(phone.getByRole("heading", { name: "अपना ब्लड टेस्ट बुक करें" })).toBeVisible();
  expect(await sidewaysOverflow(phone)).toBeLessThanOrEqual(0);
  await phone.getByRole("button", { name: "सबसे नज़दीक" }).click();
  await expect(phone.getByRole("status")).toContainText(/[ऀ-ॿ]/);
  await phone.getByRole("button", { name: "बुकिंग पक्की करें" }).click();
  await expect(phone.getByRole("heading", { name: "बुकिंग पक्की हो गई" })).toBeVisible();

  // the confirmation message is in Hindi too
  const { data: confirmation } = await admin.from("messages").select("body").eq("journey_id", journeyId).like("body", "बुकिंग पक्की हो गई:%").single();
  expect(confirmation!.body).toContain("Sunrise Diagnostics");

  // the progress page is in Hindi by default, and the language can be switched
  const progress = first!.body.match(/\/patient\/\S+/)![0];
  await phone.goto(`${new URL(phone.url()).origin}${progress}`);
  await expect(phone.getByRole("heading", { name: "आपकी प्रगति", level: 1 })).toBeVisible();
  expect(await sidewaysOverflow(phone)).toBeLessThanOrEqual(0);
  await phone.getByRole("link", { name: "English" }).click();
  await expect(phone.getByRole("heading", { name: "Your progress", level: 1 })).toBeVisible();
});
