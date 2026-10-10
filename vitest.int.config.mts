import { defineConfig } from "vitest/config";

// Integration tests run against the local Supabase stack (`npx supabase start`).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
