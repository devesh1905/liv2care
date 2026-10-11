# Liv2care

**Doctor decides → Liv2care coordinates → Patient completes → Doctor sees the outcome.**

An EHR-independent, closed-loop care-coordination platform for liver-risk assessment in people with type 2 diabetes. Built by Team LIVACARE for Health-a-thon 2026.

The software and the AI never diagnose, calculate FIB-4 or any score, or make clinical decisions. Licensed doctors do the clinical work. AI handles logistics only and never sees lab values. Demo build: fake patients and simulated messages only.

## What works today

| Who | Where | What they can do |
|---|---|---|
| Treating doctor | `/doctor` | Enrol a patient with consent (Option 1: upload an existing lab report, Option 2: order the preset tests). Approve or decline FibroScan (preset reasons), ask for a re-review, pick the next step (routine follow-up, further evaluation, specialist referral), mark follow-up visits attended. |
| Telemedicine clinician | `/clinician` | Open the original report through a signed link, type FIB-4 and the summary by hand, send both to the doctor. |
| Lab and diagnostic centre | `/partner` | Manage slots, upload reports, mark visits missed or attended. |
| Patient | `/book/[token]`, `/patient/[token]` | Book a lab, centre or follow-up from a link (English or Hindi, with a booking helper), reschedule after a miss, and see their progress. No account or app. |
| Operations | `/ops` | See what is waiting on whom, spot overdue actions, send reminders (one patient or everyone overdue), suggest and send a new time to a patient who missed a visit, read the audit trail and the message log, and see the headline numbers (completion, lab and FibroScan booking, missed visits, report turnaround). |

Progress against the plan is tracked in `roadmap.md` and `build-plan.md` (kept in the Healthathon folder, outside this repo). The clickable prototype this app grows out of is at https://github.com/devesh1905/liv2care-prototype.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) · Gemini API for logistics wording only · Vitest · Playwright · Vercel

## Run it locally

You need Node 22+, Docker Desktop and Git. The local database runs in Docker.

```bash
npm install
npx supabase start               # local Postgres, Auth, Storage (first run downloads images)
cp .env.example .env.local       # then fill in the values `supabase start` printed
npm run seed:files               # sample PDFs for the seeded reports (after every db reset)
npm run dev                      # http://localhost:3000
```

In `.env.local`, set `DEMO_LOGINS=on` to get one-click demo accounts on `/login` (fake data; the shared demo password lives in `supabase/seed.sql` and must never be used on a public project). `npx supabase db reset` rebuilds the database and reloads the seed (six fake patients, one login per role). Stop the stack with `npx supabase stop`.

Local ports are 545xx (not Supabase's defaults) so this project can run beside others.

## Commands

| Command | What it does | Needs |
|---|---|---|
| `npm run dev` / `build` | Dev server, production build | |
| `npm run lint` / `typecheck` | ESLint, TypeScript | |
| `npm test` | Unit tests | |
| `npm run test:db` | Database tests: RLS, transitions, audit rules (pgTAP) | Local Supabase |
| `npm run test:int` | Integration tests on the real database, plus one live Gemini call when a key is set | Local Supabase |
| `npm run e2e` | Browser tests through the real screens (Playwright, uses Microsoft Edge) | Local Supabase, demo logins on |
| `node scripts/screenshots.mjs <folder>` | Screenshots of every screen at 360 px and 1280 px | App running |
| `npx supabase db reset` | Rebuild the local database and reseed | Local Supabase |

CI (`.github/workflows/ci.yml`) runs on every push and pull request in three jobs on GitHub's servers: `check` (lint, typecheck, unit tests, build), `database` (starts Supabase, runs the database and integration tests) and `e2e` (starts Supabase and the app, runs the browser tests in Chrome). Heavy checks are meant to run there, not on a laptop: open a pull request and let CI do the work.

## Hosted setup (Vercel and Supabase)

1. Link the repo to the hosted project and apply migrations, from this folder: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push --dry-run`, then `npx supabase db push`.
2. Never load `supabase/seed.sql` on a hosted project. Create the five staff users in the Supabase dashboard (Authentication → Users, auto-confirm, your own strong passwords), turn off public sign-ups, then run `supabase/hosted-setup.sql` in the SQL editor to add partners, slots and roles.
3. In Vercel set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (the public site address, used in booking links) and optionally `GEMINI_API_KEY`. Leave `DEMO_LOGINS` unset. To switch on the daily overdue-reminder job (`vercel.json`), set `CRON_SECRET` to a long random value; without it the job answers 503. Redeploy after changing variables.

## The booking helper (Gemini)

Code picks the slot (nearest place, earliest time, or earliest morning). Gemini only writes one friendly sentence in English or Hindi from that slot's facts, and its reply is rejected unless it is short, in the right script and uses only numbers from the facts. With no key, or on any failure, a plain translated reason is shown. The default model is the free Gemma 4 26B (`GEMINI_MODEL` overrides it). On the free tier Google may use prompts to improve its products; ours hold only invented slot logistics, but use a paid Flash-Lite model for a real pilot. Calls are capped per day and per link.

## Layout

```
src/app/                 pages, server actions and route handlers
src/components/          shared UI (ui/ holds the primitives)
src/lib/journey/         state machine, transition(), timeline, derived status
src/lib/booking/         booking links, slot options, booking and progress views
src/lib/logistics/       the only code allowed to call Gemini (lint-enforced isolation)
src/lib/messages/        mocked message provider and templates
src/lib/i18n/            patient strings in English and Hindi
supabase/migrations/     schema, RLS, transition functions, storage
supabase/tests/database/ pgTAP tests
e2e/                     Playwright tests
scripts/                 screenshots and sample report files
```

## Security and privacy

The plain-language summary for reviewers is in [docs/security-and-privacy.md](docs/security-and-privacy.md). A three-minute walk through the demo is in [docs/demo-walkthrough.md](docs/demo-walkthrough.md). To check a deployed site without any password: `node scripts/check-live.mjs <folder> <site-url>`.

## Rules for contributors and coding agents

See `CLAUDE.md`. In short: no clinical logic, clinical values never reach the AI layer, every stage change goes through `journey.transition()` and is audited, fake data only, no secrets in the repo.
