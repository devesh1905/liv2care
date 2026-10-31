import { expect, test, type Browser, type Page } from "@playwright/test";
import { addSoonSlots, admin, linkFromMessage, PARTNER, PDF, signInAs } from "./helpers";

/**
 * The whole pathway through the real screens, Option 1 start: the doctor enrols with an existing report, the clinician
 * reviews, the doctor decides on FibroScan, the patient books, the centre uploads, the doctor picks the next step, and
 * the journey completes. One test per next step, plus the decline and re-review paths. Fake data only.
 */

const card = (page: Page, name: string) => page.locator("section:has(> header)").filter({ hasText: name });

/** Enrols a patient with an existing report and takes it to the doctor's FibroScan decision. */
async function reachDecision(browser: Browser, name: string, recommend = true) {
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
  if (recommend) await review.getByLabel(/I recommend that the treating doctor considers a FibroScan/).check();
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
  // the notice links to the patient's phone, where the FibroScan message with its booking link is
  await expect(doctor.getByRole("link", { name: "See the message on the patient's phone" })).toHaveAttribute("href", `/phone/${journeyId}`);

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

  // the FibroScan report goes to the clinician first, who summarises it for the doctor
  const clinician = await signInAs(browser, "clinician");
  const scanReview = card(clinician, name);
  await expect(scanReview.getByText("FibroScan report", { exact: true })).toBeVisible();
  await expect(scanReview.getByLabel(/considers a FibroScan/)).toHaveCount(0);
  await scanReview.locator("input[name=fib4]").fill("8.1 kPa, CAP 290 (typed)");
  await scanReview.getByLabel("Clinical summary").fill(`FibroScan summary for ${name}`);
  await scanReview.getByRole("button", { name: "Send to the treating doctor" }).click();
  await expect(clinician.getByRole("status").filter({ hasText: "Review sent" })).toBeVisible();

  await doctor.goto("/doctor");
  await expect(card(doctor, name).getByText("8.1 kPa, CAP 290 (typed)")).toBeVisible();
  return { doctor, journeyId };
}

async function eventsOf(journeyId: string) {
  const { data } = await admin.from("journey_events").select("event").eq("journey_id", journeyId).order("id");
  return data!.map((e) => e.event);
}

const BASE_EVENTS = ["JOURNEY_STARTED", "EXISTING_REPORT_UPLOADED", "CLINICIAN_SUBMIT", "APPROVE_VCTE", "BOOK", "CENTRE_UPLOAD", "CLINICIAN_SUBMIT"];

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
  const { doctor, journeyId } = await reachDecision(browser, name, false);

  // without the clinician's recommendation, "no FibroScan" comes first and ordering one is still possible
  const decision = card(doctor, name);
  await expect(decision.getByText("The clinician did not recommend a FibroScan")).toBeVisible();
  await expect(decision.getByRole("button", { name: "Approve FibroScan" })).toHaveCount(0);
  await expect(decision.getByRole("button", { name: "Order a FibroScan anyway" })).toBeVisible();
  await decision.getByLabel("No FibroScan for now, with a reason").selectOption("Cost or access");
  await decision.getByRole("button", { name: "No FibroScan", exact: true }).click();
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

test("no FibroScan, but a routine follow-up is booked at the doctor's clinic", async ({ browser }) => {
  const name = `Decline Follow Person ${Date.now() % 100000}`;
  const { doctor, journeyId } = await reachDecision(browser, name, false);

  const decision = card(doctor, name);
  await decision.getByLabel("No FibroScan for now, with a reason").selectOption("Not clinically required now");
  await decision.getByLabel("Then").selectOption("6");
  await decision.getByRole("button", { name: "No FibroScan", exact: true }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "routine follow-up was booked" })).toBeVisible();

  const { data: journey } = await admin.from("journeys").select("stage, next_step, decline_reason").eq("id", journeyId).single();
  expect(journey).toEqual({ stage: 8, next_step: "routine", decline_reason: "Not clinically required now" });
  const { data: row } = await admin.from("decisions").select("kind, follow_up_months").eq("journey_id", journeyId).single();
  expect(row).toEqual({ kind: "vcte_decline", follow_up_months: 6 });
  const { data: booking } = await admin.from("bookings").select("kind, slot_label, status").eq("journey_id", journeyId).single();
  expect(booking).toEqual({ kind: "routine", slot_label: "In 6 months", status: "booked" });
});
