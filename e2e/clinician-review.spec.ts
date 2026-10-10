import { expect, test } from "@playwright/test";
import { admin, PDF, signInAs } from "./helpers";

/**
 * Option 1 then the clinical handoff: the doctor uploads an existing report, the clinician opens it through the signed
 * link, types FIB-4 and the summary, and sends it on. Operations cannot open the report. Fake data only.
 */
test("clinician reviews an existing report and sends it to the doctor", async ({ browser }) => {
  const name = `Review Person ${Date.now() % 100000}`;
  const summaryText = `E2E summary typed by hand ${Date.now()}`;

  // 1. The doctor enrols the patient with an existing report (Option 1)
  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("61");
  await doctor.getByText("Option 1: use an existing report").click();
  await doctor.getByLabel("Existing lab report").setInputFiles(PDF);
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "enrolled" })).toBeVisible();

  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id, stage").eq("patient_id", patient!.id).single();
  expect(journey!.stage).toBe(2);
  const { data: report } = await admin.from("reports").select("id").eq("journey_id", journey!.id).single();

  // 2. Operations cannot open the report, and nothing is recorded for that attempt
  const ops = await signInAs(browser, "ops");
  const denied = await ops.request.get(`/reports/${report!.id}`, { maxRedirects: 0 });
  expect(denied.status()).toBe(404);

  // 3. The clinician finds the patient in the queue and opens the report through a signed link
  const clinician = await signInAs(browser, "clinician");
  const card = clinician.locator("section:has(> header)").filter({ hasText: name });
  await expect(card).toBeVisible();
  const link = card.getByRole("link", { name: /Open/ });
  const signed = await clinician.request.get(await link.getAttribute("href") as string, { maxRedirects: 0 });
  expect(signed.status()).toBe(307);
  expect(signed.headers().location).toContain("/storage/v1/object/sign/reports/");

  // 4. The clinician types the review and sends it
  await card.getByLabel("FIB-4").fill("2.5 (typed by the clinician)");
  await card.getByLabel("Clinical summary").fill(summaryText);
  await card.getByLabel(/considers a FibroScan/).check();
  await card.getByRole("button", { name: "Send to the treating doctor" }).click();
  await expect(clinician.getByRole("status").filter({ hasText: "Review sent" })).toBeVisible();
  await expect(clinician.getByText(summaryText)).toBeVisible();

  // 5. The database holds exactly what was typed; the audit trail holds no clinical text
  const { data: review } = await admin.from("reviews").select("fib4_text, summary, recommends_vcte").eq("journey_id", journey!.id).single();
  expect(review).toEqual({ fib4_text: "2.5 (typed by the clinician)", summary: summaryText, recommends_vcte: true });
  const { data: after } = await admin.from("journeys").select("stage").eq("id", journey!.id).single();
  expect(after!.stage).toBe(3);

  const { data: events } = await admin.from("journey_events").select("event, actor_role, detail").eq("journey_id", journey!.id).order("id");
  expect(events!.map((e) => [e.event, e.actor_role])).toEqual([
    ["JOURNEY_STARTED", "doctor"],
    ["EXISTING_REPORT_UPLOADED", "doctor"],
    ["REPORT_ACCESSED", "clinician"],
    ["CLINICIAN_SUBMIT", "clinician"],
  ]);
  expect(JSON.stringify(events)).not.toContain(summaryText);
  expect(JSON.stringify(events)).not.toContain("2.5");
});
