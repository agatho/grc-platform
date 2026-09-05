// [ARCTOS-FULL-2026-08-31 / WP12 · S12-01, S12-02, S12-03, S12-15, S14-24]
//
// Regression tests for the POSITIVE findings.
//
// Five of the S12/S14 findings are things the codebase gets right, and the
// audit recorded each of them with the same caveat: nothing tests it. Every
// one rests on a single line or a single grep coming back empty, and the
// remediation plan (§1.1) requires a test that "would have made the old state
// visible" — for a positive finding that means a test that fails the moment the
// property stops holding.
//
// These are deliberately repository-level greps rather than behavioural tests:
// the properties themselves are absences ("there is no Server Action", "no
// dangerouslySetInnerHTML"), and an absence can only be asserted over the whole
// tree. The ESLint rules in `apps/web/eslint.config.mjs` cover the same ground
// for code that ESLint sees; these cover the tree, including files a future
// `ignores` entry might exclude.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const REPO = path.join(__dirname, "../../../../..");
const WEB_SRC = path.join(REPO, "apps/web/src");
const PACKAGES = path.join(REPO, "packages");

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    // `coverage/` holds vendored istanbul report assets (prettify.js,
    // sorter.js) which are third-party build output, not application code.
    if (
      entry === "node_modules" ||
      entry === ".next" ||
      entry === "dist" ||
      entry === "coverage"
    )
      continue;
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(p)) out.push(p);
  }
  return out;
}

// This file necessarily contains the very patterns it forbids (in its
// assertions), so it excludes itself. Any OTHER test file that introduces one
// of them is still reported: the audit's claim is about the tree, and a test
// fixture that renders `dangerouslySetInnerHTML` would be a real sink the
// moment someone copies it into a component.
const SELF = path.relative(REPO, __filename);
const APP_FILES = [...walk(WEB_SRC), ...walk(PACKAGES)].filter(
  (f) => path.relative(REPO, f) !== SELF,
);

/** Source with comments and string literals removed. */
function code(file: string): string {
  return (
    readFileSync(file, "utf8")
      // Block and line comments: the repository documents these very patterns
      // in prose (the `customCss` warning in packages/shared/src/schemas
      // spells out `dangerouslySetInnerHTML` precisely so nobody writes it),
      // and a comment is not a sink.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1")
      // String literals: `packages/ai/tests/regression-s05-20-21.test.ts`
      // (WP6) asserts the same absence and therefore contains the pattern as
      // a string. A sink is code, not a quoted name — in JSX
      // `dangerouslySetInnerHTML` is an attribute, never a literal.
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
  );
}

function grep(pattern: RegExp, files = APP_FILES): string[] {
  const hits: string[] = [];
  for (const f of files) {
    if (pattern.test(code(f))) hits.push(path.relative(REPO, f));
    pattern.lastIndex = 0;
  }
  return hits;
}

describe("S12-01 — no Server Actions exist", () => {
  // The audit's whole route-matrix argument depends on this: because every
  // server entry point is a route handler, `middleware.ts` and `withAuth()`
  // see all of them. One `"use server"` file would create an endpoint that is
  // reached over the page path, bypassing the entire
  // withAuth/requireModule/requireRole chain, and no existing test would
  // notice. `no-restricted-syntax` in eslint.config.mjs enforces the same
  // rule; this asserts it over the tree.
  it('has no "use server" directive anywhere', () => {
    expect(grep(/^\s*["']use server["']/m)).toEqual([]);
  });

  it("has no Server Action client hooks and no next-safe-action dependency", () => {
    expect(
      grep(/\buseActionState\b|\buseFormState\b|next-safe-action/),
    ).toEqual([]);
    const lock = readFileSync(path.join(REPO, "package-lock.json"), "utf8");
    expect(lock.includes('"next-safe-action"')).toBe(false);
  });
});

describe("S12-02 — tenant-scoped renders are never cached", () => {
  it("the root layout still forces dynamic rendering", () => {
    // One line in one file is what keeps 482 pages out of the Full Route
    // Cache, and therefore what makes a cross-tenant cache leak impossible.
    const layout = readFileSync(path.join(WEB_SRC, "app/layout.tsx"), "utf8");
    expect(layout).toMatch(/export const dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("no segment re-enables ISR or the Next data cache", () => {
    expect(
      grep(
        /export const revalidate|unstable_cache|revalidateTag|revalidatePath|["']force-cache["']/,
      ),
    ).toEqual([]);
  });
});

describe("S12-03 — no secret is inlined into the client bundle", () => {
  it("every NEXT_PUBLIC_ variable in use is on the reviewed allow-list", () => {
    // Next inlines a value into client chunks only if it is NEXT_PUBLIC_-
    // prefixed. Enumerating the prefix therefore enumerates the exposure, and
    // this list is the audit's inventory. A new NEXT_PUBLIC_ variable fails
    // here until someone has looked at it.
    const allowed = new Set([
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_GIT_SHA",
      "NEXT_PUBLIC_GIT_BRANCH",
      "NEXT_PUBLIC_BUILD_TIME",
      // Angesehen (BPMN-Engine-Umstellung, Parallelbetrieb): der Wert ist
      // eines von zwei Literalen, `legacy` oder `arctos`, und wählt zur
      // Laufzeit die Diagramm-Engine. Er muss im Client-Bündel stehen, weil
      // die Diagrammfläche eine Client-Komponente ist. Kein Geheimnis, keine
      // Mandantenkennung, kein Endpunkt — die Belegung ist ohnehin am
      // gerenderten DOM ablesbar (`data-bpmn-engine`).
      "NEXT_PUBLIC_ARCTOS_BPMN_ENGINE",
    ]);
    const found = new Set<string>();
    for (const f of APP_FILES) {
      for (const m of readFileSync(f, "utf8").matchAll(
        /NEXT_PUBLIC_[A-Z0-9_]+/g,
      ))
        found.add(m[0]);
    }
    expect([...found].filter((v) => !allowed.has(v))).toEqual([]);
  });

  it("no secret-shaped variable ever gets a NEXT_PUBLIC_ prefix", () => {
    const dangerous =
      /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|KEY|PASSWORD|CREDENTIAL|DSN|PRIVATE)/;
    expect(grep(dangerous)).toEqual([]);
  });
});

describe("S12-15 / M3 — no HTML-injection sink exists", () => {
  it("has no dangerouslySetInnerHTML, innerHTML or document.write", () => {
    expect(
      grep(
        /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write\s*\(/,
      ),
    ).toEqual([]);
  });

  it("has no eval or Function constructor", () => {
    // `'unsafe-eval'` is gone from the CSP (S12-04). If application code ever
    // needs eval, the CSP breaks it at runtime — this fails first, at build
    // time, with an explanation.
    expect(grep(/(?<![.\w])eval\s*\(|new Function\s*\(/)).toEqual([]);
  });

  it("SVG uploads are refused for branding and never served inline", () => {
    const logo = readFileSync(
      path.join(
        WEB_SRC,
        "app/api/v1/organizations/[id]/branding/logo/route.ts",
      ),
      "utf8",
    );
    expect(logo).toMatch(/image\/svg\+xml/);
    expect(logo).toMatch(/415/);

    // The document download path re-types SVG to octet-stream AND sets
    // nosniff. Both halves are load-bearing: without nosniff the browser
    // sniffs the content back to SVG and executes the script in it.
    for (const rel of [
      "app/api/v1/documents/[id]/download/route.ts",
      "app/api/v1/documents/[id]/files/[fileId]/download/route.ts",
    ]) {
      const src = readFileSync(path.join(WEB_SRC, rel), "utf8");
      expect(src).toMatch(/application\/octet-stream/);
      expect(src).toMatch(/X-Content-Type-Options/i);
    }
  });
});

describe("S14-24 — no <img> without an alt attribute", () => {
  it("every img element declares alt", () => {
    const offenders: string[] = [];
    for (const f of walk(WEB_SRC)) {
      if (!f.endsWith(".tsx")) continue;
      const text = code(f);
      for (const m of text.matchAll(/<img\b[^>]*>/g)) {
        if (!/\balt\s*=/.test(m[0]))
          offenders.push(`${path.relative(REPO, f)}: ${m[0].slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
