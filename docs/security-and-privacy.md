# Security and privacy

A plain-language summary for reviewers. Everything below describes what is built and tested today. The last section lists what is not done yet.

**This is a demo build.** It holds invented patients only, and every message is simulated: nothing is sent to a real phone.

## What the software never does

- It never diagnoses, calculates FIB-4 or any other score, applies a threshold to a lab value, or writes clinical text. The telemedicine clinician types the FIB-4 and the summary by hand, and the app stores exactly what was typed.
- The AI never sees clinical information. It only helps with logistics (see "The AI helper").

## Who can see what

Access is enforced inside the database (row-level security), not by hiding buttons. A page that is hidden in the screen is still protected if someone calls the database directly.

| Who | Can see | Cannot see |
|---|---|---|
| Treating doctor | Their own patients, the clinician's review, the reports, their own decisions | Other doctors' patients |
| Telemedicine clinician | Reports and journeys waiting for review, or already reviewed by them | Doctor decisions, messages |
| Lab and diagnostic centre | Visits booked at their own site, and the reports they uploaded themselves | Reviews, other sites' visits, other reports |
| Operations | A status view (name, stage, next action), pending actions, the audit trail, the message log, headline numbers | Reports, reviews, decisions, any lab value |
| Patient (no account) | Their own booking page and progress page, through a private link | Anything else |

## The audit trail

Every stage change and every report action writes a row: who did it, what, and when. The table accepts new rows only: a database rule refuses edits and deletes, even from the table's owner. The audit rows carry logistics only (a place, a time, a preset reason). They never hold lab values, FIB-4 or summary text, and tests check that.

Opening a report is audited too. Reports open through a signed link that expires after 60 seconds.

## Reports and files

- Reports are PDFs in a private storage bucket: PDF only, 5 MB at most, checked by the file's contents and not just its name.
- Who may upload or read a file is decided by database rules, so a lab can only add a report for a patient booked at that lab.

## Patient links

A patient has no account and no password. They act through a private link in a text message:
- The link holds a long random token. Only a one-way hash of it is stored, so a copy of the database cannot be used to rebuild a link.
- Booking links expire after 7 days and a new link replaces the old one. Progress links last 90 days. A progress link cannot book, and a booking link cannot open the progress page.
- Both pages ask search engines not to index them and send no referrer.

## The AI helper

- Code, not the model, picks the slot (nearest place, earliest time, or earliest morning). In our tests small models picked the wrong slot about half the time, so they are not trusted with the choice.
- The model only phrases one short sentence, in English or Hindi, from the facts of that one slot: place, distance and time. It receives no patient name, no ids, no lab or clinical value, and no other slot.
- The reply is rejected unless it is short, in the right script, and uses only numbers that were in the facts. Any failure falls back to a plain, translated sentence.
- It is the only code allowed to call the model, and a lint rule stops it importing any journey, report, review or database code.
- Calls are capped per day for the whole app, per patient link per day, and per minute, kept in the database. Over a limit, the model is skipped and booking still works.
- The default model is Gemma 4 on Google's free tier, which may use prompts to improve Google's products. Today's prompts contain only invented slot data. A real pilot would switch to a paid model.

## Web hardening

- Every page sends headers that stop it being shown inside another site, stop file-type guessing, limit the referrer, and switch off camera, microphone and location.
- Friendly 404 and error pages never print an error message or a stack trace.
- Staff sign in with Supabase Auth; sign-ins are rate limited. Redirects after sign-in accept only same-site paths.
- The reminder job is protected by a secret and answers strangers with 401 or 503.
- The service key that bypasses the database rules is used only on the server, for the few functions that change a journey.

## Secrets and dependencies

- No secrets are in the code or its history (scanned). Keys live in environment variables, and `.env.example` lists them without values.
- The production dependency audit reports 0 vulnerabilities. Development tools have known issues that never run on the site.

## How this is checked

Every push runs, on GitHub's servers: lint, type check, unit tests, a production build, database tests (access rules for every role, the insert-only audit, the stage guard, rules that every table has row-level security and that server-only functions cannot be called from a browser), integration tests on a real database, and browser tests that walk the pathway through the real screens, check every page at phone width, run a full Hindi journey, and check the security headers.

## Not done yet (honest list)

- **Real patient data.** None has been used. Before any, the project needs a compliance review (for India: consent, the Digital Personal Data Protection Act, hosting region, retention) and a security review by someone independent.
- **Real messages.** SMS and WhatsApp are simulated.
- **Staff sign-in strength.** Passwords only: no two-factor sign-in, and session length is Supabase's default.
- **Backups and monitoring.** Not set up for the demo.
- **Hindi and message wording.** First drafts, waiting for clinical and native-speaker review.
- **Content-Security-Policy.** Limited to framing and forms; a strict script policy needs per-request nonces and is future work.
- **Demo sign-in buttons.** The home page has one-click role panels for reviewers (each asks for that account's password). They must be switched off before the final submission.
