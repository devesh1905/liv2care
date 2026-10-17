import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { addSoonSlots, admin, linkFromMessage, PARTNER, signInAs } from "./helpers";

/** Edge cases from docs/test-plan.md: bad input, wrong people, bad links, clashes and small screens. Fake data only. */
const PHONE = { width: 360, height: 800 };
const UNKNOWN_ID = "00000000-0000-4000-8000-0000000000fe";
const INVALID_LINK = "This link has expired or is not valid";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const unique = (label: string) => `${label} ${Date.now() % 1_000_000}`;

/** Fills the enrolment form the way a doctor would and enrols an Option 2 patient. Returns the journey id. */
async function enrolOption2(doctor: Page, name: string): Promise<string> {
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("55");
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  // the message names this patient, so an older "enrolled" message cannot satisfy the wait
  await expect(doctor.getByRole("status").filter({ hasText: `${name} (` })).toBeVisible();
  return journeyIdOf(name);
}

async function journeyIdOf(name: string): Promise<string> {
  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id").eq("patient_id", patient!.id).single();
  return journey!.id as string;
}

async function sideways(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function seriousProblems(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("nextjs-portal").analyze();
  return results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`);
}

test.describe("sign-in and access", () => {
  test("an unknown email and a wrong password get the same plain message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@demo.liv2care.test");
    await page.getByLabel("Password").fill("not-a-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Wrong email or password" })).toBeVisible();
  });

  test("each person is kept to their own pages", async ({ browser }) => {
    const cases = [
      ["lab", "/doctor", /\/partner$/],
      ["doctor", "/ops", /\/doctor$/],
      ["clinician", "/partner", /\/clinician$/],
      ["ops", "/doctor", /\/ops$/],
      ["lab", `/phone/${UNKNOWN_ID}`, /\/partner$/],
      ["centre", "/ops", /\/partner$/],
    ] as const;
    for (const [role, path, landing] of cases) {
      const page = await signInAs(browser, role);
      await page.goto(path);
      await expect(page, `${role} on ${path}`).toHaveURL(landing);
      await page.context().close();
    }
  });

  test("after signing out, a staff page asks for sign-in again", async ({ browser }) => {
    const doctor = await signInAs(browser, "doctor");
    await doctor.getByRole("button", { name: "Sign out" }).click();
    await doctor.goto("/doctor");
    await expect(doctor).toHaveURL(/\/login/);
    await doctor.goBack();
    await doctor.goto("/phone/" + UNKNOWN_ID);
    await expect(doctor).toHaveURL(/\/login/);
  });

  test("the patient's phone view: a made-up or malformed id is not found, operations may look", async ({ browser }) => {
    const doctor = await signInAs(browser, "doctor");
    for (const id of ["not-an-id", UNKNOWN_ID]) {
      await doctor.goto(`/phone/${id}`);
      await expect(doctor.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
    }
    const name = unique("Phone Access");
    await doctor.goto("/doctor");
    const journeyId = await enrolOption2(doctor, name);
    const ops = await signInAs(browser, "ops");
    await ops.goto(`/phone/${journeyId}`);
    await expect(ops.getByRole("group", { name: new RegExp(name) })).toBeVisible();
  });
});

test.describe("enrolling a patient", () => {
  test("bad input is refused with a clear message and nobody is enrolled", async ({ browser }) => {
    const doctor = await signInAs(browser, "doctor");
    const name = unique("Refused Person");
    const form = doctor.locator("form").filter({ has: doctor.getByLabel("Patient name", { exact: true }) });
    await form.evaluate((f) => ((f as HTMLFormElement).noValidate = true)); // let the server do the refusing
    await doctor.getByLabel("Patient name", { exact: true }).evaluate((el) => el.removeAttribute("maxlength"));
    await doctor.getByLabel(/Phone, last 4/).evaluate((el) => el.removeAttribute("maxlength"));
    const refused = (text: string | RegExp) => expect(doctor.getByRole("alert").filter({ hasText: text })).toBeVisible();
    // wait for the server's answer and for the form to settle, so a message left from the last try cannot count
    const enrol = async () => {
      const sent = doctor.waitForResponse((r) => r.request().method() === "POST");
      await doctor.getByRole("button", { name: "Enrol patient" }).click();
      await sent;
      await expect(doctor.getByRole("button", { name: "Enrol patient" })).toBeEnabled();
      await doctor.waitForTimeout(400);
    };
    const consent = doctor.getByLabel(/has given consent/);

    await consent.check();
    await doctor.getByLabel("Age", { exact: true }).fill("55");
    await enrol();
    await refused("Enter the patient's name");

    await doctor.getByLabel("Patient name", { exact: true }).fill("x".repeat(81));
    await enrol();
    await refused("Enter the patient's name");

    await doctor.getByLabel("Patient name", { exact: true }).fill(name);
    for (const age of ["17", "121", "forty"]) {
      // the page puts the number field back after each try, so make it a plain text field again (letters cannot be typed in a number field)
      await doctor.getByLabel("Age", { exact: true }).evaluate((el) => el.setAttribute("type", "text"));
      await doctor.getByLabel("Age", { exact: true }).fill(age);
      await enrol();
      await refused("Enter an age between 18 and 120");
    }

    await doctor.getByLabel("Age", { exact: true }).fill("55");
    await doctor.getByLabel(/Phone, last 4/).fill("12ab");
    await enrol();
    await refused("last 4 digits");
    await doctor.getByLabel(/Phone, last 4/).fill("");

    await consent.uncheck();
    await enrol();
    await refused("consent is required");
    await consent.check();

    // Option 1: no file, wrong kinds of file, a broken photo
    await doctor.getByText("Option 1: use an existing report").click();
    await enrol();
    await refused("Attach the existing lab report");
    const file = doctor.getByLabel("Existing lab report");
    await file.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await enrol();
    await refused("Only a PDF or a photo");
    await file.setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>not a pdf</html>") });
    await enrol();
    await refused("Only a PDF or a photo");
    await file.setInputFiles({ name: "broken.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]) });
    await enrol();
    await refused("could not be read");
    await file.setInputFiles({ name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.4 "), Buffer.alloc(5 * 1024 * 1024)]) });
    await enrol();
    await refused("larger than 5 MB");

    const { count } = await admin.from("patients").select("id", { count: "exact", head: true }).eq("name", name);
    expect(count).toBe(0);
  });

  test("a photo of a report is accepted for Option 1 and kept as a PDF", async ({ browser }) => {
    const doctor = await signInAs(browser, "doctor");
    const name = unique("Photo Person");
    await doctor.getByLabel("Patient name", { exact: true }).fill(name);
    await doctor.getByLabel("Age", { exact: true }).fill("61");
    await doctor.getByText("Option 1: use an existing report").click();
    await doctor.getByLabel("Existing lab report").setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG });
    await doctor.getByLabel(/has given consent/).check();
    await doctor.getByRole("button", { name: "Enrol patient" }).click();
    await expect(doctor.getByRole("status").filter({ hasText: "enrolled" })).toBeVisible();
    const journeyId = await journeyIdOf(name);
    const { data: report } = await admin.from("reports").select("file_name, storage_path").eq("journey_id", journeyId).single();
    expect(report!.file_name).toBe("scan.pdf");
    expect(report!.storage_path).toMatch(/\.pdf$/);
  });

  test("a name that looks like code is shown as plain text and runs nothing", async ({ browser }) => {
    const doctor = await signInAs(browser, "doctor");
    const name = `<img src=x onerror="window.__xss=1"> ${Date.now() % 100000}`;
    await enrolOption2(doctor, name);
    await doctor.goto("/doctor");
    await expect(doctor.getByText(name, { exact: false }).locator("visible=true").first()).toBeVisible();
    expect(await doctor.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });
});

test.describe("private links", () => {
  test("a progress link does not open the booking page, a booking link does not open progress, and an expired link is refused", async ({ browser }) => {
    const doctor = await signInAs(browser, "doctor");
    const name = unique("Link Edge");
    const journeyId = await enrolOption2(doctor, name);
    const { data: first } = await admin.from("messages").select("body").eq("journey_id", journeyId).like("body", "Your doctor has requested%").single();
    const bookToken = first!.body.match(/\/book\/([\w-]{32})/)![1];
    const viewToken = first!.body.match(/\/patient\/([\w-]{32})/)![1];

    const phone = await (await browser.newContext({ viewport: PHONE })).newPage();
    await phone.goto(`/patient/${bookToken}`);
    await expect(phone.getByText(INVALID_LINK)).toBeVisible();
    await phone.goto(`/book/${viewToken}`);
    await expect(phone.getByText(INVALID_LINK)).toBeVisible();

    await phone.goto(`/book/${bookToken}`);
    await expect(phone.getByRole("button", { name: "Nearest" })).toBeVisible();
    const hash = createHash("sha256").update(bookToken).digest("hex");
    await admin.from("booking_links").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", hash);
    await phone.reload();
    await expect(phone.getByText(INVALID_LINK)).toBeVisible();
    await phone.goto(`/book/${bookToken}?lang=hi`);
    await expect(phone.getByText("यह लिंक समाप्त हो गया है")).toBeVisible();
    await phone.goto(`/book/${bookToken}?lang=zz`); // an unknown language falls back to English
    await expect(phone.getByText(INVALID_LINK)).toBeVisible();
  });

  test("an upload link works once; a second try shows the report was received", async ({ browser }) => {
    const doctor = await signInAs(browser, "doctor");
    const name = unique("Upload Twice");
    await doctor.getByLabel("Patient name", { exact: true }).fill(name);
    await doctor.getByLabel("Age", { exact: true }).fill("57");
    await doctor.getByText("Option 1: use an existing report").click();
    await doctor.getByLabel(/The patient will upload the report/).check();
    await doctor.getByLabel(/has given consent/).check();
    await doctor.getByRole("button", { name: "Enrol patient" }).click();
    await expect(doctor.getByRole("status").filter({ hasText: "link to upload" })).toBeVisible();
    const journeyId = await journeyIdOf(name);
    const link = await linkFromMessage(journeyId, "Your doctor would like to see your latest lab report");

    // two phones open the same link; the first sends, the second is told it is already done
    const one = await (await browser.newContext({ viewport: PHONE })).newPage();
    const two = await (await browser.newContext({ viewport: PHONE })).newPage();
    await one.goto(link);
    await two.goto(link);
    await one.getByLabel("Your report").setInputFiles({ name: "r.png", mimeType: "image/png", buffer: PNG });
    await one.getByRole("button", { name: "Send report" }).click();
    await expect(one.getByRole("heading", { name: "Report received" })).toBeVisible();

    await two.getByLabel("Your report").setInputFiles({ name: "r2.png", mimeType: "image/png", buffer: PNG });
    await two.getByRole("button", { name: "Send report" }).click();
    await expect(two.getByRole("heading", { name: "Report received" })).toBeVisible(); // the page notices it is already done
    const { count } = await admin.from("reports").select("id", { count: "exact", head: true }).eq("journey_id", journeyId);
    expect(count).toBe(1);
  });
});

test.describe("booking and visits", () => {
  test("two patients taking the same time: the second is told it was just taken", async ({ browser }) => {
    await addSoonSlots(PARTNER.sunrise, 1);
    const doctor = await signInAs(browser, "doctor");
    const pages: Page[] = [];
    for (const label of ["Clash A", "Clash B"]) {
      const id = await enrolOption2(doctor, unique(label));
      const page = await (await browser.newContext({ viewport: PHONE })).newPage();
      await page.goto(await linkFromMessage(id, "Your doctor has requested"));
      await page.getByRole("button", { name: "Nearest" }).click();
      await expect(page.getByRole("status")).toContainText(/\w/);
      pages.push(page);
    }
    await pages[0].getByRole("button", { name: "Confirm booking" }).click();
    await expect(pages[0].getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
    await pages[1].getByRole("button", { name: "Confirm booking" }).click();
    await expect(pages[1].getByRole("alert").filter({ hasText: "just taken" })).toBeVisible();
  });

  test("a visit cannot be marked before its slot, even if the greyed-out button is forced", async ({ browser }) => {
    await addSoonSlots(PARTNER.sunrise);
    const doctor = await signInAs(browser, "doctor");
    const name = unique("Too Early");
    const id = await enrolOption2(doctor, name);
    const patient = await (await browser.newContext({ viewport: PHONE })).newPage();
    await patient.goto(await linkFromMessage(id, "Your doctor has requested"));
    await patient.getByRole("button", { name: "Nearest" }).click();
    await patient.getByRole("button", { name: "Confirm booking" }).click();
    await expect(patient.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

    const lab = await signInAs(browser, "lab");
    await lab.goto("/partner");
    const visit = lab.locator("section:has(> header)").filter({ hasText: name });
    const missed = visit.getByRole("button", { name: "Mark missed" });
    await expect(missed).toBeDisabled();
    await missed.evaluate((b) => {
      const button = b as HTMLButtonElement;
      button.disabled = false;
      button.form!.requestSubmit();
    });
    await expect(visit.getByRole("alert").filter({ hasText: "until its slot has started" })).toBeVisible();
    const { data: journey } = await admin.from("journeys").select("missed").eq("id", id).single();
    expect(journey!.missed).toBe(false);
  });

  test("adding a slot: the past, a repeat and a booked slot are refused", async ({ browser }) => {
    const lab = await signInAs(browser, "lab");
    await lab.goto("/partner");
    const form = lab.getByRole("form", { name: /New slot/ });
    const add = async (date: string, hour: string, minute: string, period: string) => {
      await form.getByLabel("Date").fill(date);
      await form.getByLabel("Hour").selectOption(hour);
      await form.getByLabel("Minute").selectOption(minute);
      await form.getByLabel("AM or PM").selectOption(period);
      await form.getByRole("button", { name: "Add slot" }).click();
    };
    await add("2020-01-01", "9", "00", "AM");
    await expect(lab.getByRole("alert").filter({ hasText: "Choose a time in the future" })).toBeVisible();

    const day = new Date(Date.now() + (500 + (Date.now() % 300)) * 86_400_000).toISOString().slice(0, 10);
    await add(day, "6", "45", "AM");
    await expect(lab.getByRole("status").filter({ hasText: "Slot added." })).toBeVisible();
    await add(day, "6", "45", "AM");
    await expect(lab.getByRole("alert").filter({ hasText: "already exists" })).toBeVisible();

    // an empty date is refused by the browser, and by the server when the form is forced
    await form.evaluate((f) => ((f as HTMLFormElement).noValidate = true));
    await form.getByLabel("Date").fill("");
    await form.getByRole("button", { name: "Add slot" }).click();
    await expect(lab.getByRole("alert").filter({ hasText: "Choose a date and time" })).toBeVisible();
  });
});

test.describe("small screens and accessibility of the newer pages", () => {
  test("nothing scrolls sideways at 360 px wide", async ({ browser }) => {
    const visitor = await (await browser.newContext({ viewport: PHONE })).newPage();
    for (const path of ["/", "/demo", "/demo/doctor", "/login"]) {
      await visitor.goto(path);
      await visitor.waitForLoadState("networkidle");
      expect(await sideways(visitor), `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    }

    const doctor = await signInAs(browser, "doctor", PHONE);
    const id = await enrolOption2(doctor, unique("Small Screen"));
    await doctor.goto(`/phone/${id}`);
    await expect(doctor.getByRole("group", { name: /phone/ })).toBeVisible();
    expect(await sideways(doctor), "/phone scrolls sideways").toBeLessThanOrEqual(0);
  });

  test("the upload page and the phone view pass the accessibility scan", async ({ browser }) => {
    const doctor = await signInAs(browser, "doctor", { width: 1280, height: 1300 });
    const name = unique("Scan Person");
    await doctor.getByLabel("Patient name", { exact: true }).fill(name);
    await doctor.getByLabel("Age", { exact: true }).fill("49");
    await doctor.getByText("Option 1: use an existing report").click();
    await doctor.getByLabel(/The patient will upload the report/).check();
    await doctor.getByLabel(/has given consent/).check();
    await doctor.getByRole("button", { name: "Enrol patient" }).click();
    await expect(doctor.getByRole("status").filter({ hasText: "link to upload" })).toBeVisible();
    const id = await journeyIdOf(name);
    const link = await linkFromMessage(id, "Your doctor would like to see your latest lab report");

    const phone = await (await browser.newContext({ viewport: PHONE })).newPage();
    for (const lang of ["en", "hi"]) {
      await phone.goto(`${link}?lang=${lang}`);
      await expect(phone.getByRole("button", { name: lang === "en" ? "Send report" : "रिपोर्ट भेजें" })).toBeVisible();
      expect(await seriousProblems(phone), `upload page ${lang}`).toEqual([]);
    }

    await doctor.goto(`/phone/${id}`);
    await expect(doctor.getByRole("group", { name: /phone/ })).toBeVisible();
    expect(await seriousProblems(doctor), "phone view").toEqual([]);
  });
});

test("the doctor gets a message-log view for a patient with no messages yet", async ({ browser }) => {
  // a journey created straight in the database has no messages: the phone says so instead of breaking
  const doctor = await signInAs(browser, "doctor");
  const name = unique("Quiet Person");
  const id = await enrolOption2(doctor, name);
  await admin.from("messages").delete().eq("journey_id", id);
  await doctor.goto(`/phone/${id}`);
  await expect(doctor.getByText("No messages yet.")).toBeVisible();
});
