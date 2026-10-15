import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // D-50/D-51: the two products never import each other's code, and shared
  // code never imports either product. Resolved paths, so `@/` and relative
  // imports are both caught.
  {
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./app/portal",
              from: "./app/studio",
              message: "Portal must not import studio code (D-51). Move shared code to components/ or lib/.",
            },
            {
              target: "./app/studio",
              from: "./app/portal",
              message: "Studio must not import portal code (D-51). Move shared code to components/ or lib/.",
            },
            {
              target: ["./components", "./lib"],
              from: ["./app/portal", "./app/studio"],
              message: "Shared code must not depend on a product (D-50). Expose a slot instead.",
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
