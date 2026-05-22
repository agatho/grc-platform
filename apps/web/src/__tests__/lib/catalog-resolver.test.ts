// Tests for catalog-resolver.resolveCatalogEntry.
//
// This file deserves extra scrutiny because it builds raw SQL via
// string interpolation (`sql.raw`) — every other lib in the codebase
// uses parameterised queries. The audit flagged it as the lib's #4
// HIGH-priority untested file: SQL injection surface + process-wide
// cache that never evicts. Pre-Wave-26: zero unit tests.
//
// Properties pinned here:
//   - empty / undefined inputs return null without hitting the DB
//   - known framework codes map via FRAMEWORK_TOKENS to ILIKE patterns
//   - unknown framework codes fall back to the literal code
//   - single-quote injection in entryCode is escaped (no orphan quote)
//   - cache returns the previous result on repeat (and returns null
//     consistently for misses)

import { describe, it, expect, vi, beforeEach } from "vitest";

const executeMock = vi.fn();
let capturedSql: string | undefined;

vi.mock("@grc/db", () => ({
  db: {
    execute: (query: { sql?: string }) => {
      capturedSql = query?.sql ?? String(query);
      return Promise.resolve(executeMock());
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: { raw: (s: string) => ({ sql: s }) },
}));

import { resolveCatalogEntry } from "../../lib/catalog-resolver";

beforeEach(() => {
  executeMock.mockReset();
  capturedSql = undefined;
});

describe("resolveCatalogEntry — input validation", () => {
  it.each([
    [null, "A.5.15"],
    ["iso-27001", null],
    [undefined, "A.5.15"],
    ["iso-27001", undefined],
    [null, null],
    ["", "A.5.15"],
    ["iso-27001", ""],
  ])(
    "returns null without calling DB for empty/null inputs (%s, %s)",
    async (fwk, entry) => {
      const result = await resolveCatalogEntry(fwk, entry);
      expect(result).toBeNull();
      expect(executeMock).not.toHaveBeenCalled();
    },
  );
});

describe("resolveCatalogEntry — happy path", () => {
  it("returns {catalogEntryId, catalogId} when DB row found", async () => {
    executeMock.mockReturnValue([{ entry_id: "e1", catalog_id: "c1" }]);
    const result = await resolveCatalogEntry(
      "iso-27001-resolve-1",
      "A.5.15-resolve-1",
    );
    expect(result).toEqual({ catalogEntryId: "e1", catalogId: "c1" });
  });

  it("returns null when DB returns empty", async () => {
    executeMock.mockReturnValue([]);
    const result = await resolveCatalogEntry(
      "iso-27001-empty",
      "A.99.99-empty",
    );
    expect(result).toBeNull();
  });
});

describe("resolveCatalogEntry — framework token mapping", () => {
  it.each([
    ["iso-27001", "ISO/IEC 27001"],
    ["iso-27002", "ISO/IEC 27002"],
    ["gdpr", "GDPR"],
    ["nis2", "NIS2"],
    ["dora", "DORA"],
  ])(
    "%s expands to an ILIKE on %s tokens",
    async (frameworkCode, expectedToken) => {
      executeMock.mockReturnValue([]);
      await resolveCatalogEntry(frameworkCode, "X.1-token-" + frameworkCode);
      expect(capturedSql).toBeDefined();
      expect(capturedSql!).toContain(expectedToken);
      expect(capturedSql!).toContain("ILIKE");
    },
  );

  it("unknown framework code falls back to the literal", async () => {
    executeMock.mockReturnValue([]);
    await resolveCatalogEntry("nonexistent-fwk-xyz", "X.1");
    expect(capturedSql!).toContain("nonexistent-fwk-xyz");
  });

  it("framework code lookup is case-insensitive", async () => {
    executeMock.mockReturnValue([]);
    await resolveCatalogEntry("ISO-27001", "X.1-case");
    expect(capturedSql!).toContain("ISO/IEC 27001");
  });
});

describe("resolveCatalogEntry — SQL injection resistance", () => {
  it("escapes single-quote in entryCode", async () => {
    executeMock.mockReturnValue([]);
    // Classic injection probe: end the string and tack on a tautology.
    await resolveCatalogEntry("iso-27001", "A.1' OR '1'='1");
    expect(capturedSql).toBeDefined();
    // The escape MUST double the single quote — anything else is an
    // injection. The exact pattern is `''` in the SQL.
    expect(capturedSql!).toContain("A.1'' OR ''1''=''1");
    // And the SQL must NOT contain a raw orphan single quote that
    // breaks the WHERE clause structure (i.e. no unescaped `'OR'`).
    expect(capturedSql!).not.toMatch(/ce\.code = '[^']*'.*OR.*'1'='1'/);
  });

  it("escapes single-quote in framework-token fallback path", async () => {
    executeMock.mockReturnValue([]);
    await resolveCatalogEntry("o'malley", "X.1-token-inject");
    expect(capturedSql!).toContain("o''malley");
  });
});

describe("resolveCatalogEntry — caching", () => {
  it("a second call with the same args does not hit the DB", async () => {
    executeMock.mockReturnValue([
      { entry_id: "e-cached", catalog_id: "c-cached" },
    ]);
    const firstKey = "iso-27001-cache-test-" + Date.now();
    await resolveCatalogEntry(firstKey, "A.5.15-cache");
    const callsAfterFirst = executeMock.mock.calls.length;
    await resolveCatalogEntry(firstKey, "A.5.15-cache");
    expect(executeMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("caches negative lookups (null) too", async () => {
    executeMock.mockReturnValue([]);
    const key = "neg-cache-" + Date.now();
    const first = await resolveCatalogEntry(key, "X.NEVER");
    expect(first).toBeNull();
    const callsAfterFirst = executeMock.mock.calls.length;
    const second = await resolveCatalogEntry(key, "X.NEVER");
    expect(second).toBeNull();
    expect(executeMock.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe("resolveCatalogEntry — query shape", () => {
  it("query joins catalog_entry on catalog and filters is_active=true", async () => {
    executeMock.mockReturnValue([]);
    await resolveCatalogEntry("iso-27001", "A.5.15-shape");
    expect(capturedSql).toBeDefined();
    expect(capturedSql!).toMatch(/FROM catalog_entry/i);
    expect(capturedSql!).toMatch(/JOIN catalog/i);
    expect(capturedSql!).toMatch(/c\.is_active = true/i);
  });

  it("query orders by created_at DESC + limits to 1 (newest match wins)", async () => {
    executeMock.mockReturnValue([]);
    await resolveCatalogEntry("iso-27001", "A.5.15-order");
    expect(capturedSql!).toMatch(/ORDER BY c\.created_at DESC/);
    expect(capturedSql!).toMatch(/LIMIT 1/);
  });
});
