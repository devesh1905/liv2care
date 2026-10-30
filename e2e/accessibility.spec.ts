import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addSoonSlots, admin, linkFromMessage, PARTNER, signInAs } from "./helpers";

/**
 * An automated accessibility scan (axe) of every kind of page, at laptop and phone width, in English and Hindi.
 * It fails on any "serious" or "critical" problem against WCAG 2.0 and 2.1 level A and AA (text contrast, missing
 * labels, bad heading order, keyboard access and so on). Smaller findings are listed in the test report.
 * This is the automated part only: a person still needs to check with a keyboard and a screen reader.
 */
const PHONE = { width: 360, height: 800 };
const LAPTOP = { width: 1280, height: 800 };

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Next.js adds its own helper elements while developing; they are not part of the product
    .exclude("nextjs-portal")
    .analyze();

  const describe = (v: (typeof results.violations)[number]) =>
    `${v.id} [${v.impact}] ${v.help} :: ${v.nodes
      .slice(0, 3)
      .map((n) => n.target.join(" "))
      .join(" | ")}`;

  const minor = results.violations.filter((v) => !["serious", "critical"].includes(v.impact ?? ""));
  if (minor.length) test.info().annotations.push({ type: `minor findings on ${label}`, description: minor.map(describe).join("\n") });

  expect(results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map(describe), label).toEqual([]);
}

for (const [name, size] of [
  ["laptop", LAPTOP],
  ["phone", PHONE],
] as const) {
  test.describe(`public pages (${name})`, () => {
    test.use({ viewport: size });

    test("home, sign-in, 404 and an expired link", async ({ page }) => {
      for (const path of ["/", "/login", "/no-such-page", `/book/${"x".repeat(32)}`, `/patient/${"x".repeat(32)}`]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await scan(page, `${path.slice(0, 14)} ${name}`);
      }
    });

    test("the demo role pages", async ({ page }) => {
      await page.goto("/demo");
      await page.waitForLoadState("networkidle");
      await scan(page, `demo index ${name}`);
      await page.goto("/demo/doctor");
      await scan(page, `demo role page ${name}`);
      await page.getByLabel("Password").fill("not-the-password");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Wrong email or password" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
      await page.waitForTimeout(500); // the button fades back from its "signing in" look
      await scan(page, `demo role page with an error ${name}`);
    });
  });

  test(`staff pages (${name})`, async ({ browser }) => {
    for (const [role, path] of [
      ["doctor", "/doctor"],
      ["clinician", "/clinician"],
      ["lab", "/partner"],
      ["centre", "/partner"],
      ["ops", "/ops"],
    ] as const) {
      const page = await signInAs(browser, role, size);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Loading…")).toBeHidden();
      await scan(page, `${role} ${name}`);
      await page.context().close();
    }
  });
}

test("patient pages in English and Hindi, on a phone", async ({ browser }) => {
  const name = `Access Person ${Date.now() % 100000}`;
  await addSoonSlots(PARTNER.sunrise);
  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("50");
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "enrolled" })).toBeVisible();
  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id").eq("patient_id", patient!.id).single();
  const journeyId = journey!.id as string;

  const first = await admin.from("messages").select("body").eq("journey_id", journeyId).like("body", "Your doctor has requested%").single();
  const progress = first.data!.body.match(/https?:\/\/\S+\/patient\/\S+/)![0];
  const bookingLink = await linkFromMessage(journeyId, "Your doctor has requested");

  const page = await (await browser.newContext({ viewport: PHONE })).newPage();
  for (const lang of ["en", "hi"]) {
    await page.goto(`${bookingLink}?lang=${lang}`);
    await expect(page.getByRole("button", { name: lang === "en" ? "Nearest" : "सबसे नज़दीक" })).toBeVisible();
    await scan(page, `booking page ${lang}`);
    await page.getByRole("button", { name: lang === "en" ? "Nearest" : "सबसे नज़दीक" }).click();
    await expect(page.getByRole("status")).toContainText(/\w/);
    await page.waitForTimeout(500); // the chosen slot fades to its new colour; scan once it has settled
    await scan(page, `booking page with a suggestion ${lang}`);

    await page.goto(`${progress}?lang=${lang}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await scan(page, `progress page ${lang}`);
  }

  // after booking, the confirmation view
  await page.goto(bookingLink);
  await page.getByRole("button", { name: "Nearest" }).click();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
  await scan(page, "booking confirmation");
});
