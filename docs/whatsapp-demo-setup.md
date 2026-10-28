# Real WhatsApp messages for the demo

Three senders are supported, tried in this order: **OpenWA** (demo only), **Twilio's WhatsApp Sandbox**, then **Meta's Cloud API**. Twilio's sandbox works with no business verification. **Meta's Cloud API test number** only works once Meta has verified the business (until then Meta answers "Business Account locked").

## OpenWA (demo only: messages come from a "Livacare" number, no join step)

OpenWA (github.com/rmyndharis/OpenWA, MIT) is a self-hosted gateway that sends from an ordinary WhatsApp number linked by QR code, like WhatsApp Web. **It is unofficial: WhatsApp can restrict or ban the number at any time, and its own README rules it out for healthcare.** Use it for the demo with a spare SIM, message only the team's and the doctors' own phones, and never put a real patient's number in it. The pilot uses Meta's Cloud API.

1. A spare SIM with WhatsApp (or WhatsApp Business) on a phone. Set the profile name to **Livacare** and the profile photo to the Liv2care logo. Warm it up for a day or two: save the demo phones as contacts and exchange a few normal messages.
2. Run OpenWA on an always-on server with a persistent disk for `/app/data` (Vercel cannot host it): the image `ghcr.io/rmyndharis/openwa`, port 2785. The first boot prints an admin API key once (also in `/app/data/.api-key`).
3. Open the dashboard (`https://<server>/`), sign in with that key, create a session (for example `liv2care-demo`), start it, and scan the QR code from the spare phone (WhatsApp > Linked devices).
4. In the dashboard, make an **operator** API key limited to that session.
5. Settings in Vercel (then redeploy): `OPENWA_URL` (the server address, no trailing slash), `OPENWA_API_KEY` (the operator key, secret), `OPENWA_SESSION_ID`, and `DEMO_WHATSAPP_TO` (the demo phones). A patient number typed at enrolment is used instead when present.
6. Have each demo phone message the Livacare number once first: WhatsApp drops some first messages to brand-new contacts.

## Twilio WhatsApp Sandbox

1. Sign in at console.twilio.com (a free trial account is enough).
2. Open **Messaging > Try it out > Send a WhatsApp message**. Twilio shows the sandbox number (for example +1 415 523 8886) and a join phrase (for example `join something-word`).
3. On the demo phone, send that join phrase to the sandbox number on WhatsApp. Twilio replies that the phone is connected.
4. Settings in Vercel (then redeploy): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (secret, from the console's front page), `TWILIO_WHATSAPP_FROM` (`whatsapp:` plus the sandbox number, for example `whatsapp:+14155238886`), and `DEMO_WHATSAPP_TO` (the demo phone, country code first, digits only; up to 5 numbers separated by commas, each of which must join the sandbox).
5. WhatsApp allows free text for 24 hours after the demo phone last messaged the sandbox number, so send any message ("Hi") before each demo.

## Meta test number (needs a verified business)


Every message the app sends is also delivered as a real WhatsApp message. If the doctor typed the patient's mobile number when enrolling, the message goes to that number; otherwise it goes to the demo phone(s). The message log and the patient's-phone view keep working as before.

## The patient's number (needs `PHONE_ENCRYPTION_KEY`)

- The doctor types the number in the enrol form (optional). It is stored encrypted (AES-256-GCM) in `patient_contacts`, which only the server can read, and the database erases it as soon as the journey is completed or not approved. The rest of the app only ever shows a masked number such as `98•••• 3210`.
- Set `PHONE_ENCRYPTION_KEY` in Vercel first: 32 random bytes, base64 (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). Without it the enrol form refuses a number. Keep a copy of the key somewhere safe; if it is lost, stored numbers cannot be read.
- With the Twilio **sandbox**, a patient's phone only receives messages after joining the sandbox, so for the demo type the number of someone who has joined (for example your own). A real pilot needs an approved WhatsApp business sender and approved message templates (free text only works for 24 hours after the patient last wrote to us); that is the paid, verified setup.
- The consent wording does not yet mention keeping the number; the clinical and legal reviewers should confirm it (queued in `waiting-on-people.md`).

## One-time setup (about 30 minutes)

1. Go to developers.facebook.com and sign in with a Facebook account. Accept the developer terms and confirm your phone number.
2. **Create app**: use case *Other*, app type *Business*, name *Liv2care Demo*. Attach or create a Meta Business portfolio (no verification is needed for the test number).
3. On the app dashboard add the **WhatsApp** product and choose *Set up*.
4. Open **WhatsApp > API Setup**. Meta gives you a free **test phone number**. Copy the **Phone number ID** (not the number itself).
5. Under **To**, choose *Manage phone number list*, add the demo phone (up to 5), and enter the code Meta sends to that phone on WhatsApp.
6. Press **Send message** on that page once. The demo phone receives a "hello world" message, which proves the setup.
7. The access token on that page lasts 24 hours. Make a permanent one: **Business settings > Users > System users > Add**, role *Admin*; *Add assets* > the app, with full control; **Generate token**, choose the app, tick `whatsapp_business_messaging` and `whatsapp_business_management`, no expiry. Copy the token now, it is shown once.

## Settings in Vercel (Project > Settings > Environment Variables, then redeploy)

| Name | Value |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | the Phone number ID from step 4 |
| `WHATSAPP_ACCESS_TOKEN` | the permanent token from step 7 (a secret) |
| `DEMO_WHATSAPP_TO` | the demo phone, country code first, digits only, for example `919876543210` |

## Before every demo

The demo phone must send **"Hi"** to the test number. WhatsApp then allows free text for 24 hours. Outside that window the app falls back to Meta's sample "hello world" message, so repeat the "Hi" within a day of the demo.

## Turning it off

Delete `DEMO_WHATSAPP_TO` in Vercel and redeploy. Nothing is sent, and the simulated phone still works.

## Before real patients

This test number is for demos only. For real use, see the pilot notes: a verified business, an approved sender and approved message templates.
