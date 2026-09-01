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

  // ── Deliberate exceptions ─────────────────────────────────────────────
  {
    // `react-hooks/exhaustive-deps` reports 23 sites, all of them existing
    // "run once with the initial prop" effects written while the rule was off.
    // Turning it on without rewriting them would either fail CI or invite
    // blanket per-line disables; rewriting them changes behaviour in 18 pages,
    // which this package cannot verify without the E2E suite (WP11). Recorded
    // here with the reason rather than switched off silently, and handed to
    // WP11. `react-hooks/rules-of-hooks` — the rule that catches actual
    // hook-order bugs — IS an error above.
    rules: {
      "react-hooks/exhaustive-deps": "off",

      // ── React-Compiler lints from eslint-plugin-react-hooks 7 ──────────
      // `eslint-config-next@16` pulls in the new compiler rule set. They
      // report 36 sites, and every one of them is the same shape: a
      // `useEffect` that fetches on mount and calls `setLoading(true)` /
      // `setData(...)`. That is an idiom the compiler would like replaced by a
      // data library — `@tanstack/react-query` is already a dependency — not a
      // defect: no wrong render, no wrong data, no accessibility or security
      // effect. Converting 19 pages to react-query is a behaviour change WP12
      // cannot verify without the E2E suite (WP11), and marking 36 sites with
      // per-line disables would bury a real future hit.
      //
      // Off with this note and handed to WP11, one rule at a time so a
      // different kind of report is NOT silenced:
      "react-hooks/set-state-in-effect": "off", // 19× fetch-on-mount
      "react-hooks/purity": "off", //              8× Date.now()/random in render path
      "react-hooks/static-components": "off", //   3× component defined in a component
      "react-hooks/immutability": "off", //        2×
      "react-hooks/incompatible-library": "off", // 2× recharts/bpmn-js interop
      "react-hooks/preserve-manual-memoization": "off", // 1×
      "react-hooks/refs": "off", //                1×
      // `react-hooks/rules-of-hooks` — the rule that catches an actual
      // hook-order bug — stays an ERROR above, and its two hits are fixed.
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
  {
    // ── HANDOVER, not an exemption on the merits ─────────────────────────
    // 129 of the 267 `any` occurrences (S14-19) live under
    // `apps/web/src/app/api/v1/**`, which is outside WP12's file ownership —
    // WP2, WP3, WP6 and WP9 hold those routes and edited them in waves 1–3.
    // The rule is ON everywhere else; this scope is named explicitly so the
    // debt stays visible in one place instead of dissolving into a global
    // `"off"`. Hotspots for the owning packages, from the audit:
    //   processes/audit-pack/route.ts                     (14×)
    //   tprm/vendors/[id]/onboarding-pack/route.ts        (12×)
    //   audit-mgmt/audits/[id]/audit-pack/route.ts        (12×)
    //   whistleblowing/statistics/route.ts                 (8×, `as any[]` on raw SQL rows)
    // See /work/audit/remediation/WP12.md, "Bedarf an andere Pakete".
    files: ["src/app/api/v1/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // Same boundary, same reason: 483 of the 1.127 dead bindings live in
      // those 1.355 route files. Removing an unused import there is safe but
      // it is not WP12's file to touch, and it would bury this package's diff
      // in 800 lines of other people's routes.
      "@typescript-eslint/no-unused-vars": "off",
      // Six routes declare a local `const module = …` (the module-key string),
      // which shadows the CommonJS `module` global. Renaming a local is safe
      // but, again, not WP12's file. Handed over with the rest.
      "@next/next/no-assign-module-variable": "off",
    },
  },
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
