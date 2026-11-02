# Design audit (November 2026)

Applies the health-niche guidance from the KnotOS design playbook (calm, minimal motion, 44 px targets, AA contrast,
larger patient text) and checks the site with three audits. Run against a production build on hosted data.

## Tools
| Audit | What it checks | Pages |
|---|---|---|
| Hallmark `sloplint --render --scope app` | "AI-generated" UI tells, contrast floor, field and focus edges, layout at 320–1920 px, type weights | `/`, `/demo`, `/login`, `/demo/doctor`, a booking link, a patient page |
| Impeccable `detect` (URL at 1440 and 390 px, plus `src/`) | 62 rules: contrast, tiny text, line length, skipped headings, glows, eyebrow chips, icon tiles, grid backgrounds | same pages, both widths, and the source |
| `scripts/design-audit.mjs` (Apple HIG and WCAG) | axe WCAG 2.0–2.2 A/AA; every control ≥ 44 × 44 px; field edges ≥ 3:1; no running animation under reduced motion | the pages above plus every signed-in page (doctor, clinician, lab, centre, specialist, operations), 1440 and 390 px: 22 views |

Hallmark and Impeccable cannot sign in, so the signed-in pages are covered by the third script only.

## Score (10 = no findings)
Scoring: Hallmark 10 − 2 per fail − 1 per reflex − 0.5 per warning; Impeccable 10 − 0.5 per warning − 0.25 per advisory;
targets 10 − 0.5 per undersized control; fields 10 × share of pages that pass; motion judged against the playbook's
health budget (feedback only, ≤ 150 ms ideas, nothing looping).

| Area | Before | After | What changed |
|---|---|---|---|
| Hallmark | 1.5 (3 fail, 1 reflex, 3 warn) | **10** (clean) | field edges, 320 px sideways scroll, icon-above-heading tiles, 36 px header buttons, 4 font weights |
| Impeccable | 4.8 (8 warnings, 5 advisories) | **10** (0) | radial glow hero, eyebrow chip, icon tiles, grid background, 4.3:1 hero text, stranded words, long lines |
| Apple HIG: 44 px targets | 5.0 (10 undersized) | **10** (0) | checkbox rows, FIB-4 summary, report links, "Patient's phone", "Use the password instead", Hindi toggle, phone view buttons |
| Field edges ≥ 3:1 | 3.6 (7 of 11 pages fail at 1.31:1) | **10** | `--input` is now `#7d8fa1` (3.3:1 on white, 3.1:1 on the page) |
| WCAG 2.2 AA (axe, serious and critical) | 10 | **10** | no serious findings before or after; no minor ones after either |
| Motion budget (health) | 6 | **10** | splash only on `/` and about 0.7 s (was 1.4 s on every page); no looping hero drift; no pulsing step |
| **Total** | **40.9 / 60** | **60 / 60** | |

## Design changes from the playbook
- **Show vs tool surfaces.** Only the home page has a hero tint, the glass journey card and the dashed pathway line; staff
  and patient pages are plain and open straight away (no splash).
- **Calm hero.** A flat tint with a soft top-to-bottom fade replaces the radial "mesh"; the grid background is gone; the
  team credit moved below the buttons instead of a chip above the headline; icons sit inline with headings.
- **Patient pages** use 17 px body text with a 22 px / 28 px heading scale.
- **Three font weights** (regular, semibold, extrabold): `font-bold` is drawn as semibold.
- **Dark mode removed.** Its palette was never switched on and the hero styles use fixed colours.
- **Feedback in words** was already in place (every action ends in a specific `role="status"` notice); no toast library added.

## Left as is, on purpose
- The browser end-to-end and accessibility tests (`npm run e2e`) need the local Supabase stack; they run in CI.
- Manual checks still worth doing with a person: keyboard-only walk-through and a screen reader on the patient pages.

## Re-run
```bash
npm run build && npm start   # in one terminal
BASE=http://localhost:3000 node scripts/design-audit.mjs out.json
```
Hallmark: `node <hallmark>/skills/hallmark/scripts/sloplint.mjs --url http://localhost:3000/ --scope app` (needs
`puppeteer-core` and Chrome). Impeccable: `npx impeccable detect http://localhost:3000/ --viewport 390x844`.
