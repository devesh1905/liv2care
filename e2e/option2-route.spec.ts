import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Option 2 end to end: the doctor orders tests, the patient books with the helper, the lab marks the visit missed,
 * the patient reschedules from the new link, and the lab uploads the report. Fake data only.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // variables may come from the environment
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function signInAs(browser: Browser, role: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.locator(`input[name=role][value=${role}]`).locator("xpath=..").getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

/** The booking link in the newest message that starts with `prefix`, once that message exists. */
async function linkFromMessage(journeyId: string, prefix: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(async () => {
      const { data } = await admin.from("messages").select("body").eq("journey_id", journeyId).like("body", `${prefix}%`).order("created_at", { ascending: false }).limit(1);
      link = data?.[0]?.body.match(/https?:\/\/\S+/)?.[0];
      return link;
    })
    .toBeTruthy();
  return link!;
}

test("Option 2: order, book, miss, reschedule, upload", async ({ browser }) => {
  const name = `E2E Person ${Date.now() % 100000}`;

  // Two fresh, early slots at the nearest lab, so the test does not depend on how many earlier runs used the seed slots.
  const SUNRISE = "00000000-0000-4000-8000-0000000000a1";
  const soon = Date.now() + 60 * 60 * 1000;
  await admin.from("slots").insert([
    { partner_id: SUNRISE, starts_at: new Date(soon + Math.floor(Math.random() * 1e6)).toISOString() },
    { partner_id: SUNRISE, starts_at: new Date(soon + 2e6 + Math.floor(Math.random() * 1e6)).toISOString() },
  ]);

  // 1. The doctor identifies a patient and orders the tests
  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("54");
  await doctor.getByLabel("Also order an ultrasound").check();
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "enrolled" })).toBeVisible();

  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id, stage").eq("patient_id", patient!.id).single();
  expect(journey!.stage).toBe(0);

  // 2. The patient opens the link, asks the helper for the nearest lab and confirms
  const patientPage = await (await browser.newContext({ viewport: { width: 360, height: 800 } })).newPage();
  await patientPage.goto(await linkFromMessage(journey!.id, "Your doctor has requested"));
  await expect(patientPage.getByRole("heading", { name: "Book your blood test" })).toBeVisible();
  await patientPage.getByRole("button", { name: "Nearest" }).click();
  await expect(patientPage.getByRole("status").filter({ hasText: "Nearest" })).toBeVisible();
  await patientPage.getByRole("button", { name: "Confirm booking" }).click();
  await expect(patientPage.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
  await expect(patientPage.getByText(/See you at Sunrise Diagnostics/)).toBeVisible();

  const { data: confirmation } = await admin.from("messages").select("body, channel").eq("journey_id", journey!.id).like("body", "Booking confirmed%").single();
  expect(confirmation!.channel).toBe("SMS");
  expect(confirmation!.body).toContain("Sunrise Diagnostics");

  // 3. The lab marks the visit missed; the patient is messaged a new link
  const lab = await signInAs(browser, "lab");
  await lab.goto("/partner");
  const visit = lab.locator("section:has(> header)").filter({ hasText: name });
  await visit.getByRole("button", { name: "Mark missed" }).click();
  await expect(visit.getByText(/Waiting for the patient to choose a new time/)).toBeVisible();

  // 4. The patient reschedules from the new link, again with the nearest suggestion (so the same lab sees the visit)
  await patientPage.goto(await linkFromMessage(journey!.id, "You missed your appointment"));
  await expect(patientPage.getByText("You missed this appointment")).toBeVisible();
  await patientPage.getByRole("button", { name: "Nearest" }).click();
  await expect(patientPage.getByRole("status").filter({ hasText: "Nearest" })).toBeVisible();
  await patientPage.getByRole("button", { name: "Confirm booking" }).click();
  await expect(patientPage.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

  // Both bookings stay on record, and the audit trail shows the miss and the reschedule
  const { data: bookings } = await admin.from("bookings").select("status").eq("journey_id", journey!.id).order("created_at");
  expect(bookings!.map((b) => b.status)).toEqual(["cancelled", "booked"]);
  const { data: events } = await admin.from("journey_events").select("event").eq("journey_id", journey!.id).order("id");
  expect(events!.map((e) => e.event)).toEqual(["JOURNEY_STARTED", "BOOK", "MARK_MISSED", "RESCHEDULE"]);

  // 5. The lab uploads the report: the journey reaches "report received"
  await lab.goto("/partner");
  const again = lab.locator("section:has(> header)").filter({ hasText: name });
  await again.getByLabel("Lab report").setInputFiles({ name: "report.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") });
  await again.getByRole("button", { name: "Upload report" }).click();
  await expect(lab.getByRole("status").filter({ hasText: "Report uploaded" })).toBeVisible();

  const { data: done } = await admin.from("journeys").select("stage").eq("id", journey!.id).single();
  expect(done!.stage).toBe(2);
  const { data: all } = await admin.from("journey_events").select("event").eq("journey_id", journey!.id).order("id");
  expect(all!.map((e) => e.event)).toEqual(["JOURNEY_STARTED", "BOOK", "MARK_MISSED", "RESCHEDULE", "LAB_UPLOAD"]);
});
