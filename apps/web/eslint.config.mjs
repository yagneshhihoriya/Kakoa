import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactPlugin from "eslint-plugin-react";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

/**
 * Flat ESLint config for the storefront + admin app: JS/TS recommended +
 * React Hooks rules + Next.js core-web-vitals. Type-aware rules are intentionally
 * off (fast, no project service) — correctness is covered by `tsc --noEmit`.
 */
export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "eslint.config.mjs",
      "public/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
      react: reactPlugin,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Allow deliberate empty catch blocks (best-effort side effects).
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
);
