import { defineConfig } from "@playwright/test";

// End-to-end tests drive the real app and the local Supabase stack (`npx supabase start`, demo logins on).
// They use the installed Microsoft Edge so no browser download is needed; set PW_CHANNEL=chrome or leave it empty
// (after `npx playwright install chromium`) on another machine.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: process.env.PW_CHANNEL ?? "msedge",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
