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
    // [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-152] Ein `console.log` geht am
    // Field-Scrubbing des Log-Shippers vorbei (S13-15). Die `allow`-Liste ist
    // der Grund, warum die Ratsche hier nur 23 Befunde sah, wo 88
    // `console.*`-Aufrufe standen: `warn`, `error`, `info` und `debug` waren
    // ausgenommen — also gerade die Stufen, auf denen ein Fehlerobjekt
    // ausgegeben wird.
    //
    // Dieser nachsichtige Satz steht bewusst in einem EIGENEN Objekt mit
    // `ignores`, statt im Basisblock: Flat Config behaelt die OPTIONEN eines
    // frueheren Blocks bei, wenn ein spaeterer nur die Schwere setzt. Stand
    // die `allow`-Liste im Basisblock, liesse sich sie weiter unten gar nicht
    // mehr loswerden — `"no-console": ["error", { allow: [] }]` ist kein
    // Ausweg, denn das ESLint-Schema verlangt fuer `allow` mindestens einen
    // Eintrag (`Value [] should NOT have fewer than 1 items`). Aufgefallen ist
    // beides dem Tor-Test selbst
    // (`apps/worker/tests/lib/no-console-gate.test.ts`).
    //
    // Fuer `apps/worker/src/**` gilt dieses Objekt deshalb nicht; dort greift
    // weiter unten `"no-console": "error"` ohne geerbte Ausnahmen. Fuer
    // `packages/**` steht die Nachsicht noch, weil dort ein Restbestand
    // liegt, den dieser Strang nicht abgetragen hat.
    ignores: ["apps/worker/src/**/*.ts", "apps/worker/src/**/*.tsx"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }],
    },
  },
  {
    // Testdateien: Fixtures dürfen `any` und leere Funktionen verwenden.
    // `require-atomic-updates` ist hier durchgehend falsch-positiv: Tests
    // setzen `process.env.X` bewusst um einen `await` herum.
    files: [
      "**/tests/**/*.{ts,tsx,mjs,js}",
      // `packages/bpmn` legt seine Tests unter `test/` ab, nicht `tests/`.
      // Ohne dieses Muster fielen 3.400 Zeilen Prüfstand unter den
      // Produktivregelsatz — aufgefallen an `no-console` in
      // `test/model/measure-roundtrip.ts`, einem Messwerkzeug, dessen
      // Ausgabe der Bericht ist.
      "**/test/**/*.{ts,tsx,mjs,js}",
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
    // Einmalläufer auf der Kommandozeile: ihre Ausgabe **ist** die
    // Schnittstelle.
    //
    // [ARCTOS-FULL-2026-08-31 · OP-064] Die Begründung der Regel oben nennt
    // ausdrücklich den Worker: dort geht `console.log` am Log-Shipper vorbei
    // (S13-15). Ein Seed, den ein Betreiber mit `npm run db:seed` startet und
    // dessen letzte Zeilen die zu exportierenden Variablen nennen, hat keinen
    // Log-Shipper, an dem er vorbeigehen könnte. Ihn auf den strukturierten
    // Logger umzustellen hiesse, die Ausgabe an ein Ziel zu schicken, an dem
    // der Mensch vor dem Terminal sie nicht sieht.
    //
    // Der Geltungsbereich ist deshalb genau auf diese Dateien beschränkt und
    // nicht auf `packages/db/**`: alles andere in dem Paket läuft im
    // Serverprozess und bleibt unter der Regel. `scripts/**` ist hier auf
    // `.ts` erweitert — dass `coverage-aggregate.ts` bisher unter die Regel
    // fiel und `coverage-aggregate.mjs` nicht, war eine Lücke der Endung,
    // keine Aussage.
    files: [
      "scripts/**/*.{mjs,js,ts}",
      "**/*.mjs",
      "packages/db/src/seed.ts",
      "packages/db/src/seed-*.ts",
      "packages/db/src/seeds/**/*.ts",
      "packages/db/src/migrate-all.ts",
      "packages/db/src/migrate-all-report.ts",
      "packages/db/src/create-admin.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },
  {
    // ── Das Tor zu OP-152 ────────────────────────────────────────────────
    //
    // [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-152]
    //
    // `apps/worker/src` hatte 85 `console.*`-Aufrufe. Sie gingen roh auf
    // stdout/stderr — ohne Field-Scrubbing, obwohl ADR-017 das Scrubbing zur
    // Voraussetzung für externes Log-Shipping macht. Alle 85 sind auf
    // `apps/worker/src/lib/logger.ts` umgestellt.
    //
    // Ohne Tor hält das nicht: die nächste Kopiervorlage bringt den nächsten
    // `console.error(err)` zurück. Deshalb hier `error` OHNE `allow`-Liste —
    // die alte Liste nahm `warn`/`error`/`info`/`debug` aus und liess damit
    // 65 der 88 Aufrufe unsichtbar durch die Ratsche.
    //
    // Der Geltungsbereich ist genau `src/`: `apps/worker/tests/**` bleibt
    // ausgenommen (Testcode, weiter oben geregelt), und
    // `tests/require-db.mjs` ist ein Einmalläufer, dessen Ausgabe der
    // Betreiber vor `npm test` liest — dort gibt es keinen Log-Empfänger, an
    // dem etwas vorbeigehen könnte.
    //
    // Der einzige zulässige Ausgang für eine fertige, bereits gescrubbte
    // Zeile ist `writeLine()` in `packages/shared/src/logger.ts`; er trägt
    // dort eine benannte `eslint-disable`-Direktive.
    files: ["apps/worker/src/**/*.{ts,tsx}"],
    rules: {
      // Ohne geerbte `allow`-Liste: Der nachsichtige Satz weiter oben nimmt
      // `apps/worker/src/**` ausdruecklich aus, deshalb genuegt hier die
      // Schwere. Stuende die Nachsicht im Basisblock, behielte Flat Config
      // ihre OPTIONEN bei und `console.error(err)` waere im Worker weiter
      // erlaubt — also genau die Form, um die es bei OP-152 geht.
      "no-console": "error",
    },
  },
  {
    // k6-Lastskripte laufen in der k6-Runtime, nicht in Node: `__ENV`,
    // `__VU` und `__ITER` sind dort Laufzeit-Globals.
    files: ["scripts/perf/**/*.js"],
    languageOptions: {
      globals: {
        __ENV: "readonly",
        __VU: "readonly",
        __ITER: "readonly",
        console: "readonly",
      },
    },
  },
);
