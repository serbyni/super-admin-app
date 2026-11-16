import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Data access layer: Supabase is only used inside src/lib/data (and the client factories).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/data/**", "src/lib/supabase/**", "src/proxy.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/*", "!@/lib/supabase/database.types"],
              message: "Use the modules in src/lib/data instead of creating Supabase clients.",
            },
            {
              group: ["@supabase/ssr"],
              message: "Use the modules in src/lib/data instead of creating Supabase clients.",
            },
            {
              group: ["@supabase/supabase-js"],
              allowTypeImports: true,
              message: "Only type imports here; data calls belong in src/lib/data.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='rpc']",
          message: "Call a function from src/lib/data instead of .rpc().",
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
