/**
 * [ARCTOS-FULL-2026-08-31 / WP10 · S13-17]
 *
 * Bis zum Audit lief ESLint in genau EINEM von zwölf Workspaces
 * (`apps/web`) — und zwar nicht über `turbo lint`, sondern über einen
 * direkten `npx eslint .` in `ci.yml`. `apps/worker` (132 Dateien) und alle
 * zehn Packages, darunter `packages/auth`, `packages/db` und
 * `packages/shared`, waren vollständig ungelintet, weil sie kein
 * `lint`-Skript definierten und `turbo lint` Workspaces ohne Task
 * stillschweigend überspringt.
 *
 * Diese Datei ist die Basis-Konfiguration für die elf Nicht-Web-Workspaces.
 * `apps/web` behält seine eigene, deutlich strengere Konfiguration
 * (`apps/web/eslint.config.mjs`, WP12) — Flat Config sucht vom gelinteten
 * File aufwärts und findet dort zuerst, deshalb ist `apps/web` hier
 * zusätzlich ignoriert.
 *
 * Severity-Politik: Die Regeln, die echte Defektklassen aus diesem Audit
 * treffen, sind `error`. Regeln, deren Bestand erst abgebaut werden muss,
 * sind `warn` und werden über `scripts/lint-ratchet.mjs` mit einer
 * eingecheckten Obergrenze gedeckelt — die Zahl darf nur sinken. Ein
 * pauschales `off` gibt es nicht.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.d.ts",
      // eigener, strengerer Regelsatz (WP12)
      "apps/web/**",
      // generierte Artefakte
      "SBOM/**",
      "packages/db/drizzle/**",
      "docs/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      "apps/worker/**/*.{ts,tsx,mjs,js}",
      "packages/*/**/*.{ts,tsx,mjs,js}",
      "scripts/**/*.{ts,mjs,js}",
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        Headers: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        queueMicrotask: "readonly",
        structuredClone: "readonly",
        crypto: "readonly",
        performance: "readonly",
        Blob: "readonly",
        File: "readonly",
        FormData: "readonly",
        ReadableStream: "readonly",
        WritableStream: "readonly",
        TransformStream: "readonly",
        globalThis: "readonly",
      },
    },
    rules: {
      // ── Defektklassen aus diesem Audit: hart ─────────────────────────
      // S10-11: 39 leere `catch`-Blöcke haben Fehler stillschweigend
      // verschluckt; genau das ist die Klasse, die S13-04 und S13-23 gross
      // gemacht hat.
      "no-empty": ["error", { allowEmptyCatch: false }],
      // Vergessene `await` sind die Ursache mehrerer "meldet Erfolg, tut
      // nichts"-Findings (S14-02, S10-06).
      "require-atomic-updates": "error",
      "no-unsafe-finally": "error",
      "no-fallthrough": "error",
      "no-self-assign": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      // `eval`/`new Function` — Injection-Fläche (S04).
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      // Ein `console.log` im Worker geht an den Log-Shipper vorbei (S13-15);
      // erlaubt bleiben die Diagnosestufen.
      "no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }],

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/triple-slash-reference": "error",

      // ── Bestand, der abgebaut wird: Ratsche statt `off` ──────────────
      // S14-19 zählt 267 `any` im Repo. Die Regel bleibt aktiv (`warn`) und
      // die Gesamtzahl ist über scripts/lint-ratchet.mjs gedeckelt; sie darf
      // nur sinken. `off` hätte den Bestand unsichtbar gemacht — genau der
      // Zustand, den S14-19 beanstandet.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
    },
  },
  {
    // Testdateien: Fixtures dürfen `any` und leere Funktionen verwenden.
    // `require-atomic-updates` ist hier durchgehend falsch-positiv: Tests
    // setzen `process.env.X` bewusst um einen `await` herum.
    files: [
      "**/tests/**/*.{ts,tsx,mjs,js}",
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
    ],
    // Die `eslint-disable`-Direktiven in den Testdateien wurden gegen die
    // strengere apps/web-Konfiguration geschrieben; hier sind sie ungenutzt.
    // Das ist kein Defekt und soll den Ratschen-Zähler nicht füllen.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
      "require-atomic-updates": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
  {
    files: ["scripts/**/*.{mjs,js}", "**/*.mjs"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // k6-Lastskripte laufen in der k6-Runtime, nicht in Node: `__ENV`,
    // `__VU` und `__ITER` sind dort Laufzeit-Globals.
    files: ["scripts/perf/**/*.js"],
    languageOptions: {
      globals: { __ENV: "readonly", __VU: "readonly", __ITER: "readonly", console: "readonly" },
    },
  },
);
