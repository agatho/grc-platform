/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S12-21, S14-09…S14-13, S14-19]
 *
 * What changed and why:
 *
 *  - `eslint-config-next` was declared in `package.json` but never imported
 *    (S12-21). Every React and Next rule was therefore inert — including
 *    `react/jsx-no-script-url`, which would have caught S12-06 and S12-12 on
 *    the day they were written. It is loaded here, and the three
 *    security-relevant React rules are raised to `error` explicitly rather
 *    than left at the preset's default severity.
 *  - `eslint-plugin-jsx-a11y` was not configured at all (S14-19 / G4), so the
 *    systematic accessibility defects S14-09…S14-13 had no lint instance. The
 *    recommended rule set is enabled. NOTE: the plugin object itself is
 *    registered by `eslint-config-next`, so only its RULES are spread in —
 *    registering a plugin twice is a hard error in flat config.
 *  - `@typescript-eslint/no-explicit-any` was `"off"` while `CLAUDE.md:338`
 *    and Critical Rule 6 forbid `any` outright (S14-19). It is an error now.
 *  - `@typescript-eslint/no-unused-vars` was `"off"`; 1.127 dead bindings had
 *    accumulated behind it. On, with the conventional `^_` opt-out.
 *  - `react-hooks/rules-of-hooks` was `"warn"`, so a genuine hook-order bug
 *    did not fail CI. Now `error`.
 *
 * Deliberate residual exceptions are grouped at the bottom, each with its
 * reason and, where the debt belongs to another remediation package, its
 * owner. No blanket `"off"` is left in this file.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import next from "eslint-config-next/core-web-vitals";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...(Array.isArray(next) ? next : [next]),
  {
    // Rules only — see the note above about double plugin registration.
    rules: { ...jsxA11y.flatConfigs.recommended.rules },
  },
  {
    rules: {
      // ── TypeScript strictness (S14-19) ──────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
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
      "@typescript-eslint/no-empty-object-type": [
        "error",
        // `interface InputProps extends React.InputHTMLAttributes<…> {}` is
        // the idiomatic way to name a prop type — the rule's own escape hatch.
        { allowInterfaces: "with-single-extends" },
      ],
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/triple-slash-reference": "error",

      // ── React / Next security rules (S12-21) ────────────────────────
      // Each of these maps to a finding in this audit.
      "react/jsx-no-script-url": "error", // S12-06, S12-12
      "react/no-danger": "error", //          S12-20 — `customCss` must never be
      //                                      wired up via dangerouslySetInnerHTML
      "react/jsx-no-target-blank": [
        "error",
        { enforceDynamicLinks: "always", allowReferrer: false },
      ],
      "react-hooks/rules-of-hooks": "error",

      // The wrapping-label pattern — `<label><input/><div><span>Text</span>
      // </div></label>` — is a valid HTML association, but the rule's default
      // `depth: 2` cannot see the text through the extra wrapper and reports
      // "A form label must have accessible text". Raising the depth to 3
      // recognises the pattern; it does not weaken the check, because nesting
      // at any depth is a real `for`-less association in HTML.
      "jsx-a11y/label-has-associated-control": [
        "error",
        { assert: "either", depth: 3 },
      ],

      // ── Architecture guards for the POSITIVE findings ───────────────
      // S12-01 and S12-02 are positive findings that each rest on a single
      // property with no test behind it. These turn both into enforced
      // invariants instead of facts that merely happen to hold today.
      "no-restricted-syntax": [
        "error",
        {
          // S12-01: the app has no Server Actions, which is why `middleware.ts`
          // really does see every server entry point. The first `"use server"`
          // would create an endpoint that bypasses withAuth/requireModule.
          selector: "ExpressionStatement > Literal[value='use server']",
          message:
            "S12-01: ARCTOS deliberately has no Server Actions — every server entry point is a route handler, so middleware.ts and withAuth() see it. Introducing one needs an ADR first.",
        },
        {
          // S12-02: `force-dynamic` in the root layout is what keeps tenant
          // data out of the Full Route Cache. Re-enabling ISR or the data
          // cache on any segment reintroduces a cross-tenant leak.
          selector:
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name='revalidate']",
          message:
            "S12-02: `export const revalidate` reintroduces caching of tenant-scoped renders; the root layout sets `force-dynamic` on purpose.",
        },
        {
          selector:
            "CallExpression[callee.name='unstable_cache'], CallExpression[callee.name='revalidateTag'], CallExpression[callee.name='revalidatePath']",
          message:
            "S12-02: the Next.js data cache is not tenant-aware here. Use the request-scoped DB context instead.",
        },
      ],

      "no-empty": "error",
      "no-extra-boolean-cast": "error",
      "prefer-const": "error",
    },
  },

  // ── Das Tor zu OP-152: kein `console.*` auf den Serverpfaden ──────────
  //
  // [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-152]
  //
  // Bis Welle 4b kannte diese Konfiguration `no-console` ueberhaupt nicht —
  // fuer den groessten Workspace des Repositories gab es zu dieser
  // Defektklasse gar keine Regel, auch keine als `warn`. Die Lint-Ratsche
  // zaehlte `apps/web` ausserdem nicht, also war der Bestand auch nicht
  // gedeckelt.
  //
  // [Welle 4b-5 · OP-173] Der zweite Halbsatz gilt nicht mehr: seit Welle
  // 4b-5 fuehrt `.eslint-ratchet.json` einen eigenen Bereich `apps/web`
  // (gemessen mit `cwd: apps/web`, also gegen GENAU DIESE Datei), und sein
  // Bestand steht bei 0. Jeder neue Befund — Fehler wie Warnung — laesst
  // `scripts/lint-ratchet.mjs` fallen.
  //
  // Der Geltungsbereich ist bewusst genau der SERVERSEITIGE Code, denn nur
  // dort trifft die Begruendung aus ADR-017 zu:
  //
  //   * `src/lib/**`      — Node- und Edge-Laufzeit, schreibt in den
  //                         Prozess-Log-Strom, der an den Log-Empfaenger
  //                         geht. Alle zehn Aufrufe sind umgestellt.
  //   * `src/auth.ts`, `src/middleware.ts`, `src/app/api/auth/**`,
  //     `src/app/api/health/**` — dieselbe Laufzeit, heute schon frei von
  //     `console.*`. Die Regel haelt sie frei.
  //   * `src/app/api/v1/**` — seit Welle 4b, Strang 3 IM Geltungsbereich.
  //     Die 53 Aufrufe dieses Verzeichnisses sind auf `@/lib/logger`
  //     umgestellt; siehe docs/UMSETZUNG-WELLE-4B-3.md §2.
  //
  // NICHT im Geltungsbereich, jeweils mit Grund:
  //
  //   * `"use client"`-Komponenten (26 Aufrufe in 24 Seiten, `src/hooks`,
  //     `src/components`) — sie laufen im BROWSER des Nutzers. Dort gibt es
  //     weder `process.stdout` noch einen Log-Empfaenger, an dem etwas
  //     vorbeigehen koennte; der Kopfkommentar des Loggers sagt seit WP10
  //     ausdruecklich, dass Browsercode bei `console.*` bleibt. Sie unter
  //     diese Regel zu nehmen hiesse, eine ANDERE Frage (Konsolenrauschen
  //     im Browser) unter der Nummer von OP-152 zu beantworten.
  {
    files: [
      "src/lib/**/*.{ts,tsx}",
      "src/auth.ts",
      "src/middleware.ts",
      "src/app/api/auth/**/*.{ts,tsx}",
      "src/app/api/health/**/*.{ts,tsx}",
      // [Welle 4b · Strang 3] 1.375 Routendateien, 53 Aufrufe umgestellt.
      "src/app/api/v1/**/*.{ts,tsx}",
    ],
    // Ohne Optionen: Diese Konfiguration kannte `no-console` bis Welle 4b
    // gar nicht, es gibt also keine `allow`-Liste aus einem frueheren Block,
    // die geerbt werden koennte. (`{ allow: [] }` waere ohnehin kein
    // Ausweg — das ESLint-Schema verlangt fuer `allow` mindestens einen
    // Eintrag.) Kommt spaeter ein nachsichtiger Block hinzu, gehoert er wie
    // in der Wurzelkonfiguration in ein eigenes Objekt mit `ignores`, nicht
    // vor diesen hier.
    rules: { "no-console": "error" },
  },

  // ── Deliberate exceptions ─────────────────────────────────────────────
  //
  // [ARCTOS-FULL-2026-08-31 / Welle 7a · OP-080]
  //
  // Hier standen bis Welle 7a ACHT abgeschaltete Regeln mit EINER gemeinsamen
  // Begründung: eine Umstellung sei „eine Verhaltensänderung in 18/19 Seiten,
  // die dieses Paket ohne die E2E-Suite nicht verifizieren kann".
  //
  // Beide Hälften dieser Begründung sind gemessen und beide waren falsch:
  //
  //   * Die E2E-Suite läuft (OP-204, Welle 6c). Sie war nie durch den
  //     Produktionsbau blockiert; `playwright.config.ts` startet ausserhalb
  //     von CI `npm run dev`.
  //   * Die ZAHLEN stimmten nicht, und die BESCHREIBUNG der Fundstellen
  //     stimmte nicht. Gemessen am 2026-09-08 gegen genau diese
  //     Konfiguration (`npx eslint . -f json --rule '{…:"error"}'`,
  //     2.290 Dateien):
  //
  //       Regel                            notiert   gemessen   heute
  //       ──────────────────────────────── ───────── ────────── ──────
  //       react-hooks/exhaustive-deps      23        37         0  AN
  //       react-hooks/set-state-in-effect  19        20         0  AN
  //       react-hooks/purity                8         8         0  AN
  //       react-hooks/static-components     3         3         0  AN
  //       react-hooks/immutability          2         3         0  AN
  //       react-hooks/incompatible-library  2         2         2  aus
  //       react-hooks/preserve-manual-mem.  1         1         0  AN
  //       react-hooks/refs                  1         2         0  AN
  //       ──────────────────────────────── ───────── ────────── ──────
  //       Summe                            59        76         2
  //
  //     Vier der acht Zahlen waren zu niedrig; `exhaustive-deps` um 14.
  //
  // [Welle 7b · OP-080] Die Spalte „heute" ist fortgeschrieben: sieben von
  // acht Regeln sind AN. `set-state-in-effect` ist von 20 auf 0 gefallen —
  // nachgemessen mit derselben Zeile, 2.293 Dateien. Uebrig bleibt EINE Regel,
  // `incompatible-library`, und ihre Begruendung lautet nicht „noch nicht
  // getan", sondern „von hier aus nicht behebbar".
  //
  // Sieben Regeln sind damit AN (sechs seit Welle 7a, `set-state-in-effect`
  // seit Welle 7b), und keine davon war eine Stilfrage — die
  // Befunde und ihre Nachweise stehen in `docs/UMSETZUNG-WELLE-7A.md`. Die
  // Trennung „eine Regel je Eintrag" bleibt aus demselben Grund erhalten wie
  // vorher: damit eine andere Art von Meldung nicht mitgeschwiegen wird.
  {
    rules: {
      // ── Was jetzt AN ist ────────────────────────────────────────────
      //
      // Diese sieben stehen NICHT hier — sie stehen nirgends mehr in dieser
      // Datei, gelten also wie jede andere Regel des Regelwerks:
      //
      //   react-hooks/exhaustive-deps          37 → 0
      //   react-hooks/purity                    8 → 0
      //   react-hooks/static-components         3 → 0
      //   react-hooks/immutability              3 → 0
      //   react-hooks/refs                      2 → 0
      //   react-hooks/preserve-manual-memoization 1 → 0
      //   react-hooks/set-state-in-effect      20 → 0   [Welle 7b]
      //
      // ── Was aus bleibt, mit gemessener Zahl und Grund ───────────────

      // [Welle 7b · OP-080] `react-hooks/set-state-in-effect` steht seit dieser
      // Welle NICHT mehr hier — sie gilt wie jede andere Regel des Regelwerks.
      //
      // Gemessen 2026-09-08 gegen genau diese Konfiguration: 20 Fundstellen
      // vorher, 0 nachher, 2.293 Dateien. Kein `eslint-disable` an keiner
      // Fundstelle.
      //
      // Die alte Begruendung sagte: „every one of them is the same shape: a
      // `useEffect` that fetches on mount", und die Aufloesung sei
      // `@tanstack/react-query`. Welle 7a hat nachgezaehlt, dass das fuer NEUN
      // von zwanzig gilt. Welle 7b hat jede Fundstelle einzeln nachgesehen und
      // kommt auf eine noch andere Aufteilung — die Gestalt „Browserspeicher"
      // war zu gross gefasst:
      //
      //   A  Abruf beim Einhaengen             9  → @tanstack/react-query
      //   B  Formular beim Oeffnen zuruecksetzen 4 → Einhaengen statt Effekt
      //   C  Browserspeicher beim Einhaengen    2  → useSyncExternalStore
      //   C' gespiegelter Serverzustand         2  → beim Rendern ableiten
      //   D  Anhydrier-Wachtposten              1  → useSyncExternalStore
      //   D' Uebergang einer Eigenschaft        1  → Anpassung beim Rendern
      //   E  abgeleiteter Anzeigezustand        1  → beim Rendern ableiten
      //
      // Welle 7a hatte C mit 5 und D mit 2 gefuehrt; zwei der fuenf
      // C-Fundstellen (`use-nav-preferences`) lesen keinen Browserspeicher,
      // sondern spiegeln ein react-query-Ergebnis, und eine der beiden
      // C-Fundstellen in `use-tab-navigation` war ein abgeleiteter
      // Anzeigezustand. Einzelheiten und die Belege in
      // `docs/UMSETZUNG-WELLE-7B.md`.

      // 2 Fundstellen, gemessen 2026-09-08 — und beide sind DIESELBE
      // Tatsache über eine fremde Bibliothek, nicht über diesen Code:
      //
      //   audit-log/page.tsx:1321   useReactTable(...)
      //   components/ui/data-table.tsx:68   useReactTable(...)
      //
      // Der volle Meldungstext: „TanStack Table's `useReactTable()` API
      // returns functions that cannot be memoized safely" — und die Meldung
      // ist ausdrücklich eine MITTEILUNG („Compilation Skipped"), kein
      // Defekt an der Fundstelle: der Compiler verzichtet dort auf die
      // Optimierung. Es gibt keine Behebung ausser dem Verzicht auf
      // `@tanstack/react-table`, und das ist keine Frage, die eine
      // Lint-Regel entscheidet. Anders als bei den sechs eingeschalteten
      // Regeln steht hier also nicht „noch nicht getan", sondern „von hier
      // aus nicht behebbar".
      // [Welle 8e · OP-080] Bis hierher stand die Regel global auf `off`.
      // Das ist eine Aussage ueber ZWEI Dateien, aber sie galt fuer 2.298 —
      // eine dritte `useReactTable`-Stelle waere stillschweigend
      // dazugekommen, und die Begruendung „von hier aus nicht behebbar"
      // haette sie mitgedeckt, ohne dass jemand sie je gelesen haette. Genau
      // diese Form — eine wahre Begruendung, die mehr abdeckt als das, was
      // sie begruendet — ist in diesem Audit mehrfach die Ursache gewesen.
      //
      // Sie steht deshalb jetzt AUF ERROR, und `off` gilt nur noch fuer die
      // zwei benannten Dateien (Block unten). Kommt eine dritte hinzu, faellt
      // der Lint-Lauf und die Entscheidung wird bewusst getroffen statt
      // geerbt. Entscheidung und Alternativen:
      // docs/ADR-028-tanstack-table-und-react-compiler.md.
      "react-hooks/incompatible-library": "error",
      // `react-hooks/rules-of-hooks` — die Regel, die einen echten Fehler in
      // der Hook-Reihenfolge findet — ist oben ERROR.
    },
  },
  {
    // [Welle 8e · OP-080] Die zwei — und nur die zwei — Dateien, die
    // `useReactTable` aufrufen. Gemessen am 2026-09-09 gegen genau diese
    // Konfiguration: zwei Fundstellen, beide mit demselben Meldungstext
    // („Compilation Skipped: Use of incompatible library"), beide eine
    // Mitteilung ueber @tanstack/react-table und keine ueber diesen Code.
    //
    // Die Ausnahme ist NAMENTLICH, nicht global: eine dritte Aufrufstelle
    // faellt auf. Sie ist auch nicht `eslint-disable` an der Zeile, weil die
    // Begruendung nicht an der Zeile haengt, sondern an der Abhaengigkeit —
    // sie gehoert in die Konfiguration und in den ADR, wo sie beim naechsten
    // Bibliothekswechsel wiedergefunden wird.
    files: [
      "src/app/(dashboard)/audit-log/page.tsx",
      "src/components/ui/data-table.tsx",
    ],
    rules: {
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    // `<img>` on three pages shows a marketplace listing image and an
    // org-uploaded logo. `next/image` needs `images.remotePatterns` for the
    // first and gives no benefit for the second (the logo is served from the
    // app's own /uploads and is already small). The rule is a performance
    // hint, not a correctness or accessibility one — all four elements carry
    // an `alt`, which `jsx-a11y/alt-text` enforces.
    files: [
      "src/app/(dashboard)/marketplace/**",
      "src/app/(dashboard)/settings/branding/**",
    ],
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    // Test and E2E code: `any` is the natural shape of a mock or a partially
    // typed fixture, and banning it there produces casts that assert more than
    // the test actually knows. The CLAUDE.md convention is about product code.
    files: [
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "e2e/**",
      "tests/**",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  // ── Die Uebergabe unter `src/app/api/v1/**` ist eingeloest ────────────
  //
  // [ARCTOS-FULL-2026-08-31 / Welle 4b · Strang 3 — OP-076, OP-077]
  //
  // Hier stand bis Welle 4b ein eigenes Konfigurationsobjekt fuer
  // `src/app/api/v1/**` mit zwei abgeschalteten Regeln:
  //
  //   "@typescript-eslint/no-explicit-any": "off"   (gemessen 128 Stellen)
  //   "@typescript-eslint/no-unused-vars":  "off"   (gemessen 500 Stellen)
  //
  // Beide waren als HANDOVER begruendet, nicht in der Sache: WP12 durfte
  // diese 1.375 Routendateien nicht anfassen. Strang 3 dieser Welle hat die
  // Dateihoheit und hat den Bestand abgetragen — beide Zahlen stehen auf 0,
  // nachgemessen mit `eslint --rule` gegen dasselbe Regelwerk, das oben
  // fuer den Rest des Workspaces gilt.
  //
  // Damit faellt das Objekt ersatzlos: die zwei Regeln gelten in diesem
  // Verzeichnis wieder wie ueberall sonst. Einzelheiten und die Befunde,
  // die dabei sichtbar wurden, in docs/UMSETZUNG-WELLE-4B-3.md.
  //
  // (Die dritte Ausnahme dieses Objekts,
  // `@next/next/no-assign-module-variable`, war schon in Welle 4b-1 mit
  // OP-078 gefallen.)

  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "next-env.d.ts",
      // Build output of `scripts/build-messages.ts`, not source (S14-07).
      "messages/de.json",
      "messages/en.json",
      "playwright-report/**",
      "test-results/**",
    ],
  },
);
