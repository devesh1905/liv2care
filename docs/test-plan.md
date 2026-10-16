# Test plan, including edge cases

How Liv2care is tested before the demo and the submission. Everything uses invented people and pretend messages.

## Where each kind of test runs

| Kind | Where | Who runs it | Covers |
|---|---|---|---|
| Unit tests (`npm test`) | GitHub, on every push | automatic | pathway rules, message wording, file checks, date handling |
| Database tests (`npm run test:db`, `npm run test:int`) | GitHub, local database | automatic | who can read and write what, the audit trail, link rules, the upload and booking functions |
| Browser tests (`npm run e2e`) | GitHub, a real browser against a local copy | automatic | every role's pages, the patient pages, the phone view, accessibility scan, security headers |
| Live check (`node scripts/check-live.mjs`) | the Vercel site, without signing in | Claude, after each deploy | home, demo pages, expired links, headers, no script errors |
| Live click-through, signed in | the Vercel site | **a person** (Deveshwar, Kanya) | the same pathway on the real site, on a real phone |

The live click-through is done by a person because signing in to the hosted site is not something Claude does. The steps are in `testing-process.pdf` and below.

## Edge cases the browser and database tests cover

### Sign-in and access
1. Wrong password, empty password, unknown email: a clear message, no hint about which part was wrong.
2. Each role opening another role's page (lab on `/doctor`, doctor on `/ops`, clinician on `/partner`): sent back to their own page.
3. Signed out, then the browser Back button: no staff page is shown.
4. A stranger on every staff page, `/phone/...` and `/reports/...`: sent to sign in.
5. The patient's phone view: operations and the doctor only; a lab or centre is refused; a malformed or unknown id is not found.
6. A report file: the doctor and clinician in scope can open it; operations, a lab and a stranger cannot.

### Private links
7. Unknown, malformed, expired and revoked links: a polite "expired or not valid" page, in both languages.
8. A booking link used on the progress page, and the other way round: refused.
9. A newer booking link replaces the older one (the old link stops working).
10. The upload link after the report is sent: no upload form, "Report received" instead.
11. A booking link for a journey that is waiting for an upload: the upload page, not the slot picker.

### Enrolling a patient
12. Empty name, name of 81 characters, age 17 and 121, age with letters, phone with letters or more than 4 digits.
13. Consent not ticked (also with the form sent without the browser).
14. A name containing script tags or HTML: shown as plain text everywhere.
15. Option 1 with no file and the "patient will upload" box not ticked: refused.
16. Option 1 files: PDF, JPEG, PNG accepted; an empty file, a file over 5 MB, a text file renamed `.pdf`, a broken JPEG: refused with a clear message.
17. Option 2 with and without the ultrasound.

### Booking and rescheduling
18. No open slots: "no times open" message, no crash.
19. Two patients taking the same slot: the second is told it was just taken.
20. A time in the past, a slot at the wrong kind of place, a forged slot id: refused.
21. Pressing Confirm twice: one booking.
22. Hindi and English on every patient page; an unknown `lang` falls back to English.
23. A missed visit with open slots: the patient is sent a suggested time at once; with no open slots: the plain "choose a new time" link.
24. A suggested time that has since been taken: the link opens with nothing preselected.

### Visits, labs and centres
25. Marking a visit attended or missed before its slot: the button is greyed out, and a forged request is refused by the server.
26. Marking missed twice; rescheduling a visit that was not missed.
27. Adding a slot in the past, a duplicate slot, an hour outside 1 to 12; removing a slot that is already booked.
28. The lab page and the FibroScan centre page show their own titles.

### Doctor decisions
29. Approve, then approve again (stale page); decline with each of the four preset reasons; decline with a made-up reason; re-review loop.
30. Each of the three next steps; routine follow-up months at 0, 1, 36 and 37.
31. A closed journey (complete or not approved) refuses further actions.

### Messages and privacy
32. No message ever contains a score, a lab value or clinical text (English and Hindi).
33. Every template exists in both languages.
34. The audit trail never holds clinical values, and every report open is recorded.
35. The patient pages load only logistics (stage, name, place and time).

### Phones, accessibility and security headers
36. Every new page at 360 px wide: no sideways scrolling (home, demo, role sign-in, upload page, phone view).
37. Automated accessibility scan of the new pages in both languages.
38. Security headers on every page; only the patient pages may be framed, and only by this site.
39. The reminder job refuses a missing or wrong secret.

## Live click-through (a person, on the Vercel site)

Use `docs/demo-walkthrough.md` plus these extras:
1. Home page on a phone: reads clearly, no role buttons, "Demo access" opens the list.
2. Each of the five roles signs in with its own page and its own password, and Sign out returns to the home page.
3. Enrol Option 1 with the patient-upload box ticked; open **Patient's phone**; tap the link; upload a photo; the clinician sees the patient.
4. Enrol Option 2; book from the phone view; check the confirmation arrives in the chat.
5. As the lab, try Mark missed before the slot (greyed out, with the time left).
6. Approve FibroScan; follow "See the message on the patient's phone".
7. Anything that looks wrong goes into `testing/issues.md` with a screenshot.

## Exit rule
All automated jobs green on `main`, the live check green after the deploy, and the live click-through done once on a phone before the demo video is recorded.
