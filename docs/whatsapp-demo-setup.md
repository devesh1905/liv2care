# Real WhatsApp messages for the demo (Meta test number)

Every message the app sends is also delivered to **one demo phone** as a real WhatsApp message. Patients are never contacted, because the app keeps only the last 4 digits of a number. The message log and the patient's-phone view keep working as before.

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
