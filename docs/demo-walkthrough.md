# Three-minute demo walkthrough

A click path through the whole pathway, for a reviewer or for rehearsing the demo. Kanya's demo script will replace the wording; this is the route and what to point out.

You need the five demo passwords from the team. Open the home page, choose **Demo access**, then pick a role: each has its own sign-in page, where you type that role's password. Everything is pretend: patients, messages and reports.

Tip: the sample patients (P-1001 to P-1006) are already at different points of the journey, so you can skip waiting. Use a new patient for the first half and the samples for the rest.

| Time | Who | Do this | Point out |
|---|---|---|---|
| 0:00 | Home page | Read the one-line idea and the doctor and patient sections, click **Demo access**, then **Treating doctor** | Doctor decides, Liv2care coordinates, the patient completes, the doctor sees the outcome. The software never diagnoses. |
| 0:20 | Doctor | **Identify a patient**: name, age, tick consent, choose **Option 2: order the tests**, **Enrol patient** | Two ways in: use a report the patient already has, or order the tests. Consent is required. |
| 0:40 | Patient (in the simulated phone) | Click **Open the patient's phone**. Tap the link in the first message: the booking page opens inside the phone. Tap **Nearest**, then **Confirm booking**. Switch to **हिन्दी** | No account or app. One link in a text message. The helper suggests a place and time; the choice is made by code and the AI only words the reason. Hindi throughout. |
| 1:00 | Lab | Sign out, sign in as **Lab**. Upload any small PDF for the new patient | Labs see only their own visits. Uploading moves the journey forward and puts the report in the clinician's queue. |
| 1:15 | Clinician | Sign in as **Telemedicine clinician**. Open the report, work out FIB-4 with the calculator (or type it), add a short summary, **Send** | The calculator shows the number only; the clinician checks it and decides. No thresholds, no interpretation. Opening the report is audited. |
| 1:35 | Doctor | Sign in again. The patient shows under **Needs your decision**. Read the note, then **Approve FibroScan** | The doctor sees the clinician's note with the original report, and decides. They can also decline with a preset reason or ask for a re-review. |
| 1:50 | Doctor | On sample patient **P-1006**, choose **Routine follow-up, 12 months**, **Record next step** | Three next steps: routine follow-up, further evaluation, specialist referral. Each is booked and tracked. |
| 2:05 | FibroScan centre | Sign in as **FibroScan centre**. On sample patient **P-1003** (FibroScan booked), **Mark missed** | A missed visit is caught the same day. |
| 2:15 | Operations | Sign in as **Operations**. Show the pending actions, the overdue flag and **Send reminder** | Nothing waits without an owner. Overdue actions are flagged and the patient is reminded. |
| 2:30 | Operations | On **P-1003**, who is now missed, **Suggest a new time**, then **Send offer to the patient** | The AI-assisted reschedule. The patient confirms from a link; nothing is booked until they do. |
| 2:45 | Operations | Scroll to the **audit trail**, the **message log** and the headline numbers | Every step is recorded: who, what, when. Messages are simulated and private links are shortened. The numbers are the pilot's measures: completion, booking, missed visits, report turnaround. |
| 3:00 | Close | Back to the home page | Built so the software never practises medicine. See `docs/security-and-privacy.md`. |

## Two more things to show
- **Option 1, the patient sends the report.** On the enrol form choose **Option 1**, tick *The patient will upload the report*, and enrol. In **Patient's phone** the message carries a link; open it, choose a PDF or a photo of a report, and send. The journey moves to the clinician's queue.
- **A missed visit.** When a visit is marked missed, the patient is sent a suggested new time straight away (and the phone shows it), with nothing to press. The patient confirms from the link.

## If something goes wrong
- A sign-in panel says "Wrong email or password": the password for that role is not the one the team set.
- A page looks empty: the sample patients may not be loaded on this site; ask the team to run `supabase/hosted-demo-data.sql`.
- "Open report" says the file is not available: sample reports have no PDF file; reports you upload yourself open normally.
- The booking page says the link has expired: ask for a new one (a new text replaces the old link).
