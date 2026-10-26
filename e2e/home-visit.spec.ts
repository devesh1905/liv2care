import { expect, test } from "@playwright/test";
import { admin, linkFromMessage, PARTNER, signInAs } from "./helpers";

/** A patient books blood-test collection at home; the lab sees the address; liver function tests (LFT) are named in the order. */
test("home collection: the patient gives an address and the lab sees it", async ({ browser }) => {
  const name = `Home Person ${Date.now() % 100000}`;
  const flat = `Flat ${Date.now() % 100000}B`;

  await admin.from("slots").insert({ partner_id: PARTNER.sunrise, starts_at: new Date(Date.now() + 3 * 3600_000).toISOString(), home: true });

  const doctor = await signInAs(browser, "doctor");
  await doctor.getByLabel("Patient name", { exact: true }).fill(name);
  await doctor.getByLabel("Age", { exact: true }).fill("51");
  await expect(doctor.getByLabel(/Include liver function tests/)).toBeChecked();
  await doctor.getByLabel(/has given consent/).check();
  await doctor.getByRole("button", { name: "Enrol patient" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "booking link was sent" })).toBeVisible();

  const { data: patient } = await admin.from("patients").select("id").eq("name", name).single();
  const { data: journey } = await admin.from("journeys").select("id, lft").eq("patient_id", patient!.id).single();
  expect(journey!.lft).toBe(true);
  const journeyId = journey!.id as string;
  const { data: order } = await admin.from("messages").select("body").eq("journey_id", journeyId).like("body", "Your doctor has requested some blood tests%");
  expect(order![0].body).toContain("liver function tests");

  const phone = await (
    await browser.newContext({ viewport: { width: 360, height: 800 }, permissions: ["geolocation"], geolocation: { latitude: 17.385044, longitude: 78.486671 } })
  ).newPage();
  await phone.goto(await linkFromMessage(journeyId, "Your doctor has requested some blood tests"));
  await expect(phone.getByText("Where should the sample be taken?")).toBeVisible();

  // the address box only appears for a home visit, and a booking without one is refused
  await expect(phone.getByLabel("House / flat no.")).toHaveCount(0);
  await phone.getByText("At my home", { exact: true }).click();
  await expect(phone.getByLabel("House / flat no.")).toBeVisible();
  await phone.locator("label").filter({ has: phone.locator("input[name=choice]") }).first().click();
  await phone.locator("form").evaluate((f) => ((f as HTMLFormElement).noValidate = true)); // let the server do the refusing
  await phone.getByRole("button", { name: "Confirm booking" }).click();
  await expect(phone.getByRole("alert").filter({ hasText: "house or flat number, street, area and a 6-digit pincode" })).toBeVisible();

  // drop a pin with the phone's location (the map data itself comes from the internet, so the details are typed in too)
  await phone.getByRole("button", { name: "Use my current location" }).click();
  await expect(phone.getByRole("status").filter({ hasText: "Pin placed" })).toBeVisible();
  await phone.getByLabel("House / flat no.").fill(flat);
  await phone.getByLabel("Block / tower (optional)").fill("Block C");
  await phone.getByLabel("Street name").fill("Green Park Road");
  await phone.getByLabel("Area / locality").fill("Jubilee Hills");
  await phone.getByLabel("Pincode").fill("500033");
  await phone.getByLabel("Landmark (optional)").fill("near the temple");
  await phone.getByRole("button", { name: "Confirm booking" }).click();
  await expect(phone.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

  const { data: booking } = await admin.from("bookings").select("id, slot_label").eq("journey_id", journeyId).eq("status", "booked").single();
  expect(booking!.slot_label).toMatch(/^Home collection, /);
  const { data: visit } = await admin.from("home_visits").select("address_cipher").eq("booking_id", booking!.id).single();
  expect(visit!.address_cipher).toMatch(/^v1\./);
  expect(visit!.address_cipher).not.toContain("Green Park");
  expect(visit!.address_cipher).not.toContain("500033");

  // the lab sees the address and the tests; a centre or the doctor's page never shows it
  const lab = await signInAs(browser, "lab");
  await lab.goto("/partner");
  await expect(lab.getByTestId("home-address").filter({ hasText: flat })).toContainText("Jubilee Hills - 500033");
  await expect(lab.getByRole("link", { name: "Open the pin in Maps" }).first()).toHaveAttribute("href", /google\.com\/maps\?q=17\.\d+,78\.\d+/);
  await expect(lab.getByText("Includes liver function tests (LFT)").first()).toBeVisible();
  await doctor.goto("/doctor");
  await expect(doctor.getByText("Green Park")).toHaveCount(0);
});
