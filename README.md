# Liv2care

**Doctor decides → Liv2care coordinates → Patient completes → Doctor sees the outcome.**

An EHR-independent, closed-loop care-coordination platform for liver-risk assessment in people with type 2 diabetes. Built by Team LIVACARE for Health-a-thon 2026.

The software and the AI never diagnose, calculate FIB-4 or any score, or make clinical decisions. Licensed doctors do the clinical work. AI handles logistics only and never sees lab values.

## Status

| Phase | What | State |
|---|---|---|
| 0 | Foundations: Next.js, Tailwind, shadcn/ui, tests, CI | In progress |
| 1 | Data model, login, state machine, seed | Next |
| 2 | Doctor and partner flows | Planned |
| 3 | Booking, AI helper, clinical handoff, next steps | Planned |
| 4 | Operations, reminders, metrics | Planned |
| 5 | Harden and submit | Planned |

The clickable prototype that this app grows out of lives at https://github.com/devesh1905/liv2care-prototype.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres, Auth, Storage) · Gemini API (logistics only) · Vitest · Vercel

## Run it

```bash
npm install
cp .env.example .env.local   # fill in later phases
npm run dev                  # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build on every push and pull request.

## Deploy preview on Vercel

1. In Vercel choose **Add New → Project** and import `devesh1905/liv2care`.
2. Keep the defaults (Framework: Next.js). No environment variables are needed in Phase 0.
3. Every push to a branch then gets a preview URL; `main` is the production URL.

## Supabase (Phase 1)

1. Create a project at supabase.com and copy the project URL and anon key into `.env.local` (and into Vercel's environment variables).
2. The service-role key is server only. Never put it in client code or commit it.
3. Optional local stack: install the Supabase CLI, then `supabase init` and `supabase start`. Migrations will live in `supabase/migrations/`.

## Layout

```
src/app/            pages and API routes
src/components/ui/  shadcn/ui components
src/lib/            shared logic (journey stages today; state machine in Phase 1)
src/styles/         design tokens (colours, status colours, light and dark)
.github/workflows/  CI
```

## Rules for contributors and coding agents

See `CLAUDE.md`. In short: no clinical logic, clinical values never reach the AI layer, every action is audited, fake data only, no secrets in the repo.
