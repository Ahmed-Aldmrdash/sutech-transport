import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message: "Use Link from @/i18n/navigation so the locale is kept.",
            },
            {
              name: "next/navigation",
              importNames: ["useRouter", "usePathname", "redirect", "permanentRedirect"],
              message: "Use the locale-aware versions from @/i18n/navigation.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "public/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
