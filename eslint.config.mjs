import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // AI isolation: the logistics layer is the only caller of Gemini, so it must not be able to reach clinical data.
  {
    files: ["src/lib/logistics/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/journey",
                "@/lib/journey/*",
                "@/lib/reports",
                "@/lib/reports/*",
                "@/lib/auth",
                "@/lib/auth/*",
                "@/lib/booking",
                "@/lib/booking/*",
                "@/lib/messages",
                "@/lib/messages/*",
                "@/lib/supabase",
                "@/lib/supabase/*",
                "@supabase/*",
                "**/journey",
                "**/journey/*",
                "**/reports",
                "**/reports/*",
                "**/booking",
                "**/booking/*",
                "**/supabase",
                "**/supabase/*",
              ],
              message: "src/lib/logistics must not import journey, report, booking or database code. Clinical values never reach the AI layer.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
