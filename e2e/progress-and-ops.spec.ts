import { expect, test, type Page } from "@playwright/test";
import { addSoonSlots, admin, linkFromMessage, PARTNER, signInAs } from "./helpers";

/**
 * The patient's progress page and the operations screen: pending actions, reminders, the audit trail and the message
 * log. Fake data only.
 */

async function enrolOrderTests(doctor: Page, name: string) {
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("55");
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "enrolled" })).toBeVisible();
  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id").eq("patient_id", patient!.id).single();
  return journey!.id as string;
}

const overdue = (journeyId: string) =>
  admin.from("tasks").update({ due_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString() }).eq("journey_id", journeyId).is("done_at", null);

test("the patient's progress page follows the journey, in English and Hindi", async ({ browser }) => {
  const name = `Progress Person ${Date.now() % 100000}`;
  await addSoonSlots(PARTNER.sunrise);
  const doctor = await signInAs(browser, "doctor");
  const journeyId = await enrolOrderTests(doctor, name);

  // the first message carries the progress link as well as the booking link
  const first = await admin.from("messages").select("body").eq("journey_id", journeyId).like("body", "Your doctor has requested%").single();
  const progress = first.data!.body.match(/Track your progress: (https?:\/\/\S+)/)![1];

  const patient = await (await browser.newContext({ viewport: { width: 360, height: 800 } })).newPage();
  await patient.goto(progress);
  await expect(patient.getByRole("heading", { name: "Your progress", level: 1 })).toBeVisible();
  await expect(patient.getByText("Book your blood test using the link we sent you.")).toBeVisible();
  await expect(patient.getByRole("listitem").filter({ hasText: "Lab booked" })).toHaveAttribute("aria-current", "step");
  await expect(patient.getByRole("listitem").filter({ hasText: "Tests ordered" }).getByText("Done")).toBeVisible();
  expect(await patient.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // nothing clinical is shown, however far along the journey is
  const text = (await patient.locator("main").innerText()).toLowerCase();
  for (const word of ["fib-4", "fibrosis", "platelet", "summary"]) expect(text).not.toContain(word);

  // Hindi
  await patient.getByRole("link", { name: "हिन्दी" }).click();
  await expect(patient.getByRole("heading", { name: "आपकी प्रगति", level: 1 })).toBeVisible();

  // after booking, the appointment appears on the progress page
  const book = await (await browser.newContext()).newPage();
  await book.goto(await linkFromMessage(journeyId, "Your doctor has requested"));
  await book.getByRole("button", { name: "Nearest" }).click();
  await expect(book.getByRole("status")).toContainText(/\w/);
  await book.getByRole("button", { name: "Confirm booking" }).click();
  await expect(book.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

  await patient.goto(`${progress}?lang=en`);
  await expect(patient.getByText("Your appointment")).toBeVisible();
  await expect(patient.getByText("Sunrise Diagnostics")).toBeVisible();
  await expect(patient.getByText("Go to your lab appointment. The lab will upload your report.")).toBeVisible();

  // a booking link does not open the progress page, and a progress link cannot book
  const bookingLink = await linkFromMessage(journeyId, "Your doctor has requested");
  await patient.goto(bookingLink.replace("/book/", "/patient/"));
  // (Next.js adds its own hidden alert element for screen readers, so match the message itself)
  await expect(patient.getByRole("alert").filter({ hasText: "expired or is not valid" })).toBeVisible();
});

test("operations sees overdue actions, sends a reminder, and the audit trail and message log record it", async ({ browser }) => {
  const name = `Overdue Person ${Date.now() % 100000}`;
  const doctor = await signInAs(browser, "doctor");
  const journeyId = await enrolOrderTests(doctor, name);
  await overdue(journeyId);

  const ops = await signInAs(browser, "ops");
  const card = ops.locator("section:has(> header)").filter({ hasText: name });
  await expect(card).toContainText("overdue");
  await expect(ops.getByText("Pathway completion")).toBeVisible();

  await card.getByRole("button", { name: "Send reminder" }).click();
  await expect(ops.getByRole("status").filter({ hasText: "Reminder sent to the patient" })).toBeVisible();

  const { data: msg } = await admin.from("messages").select("channel, body").eq("journey_id", journeyId).like("body", "Reminder:%").single();
  expect(msg!.channel).toBe("SMS");
  const { data: ev } = await admin.from("journey_events").select("actor_role").eq("journey_id", journeyId).eq("event", "SEND_REMINDER").single();
  expect(ev!.actor_role).toBe("ops");

  // the clock restarted, so the action is no longer overdue
  await expect(ops.locator("section:has(> header)").filter({ hasText: name })).toContainText("due in");

  // the audit trail names the action, and the message log shows the text with the private link shortened
  await expect(ops.getByRole("list").filter({ hasText: "Reminder sent" }).first()).toBeVisible();
  const log = ops.locator("li").filter({ hasText: "Reminder: your next step is overdue" }).first();
  await expect(log).toContainText("/book/••••••••");
  expect(await log.innerText()).not.toMatch(/\/book\/[A-Za-z0-9_-]{16,}/);
});

test("the run-all button reminds every overdue patient once", async ({ browser }) => {
  const name = `Batch Person ${Date.now() % 100000}`;
  const doctor = await signInAs(browser, "doctor");
  const journeyId = await enrolOrderTests(doctor, name);
  await overdue(journeyId);

  const ops = await signInAs(browser, "ops");
  await ops.getByRole("button", { name: "Remind everyone overdue" }).click();
  await expect(ops.getByRole("status").filter({ hasText: "Overdue reminders sent" })).toBeVisible();

  const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("journey_id", journeyId).like("body", "Reminder:%");
  expect(count).toBe(1);

  // a second run does not remind the same patient again
  await ops.getByRole("button", { name: "Remind everyone overdue" }).click();
  await expect(ops.getByRole("status").filter({ hasText: "Overdue reminders sent" })).toBeVisible();
  const again = await admin.from("messages").select("id", { count: "exact", head: true }).eq("journey_id", journeyId).like("body", "Reminder:%");
  expect(again.count).toBe(1);
});
