import { expect, test } from "@playwright/test";
import { admin, linkFromMessage, signInAs } from "./helpers";

/**
 * Option 1 where the patient sends the report: the doctor enrols without a file and a private link is sent. The patient
 * opens it on a phone and uploads a photo; it is stored as a PDF and the journey moves to the clinician's queue.
 */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("the patient uploads their existing report from the link", async ({ browser }) => {
  const name = `Upload Person ${Date.now() % 100000}`;

  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("58");
  await doctor.getByText("Option 1: use an existing report").click();
  await doctor.getByLabel(/The patient will upload the report/).check();
  await expect(doctor.getByLabel("Existing lab report")).toHaveCount(0);
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "link to upload their report was sent" })).toBeVisible();

  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id, stage, route").eq("patient_id", patient!.id).single();
  expect(journey).toMatchObject({ stage: 0, route: "existing_report" });
  const journeyId = journey!.id as string;

  // the progress page tells the patient what to do, and the booking link opens the upload page
  const phone = await (await browser.newContext({ viewport: { width: 360, height: 800 } })).newPage();
  const link = await linkFromMessage(journeyId, "Your doctor would like to see your latest lab report");
  await phone.goto(link);
  await expect(phone.getByRole("heading", { name: "Send your lab report" })).toBeVisible();

  // a file that is neither a PDF nor a photo is refused
  await phone.getByLabel("Your report").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await phone.getByRole("button", { name: "Send report" }).click();
  await expect(phone.getByRole("alert").filter({ hasText: "Only a PDF or a photo" })).toBeVisible();

  // a photo is accepted and kept as a PDF
  await phone.getByLabel("Your report").setInputFiles({ name: "my report.png", mimeType: "image/png", buffer: PNG });
  await phone.getByRole("button", { name: "Send report" }).click();
  await expect(phone.getByRole("heading", { name: "Report received" })).toBeVisible();

  const { data: after } = await admin.from("journeys").select("stage").eq("id", journeyId).single();
  expect(after!.stage).toBe(2);
  const { data: report } = await admin.from("reports").select("file_name, kind, storage_path").eq("journey_id", journeyId).single();
  expect(report).toMatchObject({ file_name: "my_report.pdf", kind: "lab" });
  const { data: event } = await admin.from("journey_events").select("actor_role").eq("journey_id", journeyId).eq("event", "PATIENT_UPLOAD").single();
  expect(event!.actor_role).toBe("patient");
  const { data: thanks } = await admin.from("messages").select("body").eq("journey_id", journeyId).like("body", "Thank you, we have received your report%");
  expect(thanks).toHaveLength(1);

  // opening the link again no longer asks for a report
  await phone.reload();
  await expect(phone.getByRole("heading", { name: "Send your lab report" })).toHaveCount(0);
  await expect(phone.getByRole("heading", { name: "Report received" })).toBeVisible();

  // the report is in the clinician's queue
  const clinician = await signInAs(browser, "clinician");
  await expect(clinician.getByText(name).first()).toBeVisible();
});
