import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Electron-builder output bundles a copy of the entire codebase
    // under app-standalone/ — never lint that; live source already covers it.
    "dist-electron/**",
  ]),
  // Electron main + preload run in CommonJS (Node, not bundled by Next).
  // require() is the correct import form; the TS rule doesn't apply here.
  {
    files: ["electron/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // react-hooks/set-state-in-effect (new in eslint-plugin-react-hooks v7)
  // flags canonical "load once on mount" and "reset on prop change" patterns
  // that have no idiomatic replacement yet. Keep as warning so the signal
  // surfaces, but don't block commits until React publishes guidance.
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
