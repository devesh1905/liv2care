# Rules for coding agents working on Liv2care

Read `AGENTS.md` first (the Next.js version here has breaking changes; check `node_modules/next/dist/docs/` before writing Next.js code).

## What this is
An EHR-independent, closed-loop care-coordination platform for liver-risk assessment in people with type 2 diabetes.
Doctor decides → Liv2care coordinates → Patient completes → Doctor sees the outcome.
The plan and phases are in `build-plan.md`; the pathway and roles are in `roadmap.md` (both live in the Healthathon folder, copies of the key points are in `README.md`).

## Non-negotiable rules
1. **No clinical logic.** Never calculate FIB-4 or any score, never apply thresholds to lab values, never write clinical text. The telemedicine clinician types FIB-4 and the summary by hand.
2. **Clinical values never reach the AI layer.** The only caller of Gemini is `src/lib/logistics/` (Phase 3). It accepts language, area, partner kind, preferences, slot availability and appointment status, and cannot import report or review types.
3. **All stage changes go through `journey.transition()`** (Phase 1). Nothing else writes `journeys.stage`.
4. **Every stage change and report action writes an audit row** (`journey_events`: who, what, when). The audit table is insert-only.
5. **Fake data only.** Seed and tests use invented people. Messages are mocked and shown in the message log.
6. **No secrets in the repo.** Use `.env.local` (git-ignored); keep `.env.example` current.
7. Roles are enforced by database policies (RLS), not by hiding buttons.

## Working style
- One phase at a time; finish its "done when" check before the next.
- Before finishing a task run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`.
- Keep changes small. Prefer the prototype's proven logic (`prototype/index.html` in the prototype repo) over new designs.
- UI: Tailwind plus shadcn/ui, colours from `src/styles/tokens.css`. Check every screen at 360 px wide.
