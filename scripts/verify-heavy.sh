#!/usr/bin/env bash
# The heavy checks, in order: start the local stack, rebuild the database, run the database, integration and browser
# tests, take screenshots, then stop the stack. It slows the laptop, so run it when you are not working.
#   npm run verify:heavy
# Everything is logged to verify-heavy.log (git-ignored). Needs Docker Desktop running and .env.local filled in.
set -u
cd "$(dirname "$0")/.."
LOG=verify-heavy.log
: > "$LOG"
FAILED=()

step() {
  local name="$1"; shift
  echo "=== $name" | tee -a "$LOG"
  if "$@" >> "$LOG" 2>&1; then echo "    ok" | tee -a "$LOG"; else echo "    FAILED (see $LOG)" | tee -a "$LOG"; FAILED+=("$name"); fi
}

step "light checks: lint"        npm run lint
step "light checks: typecheck"   npm run typecheck
step "light checks: unit tests"  npm test
step "start local Supabase"      npx supabase start
step "rebuild database + seed"   npx supabase db reset
step "sample report files"       npm run seed:files
step "database tests (pgTAP)"    npm run test:db
step "integration tests"         npm run test:int
step "production build"          npm run build

# the dev server for the browser tests and screenshots
npm run dev >> "$LOG" 2>&1 &
DEV=$!
for _ in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000/api/health && break; sleep 2; done
for u in /login /doctor /clinician /partner /ops; do curl -s -o /dev/null "http://localhost:3000$u"; done

step "browser tests (Playwright)" npm run e2e
step "screenshots"                node scripts/screenshots.mjs screenshots

kill "$DEV" 2>/dev/null
npx supabase stop >> "$LOG" 2>&1

echo
if [ ${#FAILED[@]} -eq 0 ]; then echo "All heavy checks passed."; else echo "Failed: ${FAILED[*]}"; exit 1; fi
