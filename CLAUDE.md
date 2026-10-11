# Rules for coding agents working on Liv2care

Read `AGENTS.md` first (the Next.js version here has breaking changes; check `node_modules/next/dist/docs/` before writing Next.js code).

## What this is
An EHR-independent, closed-loop care-coordination platform for liver-risk assessment in people with type 2 diabetes.
Doctor decides → Liv2care coordinates → Patient completes → Doctor sees the outcome.
The plan and phases are in `build-plan.md`; the pathway, roles and progress are in `roadmap.md` (both live in the Healthathon folder, one level up). `README.md` explains how to run and test the app.

## Non-negotiable rules
1. **No clinical logic.** Never calculate FIB-4 or any score, never apply thresholds to lab values, never write clinical text. The telemedicine clinician types FIB-4 and the summary by hand. The clinical text is stored only in `reviews`, never in `journey_events`, logs or messages.
2. **Clinical values never reach the AI layer.** The only caller of Gemini is `src/lib/logistics/`. It accepts language, area, partner kind, preference and slot availability, and ESLint forbids it from importing journey, report, booking, auth, message or database code. Code picks the slot; the model only phrases a reason.
3. **All stage changes go through `journey.transition()`** (`src/lib/journey/transition.ts`). Nothing else writes `journeys.stage`; a database trigger enforces it.
4. **Every stage change and report action writes an audit row** (`journey_events`: who, what, when). The audit table is insert-only. Audit `detail` accepts logistics keys only.
5. **Fake data only.** Seed and tests use invented people. Messages are mocked and shown in the message log.
6. **No secrets in the repo.** Use `.env.local` (git-ignored); keep `.env.example` current. Never print or paste keys, passwords or tokens.
7. Roles are enforced by database policies (RLS), not by hiding buttons. The service-role client is for `transition()`, `start_journey`, the mock message sender and booking-link functions only.

## Working style
- One phase at a time; finish its "done when" check before the next.
- Before finishing a task run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. For database or flow changes also run `npm run test:db`, `npm run test:int` and `npm run e2e` (they need the local Supabase stack).
- Supabase work (link, db push) is done with `npx supabase` from this folder, never through an MCP connector. Do a `--dry-run` before `db push`. Never load `supabase/seed.sql` on a hosted project.
- Keep changes small. Prefer the prototype's proven logic (`prototype/index.html` in the prototype repo) over new designs.
- UI: Tailwind plus the shared components in `src/components`, colours from `src/styles/tokens.css`. Check every screen at 360 px wide (`node scripts/screenshots.mjs`).

## Gotchas learned the hard way
- **Server Functions must call `revalidatePath` first**, even when they end in an error, or Next 16.4 fails to re-render the layout (an InvariantError about the cookies store). Redirect to the page with a `?notice=` banner when the card the user clicked will disappear.
- **Cache Components is on.** Anything that reads cookies or the database must sit inside `<Suspense>`; `createClient()` calls `connection()` to keep `Date.now()` out of prerendering.
- **Database changes are new migration files.** Replacing a Postgres function with a different argument list needs a `drop function` first. The Supabase CLI's statement splitter chokes on `case … end` inside plpgsql: use `if/elsif`.
- **Models are bad at picking the earliest of many times.** Keep selection in code (`src/lib/logistics/localSuggest.ts`).
- Model names retire: `gemini-2.5-*` reject new keys. Check the live test (`npm run test:int` with a key) after changing `GEMINI_MODEL`.
- Local sign-in is rate limited in Supabase; `supabase/config.toml` raises it to 300 per 5 minutes for test runs.
- In the shell, avoid very long heredocs with mixed quotes; write files with the editor tools.
