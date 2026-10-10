import { expect, test, type Browser, type Page } from "@playwright/test";
import { addSoonSlots, admin, linkFromMessage, PARTNER, PDF, signInAs } from "./helpers";

/**
 * The whole pathway through the real screens, Option 1 start: the doctor enrols with an existing report, the clinician
 * reviews, the doctor decides on FibroScan, the patient books, the centre uploads, the doctor picks the next step, and
 * the journey completes. One test per next step, plus the decline and re-review paths. Fake data only.
 */

const card = (page: Page, name: string) => page.locator("section:has(> header)").filter({ hasText: name });

/** Enrols a patient with an existing report and takes it to the doctor's FibroScan decision. */
async function reachDecision(browser: Browser, name: string) {
  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("58");
  await doctor.getByText("Option 1: use an existing report").click();
  await doctor.getByLabel("Existing lab report").setInputFiles(PDF);
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "enrolled" })).toBeVisible();

  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id").eq("patient_id", patient!.id).single();

  const clinician = await signInAs(browser, "clinician");
  const review = card(clinician, name);
  await review.getByLabel("FIB-4").fill("typed by the clinician");
  await review.getByLabel("Clinical summary").fill(`Summary typed for ${name}`);
  await review.getByRole("button", { name: "Send to the treating doctor" }).click();
  await expect(clinician.getByRole("status").filter({ hasText: "Review sent" })).toBeVisible();

  await doctor.goto("/doctor");
  return { doctor, journeyId: journey!.id as string };
}

/** Approve, the patient books, the centre uploads: ends with the doctor ready to pick the next step. */
async function reachFibroscanReport(browser: Browser, name: string) {
  const { doctor, journeyId } = await reachDecision(browser, name);
  await addSoonSlots(PARTNER.hepatic);

  const decision = card(doctor, name);
  await expect(decision.getByText("typed by the clinician")).toBeVisible();
  await decision.getByRole("button", { name: "Approve FibroScan" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "FibroScan approved" })).toBeVisible();

  const patient = await (await browser.newContext()).newPage();
  await patient.goto(await linkFromMessage(journeyId, "Your doctor has recommended a FibroScan"));
  await expect(patient.getByRole("heading", { name: "Book your FibroScan" })).toBeVisible();
  await patient.getByRole("button", { name: "Nearest" }).click();
  await expect(patient.getByRole("status")).toContainText(/\w/);
  await patient.getByRole("button", { name: "Confirm booking" }).click();
  await expect(patient.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
  await expect(patient.getByText(/Hepatic Imaging Centre/)).toBeVisible();

  const centre = await signInAs(browser, "centre");
  await centre.goto("/partner");
  const visit = card(centre, name);
  await visit.getByLabel("FibroScan report").setInputFiles(PDF);
  await visit.getByRole("button", { name: "Upload report" }).click();
  await expect(centre.getByRole("status").filter({ hasText: "FibroScan report uploaded" })).toBeVisible();

  await doctor.goto("/doctor");
  return { doctor, journeyId };
}

async function eventsOf(journeyId: string) {
  const { data } = await admin.from("journey_events").select("event").eq("journey_id", journeyId).order("id");
  return data!.map((e) => e.event);
}

const BASE_EVENTS = ["JOURNEY_STARTED", "EXISTING_REPORT_UPLOADED", "CLINICIAN_SUBMIT", "APPROVE_VCTE", "BOOK", "CENTRE_UPLOAD"];

test("next step: routine follow-up, then the visit is attended", async ({ browser }) => {
  const name = `Routine Person ${Date.now() % 100000}`;
  const { doctor, journeyId } = await reachFibroscanReport(browser, name);

  const step = card(doctor, name);
  await step.getByLabel(/Routine follow-up/).check();
  await step.getByLabel("Follow-up in").selectOption("6");
  await step.getByRole("button", { name: "Record next step" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "Routine follow-up booked" })).toBeVisible();

  const { data: decision } = await admin
    .from("decisions")
    .select("kind, next_step, follow_up_months")
    .eq("journey_id", journeyId)
    .eq("kind", "next_step")
    .single();
  expect(decision).toEqual({ kind: "next_step", next_step: "routine", follow_up_months: 6 });
  const { data: booking } = await admin.from("bookings").select("slot_label, kind").eq("journey_id", journeyId).eq("kind", "routine").single();
  expect(booking).toEqual({ slot_label: "In 6 months", kind: "routine" });

  const followUp = card(doctor, name);
  await expect(followUp.getByText("In 6 months")).toBeVisible();
  await expect(followUp.getByRole("button", { name: "Mark missed" })).toHaveCount(0); // a routine visit has no slots to reschedule
  await followUp.getByRole("button", { name: "Mark visit attended" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "journey is complete" })).toBeVisible();

  const { data: done } = await admin.from("journeys").select("stage").eq("id", journeyId).single();
  expect(done!.stage).toBe(9);
  expect(await eventsOf(journeyId)).toEqual([...BASE_EVENTS, "CHOOSE_NEXT_STEP", "MARK_ATTENDED"]);
});

for (const next of [
  {
    key: "eval",
    radio: /Further evaluation/,
    notice: "Further evaluation ordered",
    message: "Your doctor has ordered an additional investigation",
    title: "Book your additional investigation",
    partner: PARTNER.metroEval,
    place: /Metro Scan Centre/,
  },
  {
    key: "specialist",
    radio: /Specialist referral/,
    notice: "Specialist referral made",
    message: "Your doctor has referred you to a specialist",
    title: "Book your specialist visit",
    partner: PARTNER.hepatology,
    place: /Hepatology OPD/,
  },
]) {
  test(`next step: ${next.key}, the patient books it, then the visit is attended`, async ({ browser }) => {
    const name = `${next.key} Person ${Date.now() % 100000}`;
    const { doctor, journeyId } = await reachFibroscanReport(browser, name);
    await addSoonSlots(next.partner);

    const step = card(doctor, name);
    await step.getByLabel(next.radio).check();
    await step.getByRole("button", { name: "Record next step" }).click();
    await expect(doctor.getByRole("status").filter({ hasText: next.notice })).toBeVisible();

    const patient = await (await browser.newContext()).newPage();
    await patient.goto(await linkFromMessage(journeyId, next.message));
    await expect(patient.getByRole("heading", { name: next.title })).toBeVisible();
    await patient.getByRole("button", { name: "Nearest" }).click();
    await expect(patient.getByRole("status")).toContainText(/\w/);
    await patient.getByRole("button", { name: "Confirm booking" }).click();
    await expect(patient.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
    await expect(patient.getByText(next.place)).toBeVisible();

    await doctor.goto("/doctor");
    const followUp = card(doctor, name);
    await expect(followUp.getByText(next.place)).toBeVisible();
    await followUp.getByRole("button", { name: "Mark visit attended" }).click();
    await expect(doctor.getByRole("status").filter({ hasText: "journey is complete" })).toBeVisible();

    const { data: done } = await admin.from("journeys").select("stage, next_step").eq("id", journeyId).single();
    expect(done).toEqual({ stage: 9, next_step: next.key });
    expect(await eventsOf(journeyId)).toEqual([...BASE_EVENTS, "CHOOSE_NEXT_STEP", "BOOK", "MARK_ATTENDED"]);
  });
}

test("decline: a preset reason is recorded and the case stays on the dashboard", async ({ browser }) => {
  const name = `Decline Person ${Date.now() % 100000}`;
  const { doctor, journeyId } = await reachDecision(browser, name);

  const decision = card(doctor, name);
  await decision.getByLabel("Or decline FibroScan, with a reason").selectOption("Cost or access");
  await decision.getByRole("button", { name: "Decline FibroScan" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "FibroScan not approved" })).toBeVisible();
  await expect(doctor.locator("tr", { hasText: name }).getByText("Not approved", { exact: true })).toBeVisible();

  const { data: journey } = await admin.from("journeys").select("stage, decline_reason").eq("id", journeyId).single();
  expect(journey).toEqual({ stage: 10, decline_reason: "Cost or access" });
  const { data: row } = await admin.from("decisions").select("kind, reason").eq("journey_id", journeyId).single();
  expect(row).toEqual({ kind: "vcte_decline", reason: "Cost or access" });
});

test("re-review: the doctor sends the report back and the clinician sees it again", async ({ browser }) => {
  const name = `Rereview Person ${Date.now() % 100000}`;
  const { doctor, journeyId } = await reachDecision(browser, name);

  await card(doctor, name).getByRole("button", { name: "Ask for re-review" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "re-review" })).toBeVisible();

  const clinician = await signInAs(browser, "clinician");
  await expect(card(clinician, name).getByText("Re-review requested")).toBeVisible();
  const { data: journey } = await admin.from("journeys").select("stage").eq("id", journeyId).single();
  expect(journey!.stage).toBe(2);
});
