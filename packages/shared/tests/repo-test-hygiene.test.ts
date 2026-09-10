// [ARCTOS-FULL-2026-08-31 / WP11 · S11-17, S11-02, S11-13]
//
// Repository-wide test hygiene, enforced as a test so it runs in `npm test`
// and in every CI job — no separate lint workflow to forget to wire up.
//
// It lives in `packages/shared` for one reason: that package's suite runs in
// every configuration (no database, no jsdom, no Next.js) and always runs, so
// the guard cannot be switched off by skipping a package.
//
// Three rules:
//
//  1. S11-17 — no `.only` anywhere. The audit recorded "not a single committed
//     `.only`" as a POSITIVE finding, and a positive finding that nothing
//     enforces is a coincidence, not a control. One committed `.only` silently
//     reduces a file to a single test while the run still reports green.
//
//  2. S11-02 — no skip without a documented reason. 526 silent `ctx.skip()`
//     calls hid the entire read half of the API behind a comment that was
//     factually wrong. Every remaining skip must state WHY on the same line or
//     the line above, and the environment-gated ones must go through the
//     documented `ALLOW_SKIP_DB_TESTS` mechanism.
//
//  3. S11-13 — the test-file count in the documentation drifted (684 / 236
//     claimed vs. 406 actual). The number is now derived here instead of being
//     copied by hand, and the test states the current value in its failure
//     message so the next person updates the doc from a measurement.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "build",
  "playwright-report",
  "test-results",
]);

const TEST_FILE = /\.(test|spec)\.(ts|tsx|mts|cts)$/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (TEST_FILE.test(name)) out.push(full);
  }
  return out;
}

const testFiles = walk(REPO_ROOT).sort();

interface Hit {
  file: string;
  line: number;
  text: string;
}

function scan(pattern: RegExp): Hit[] {
  const hits: Hit[] = [];
  for (const file of testFiles) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, i) => {
      if (pattern.test(text)) {
        hits.push({
          file: relative(REPO_ROOT, file),
          line: i + 1,
          text: text.trim(),
        });
      }
    });
  }
  return hits;
}

function format(hits: Hit[]): string {
  return hits.map((h) => `  ${h.file}:${h.line}  ${h.text}`).join("\n");
}

describe("repository test hygiene", () => {
  it("finds the test files it is supposed to guard", () => {
    // A broken walk would make every rule below vacuously true.
    expect(
      testFiles.length,
      `only ${testFiles.length} test files discovered under ${REPO_ROOT} — ` +
        "the scanner is broken, not the repository",
    ).toBeGreaterThan(200);
  });

  // ── S11-17 ────────────────────────────────────────────────────────────
  it("contains no focused test (`.only`)", () => {
    const hits = scan(/\b(?:describe|it|test|bench|suite)\s*\.\s*only\s*[(<]/);
    expect(
      hits,
      "A committed `.only` reduces its file to one test and the run still " +
        `reports success:\n${format(hits)}`,
    ).toEqual([]);
  });

  it("contains no focused Playwright test (`test.describe.only`)", () => {
    const hits = scan(/\btest\s*\.\s*describe\s*\.\s*only\s*\(/);
    expect(hits, format(hits)).toEqual([]);
  });

  // ── S11-02 ────────────────────────────────────────────────────────────
  it("contains no undocumented skip", () => {
    // A skip is documented when the same line or the line above carries a
    // comment, or when it is the ALLOW_SKIP_DB_TESTS / env-gated pattern whose
    // reason is printed at runtime by the package's require-db guard.
    const undocumented: Hit[] = [];
    /** Ersetzt jedes Zeichenkettenliteral durch leere Anführungszeichen. */
    const stripStringLiterals = (line: string): string =>
      line
        .replace(/`(?:\\.|[^`\\])*`/g, "``")
        .replace(/"(?:\\.|[^"\\])*"/g, '""')
        .replace(/'(?:\\.|[^'\\])*'/g, "''");
    const skipPattern =
      /\b(?:describe|it|test)\s*\.\s*(?:skip|todo|fixme)\b|(?:^|[^.\w])(?:ctx|this)\.skip\s*\(/;

    for (const file of testFiles) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((text, i) => {
        // [ARCTOS-FULL-2026-08-31 · OP-141] Gesucht wird Code, nicht Prosa.
        // Vier E2E-Dateien tragen in einer Zusicherungsmeldung den Satz
        // "This used to be a silent `test.skip`." — die Erklärung dafür, dass
        // dort **kein** Skip mehr steht. Der Wächter hat sie als Skip gezählt
        // und dieselbe Datei angezeigt, deren Verbesserung sie belegen. Für
        // die Erkennung werden Zeichenkettenliterale deshalb ausgeblendet;
        // für die anschliessende Begründungsprüfung bleibt die Zeile im
        // Original stehen, denn dort **ist** die Zeichenkette die Begründung.
        if (!skipPattern.test(stripStringLiterals(text))) return;
        const hasInlineComment = /\/\/|\/\*/.test(text);
        const prev = (lines[i - 1] ?? "").trim();
        const hasCommentAbove = prev.startsWith("//") || prev.startsWith("*");
        // `const x = COND ? describe : describe.skip` — the condition IS the
        // reason and the matching require-db guard prints it. Accept only that
        // exact shape, not a bare `describe.skip`.
        const isEnvGated =
          /\?\s*(?:describe|it|test)\s*:\s*(?:describe|it|test)\.skip/.test(
            text,
          );
        // Playwright's `test.skip(condition, "reason")` carries its reason as
        // the second argument — often wrapped onto one of the next lines by
        // prettier, so look at a small window rather than a single line.
        //
        // [ARCTOS-FULL-2026-08-31 · OP-141] Das Muster hiess vorher
        // `\.skip\s*\([^;]*["'`]…{8,}["'`]` und liess damit auch
        // `it.skip("ein hinreichend langer Testname", fn)` durch — der
        // **Titel** wurde als Begründung akzeptiert. Damit war jeder
        // gewöhnliche Skip dokumentiert, sobald sein Name acht Zeichen hatte,
        // und die Regel bestand nur noch auf dem Papier. Jetzt gilt die
        // Ausnahme nur für die Playwright-Form: erstes Argument **kein**
        // Zeichenkettenliteral (die Bedingung), danach ein Komma, danach die
        // Begründung.
        const window = [text, lines[i + 1] ?? "", lines[i + 2] ?? ""].join(" ");
        const hasReasonArgument =
          /\.\s*(?:skip|fixme)\s*\(\s*[^"'`,;)][^;)]*,\s*["'`][^"'`]{8,}["'`]/.test(
            window,
          );

        if (
          !hasInlineComment &&
          !hasCommentAbove &&
          !isEnvGated &&
          !hasReasonArgument
        ) {
          undocumented.push({
            file: relative(REPO_ROOT, file),
            line: i + 1,
            text: text.trim(),
          });
        }
      });
    }

    expect(
      undocumented,
      "Every skip must say why, on the line itself or the line above " +
        "(S11-02: 526 silent skips hid the whole read path of the API and " +
        `their one comment was factually wrong):\n${format(undocumented)}`,
    ).toEqual([]);
  });

  // ── S11-13 ────────────────────────────────────────────────────────────
  it("test-file count is derived, not copied from the documentation", () => {
    // The audit found 684 and 236 claimed in plan/docs against 406 actual.
    // This assertion exists so the number in any document can be checked
    // against a measurement instead of another document. Update the bound
    // when the suite grows; never update a doc figure without running this.
    expect(
      testFiles.length,
      `measured test files: ${testFiles.length}`,
    ).toBeGreaterThanOrEqual(400);
  });
});
