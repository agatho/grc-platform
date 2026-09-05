// Audit-Log Integrity Endpoint — response contract and auth gating.
//
// ── S03-18: what this file used to be ─────────────────────────────────
//
// The header claimed "security-critical, verifies SHA-256 chain". It
// contained one behavioural test, and that test could not fail:
//
//     expect([200, 503]).toContain(res.status);
//     const body = await res.json();
//     expect(body).toBeDefined();
//
// Both status codes accepted, only the existence of a body asserted, the
// database fully mocked. Any handler that returned anything passed — on
// the one endpoint that answers "is the audit trail intact?". The audit
// stream found no test anywhere in 684 files that manipulated a row and
// expected detection.
//
// This file no longer claims to verify the chain. Verifying the chain
// needs a database and real rows; that lives in
// packages/db/tests/integration/audit-tamper-evidence.test.ts, which runs
// every attack the audit reproduced — the hash_version trick, actor-field
// forgery, chain recomputation, anchor overwrite, TRUNCATE,
// session_replication_role — and asserts each one is refused or detected.
//
// What is tested here is what a mocked endpoint test can honestly test:
// that the handler maps a verification result onto the right status code,
// that an unhealthy chain cannot come back as 200, that a privilege error
// is not reported as an integrity failure, and that anchor tampering
// makes the report unhealthy even when the chain itself is intact.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;
let withAuthMock: ReturnType<typeof vi.fn>;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
  PaginationError: class PaginationError extends Error {},
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({
    sql: strings.raw,
    vals,
  }),
}));

/** The shape audit_chain_verify() returns, with healthy defaults. */
function report(overrides: Record<string, unknown> = {}) {
  return {
    scope: "org:o1",
    total: 12,
    ok: 12,
    rowMismatches: 0,
    chainMismatches: 0,
    commitmentMismatches: 0,
    unverifiableVersion: 0,
    redactedLegacy: 0,
    redactionUnproven: 0,
    unchainedRows: 0,
    unchainedNewest: null,
    versionDistribution: { v0: 0, v1: 0, v2: 0, v3: 0, v4: 12 },
    anchorIssues: [],
    refusedWrites24h: 0,
    healthy: true,
    ...overrides,
  };
}

async function callGet() {
  const { GET } = await import("../../app/api/v1/audit-log/integrity/route");
  return GET(new Request("http://localhost/api/v1/audit-log/integrity"));
}

describe("GET /api/v1/audit-log/integrity", () => {
  beforeEach(() => {
    vi.resetModules();
    mockDb = makeMockDb();
    withAuthMock = vi.fn().mockResolvedValue({
      session: { user: { id: "u1" } },
      orgId: "o1",
      userId: "u1",
    });
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValueOnce(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("returns 200 and healthy:true when every row verifies", async () => {
    mockDb.execute.mockResolvedValueOnce([{ report: report() }]);
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.healthy).toBe(true);
    expect(body.data.total).toBe(12);
    expect(body.data.verified.v4).toBe(12);
  });

  it("returns 503 for a row-hash mismatch", async () => {
    mockDb.execute
      .mockResolvedValueOnce([
        { report: report({ ok: 11, rowMismatches: 1, healthy: false }) },
      ])
      .mockResolvedValueOnce([
        {
          id: "row-1",
          chain_seq: 42,
          entity_type: "risk",
          entity_id: "e1",
          action: "update",
          created_at: "2026-08-31T00:00:00Z",
          hash_version: 4,
          stored_entry_hash: "aa",
          recomputed_entry_hash: "bb",
          status: "row_mismatch",
        },
      ]);
    const res = await callGet();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.data.healthy).toBe(false);
    expect(body.data.rowMismatches).toHaveLength(1);
    expect(body.data.rowMismatches[0].chainSeq).toBe(42);
  });

  it("returns 503 for hash_version = 0 instead of calling it a warning", async () => {
    // The S03-02 regression. The old handler skipped v0 rows, reported
    // them under `warnings[]` with a remedy text advising a rehash, and
    // answered 200 healthy:true — which is what made content forgery
    // invisible while the anchored Merkle root stayed bit-identical.
    mockDb.execute
      .mockResolvedValueOnce([
        {
          report: report({
            ok: 11,
            unverifiableVersion: 1,
            versionDistribution: { v0: 1, v1: 0, v2: 0, v3: 0, v4: 11 },
            healthy: false,
          }),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "row-v0",
          chain_seq: 7,
          entity_type: "user",
          entity_id: "e2",
          action: "update",
          created_at: "2026-08-31T00:00:00Z",
          hash_version: 0,
          stored_entry_hash: "aa",
          recomputed_entry_hash: null,
          status: "unverifiable_version",
        },
      ]);
    const res = await callGet();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.data.healthy).toBe(false);
    expect(body.data.unverifiableVersion).toBe(1);
    expect(body.data.skipped.v0_broken).toBe(1);
    // And no text anywhere that tells the operator to rehash.
    expect(JSON.stringify(body)).not.toMatch(/rehash/i);
  });

  it("returns 503 when the chain is intact but an anchor was overwritten", async () => {
    // S03-01: an unbroken chain whose external anchors no longer match
    // their seals is not a healthy audit trail — it is the attack.
    mockDb.execute.mockResolvedValueOnce([
      {
        report: report({
          anchorIssues: [
            {
              anchorDate: "2026-08-30",
              provider: "freetsa",
              issue: "anchor_digest_mismatch",
              detail: "stored root does not match the sealed digest",
            },
          ],
        }),
      },
    ]);
    const res = await callGet();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.data.healthy).toBe(false);
    expect(body.data.anchorIssues).toHaveLength(1);
  });

  it("does not fail the report merely because seals are unsigned", async () => {
    // A missing AUDIT_SEAL_KEY weakens the seal; it is not evidence of
    // tampering, so it is a warning, not a 503.
    mockDb.execute.mockResolvedValueOnce([
      {
        report: report({
          anchorIssues: [
            {
              anchorDate: "2026-08-30",
              provider: "freetsa",
              issue: "seal_unsigned",
              detail: "chained but not HMAC-signed",
            },
          ],
        }),
      },
    ]);
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.healthy).toBe(true);
    expect(body.data.warnings.map((w: { kind: string }) => w.kind)).toContain(
      "anchor_unsealed",
    );
  });

  it("reports rows written outside the chain, with the newest timestamp", async () => {
    // S03-05: these used to be labelled "pre-rev2 legacy rows … reported
    // informationally" while six live code paths kept producing them.
    mockDb.execute.mockResolvedValueOnce([
      {
        report: report({
          unchainedRows: 3,
          unchainedNewest: "2026-08-31T12:00:00Z",
          healthy: false,
        }),
      },
    ]);
    const res = await callGet();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.data.legacyRowCount).toBe(3);
    expect(body.data.legacyRowNewest).toBe("2026-08-31T12:00:00Z");
    const warning = body.data.warnings.find(
      (w: { kind: string }) => w.kind === "unchained_rows",
    );
    expect(warning).toBeDefined();
    expect(warning.detail).toContain("2026-08-31T12:00:00Z");
  });

  it("reports a missing privilege as a configuration error, not as a broken chain", async () => {
    // S03-19: 42501 used to come back as 503 "hash-chain verification
    // could not complete" — indistinguishable from a tampered trail.
    const err = Object.assign(
      new Error("permission denied for table audit_log"),
      { code: "42501" },
    );
    mockDb.execute.mockRejectedValueOnce(err);
    const res = await callGet();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.title).toMatch(/not readable/i);
    expect(body.detail).toMatch(/deployment problem/i);
  });

  it("still reports an unexpected failure as 503 without leaking the message", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("connection lost"));
    const res = await callGet();
    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    const body = await res.json();
    // The underlying message stays server-side (CodeQL js/stack-trace-exposure).
    expect(JSON.stringify(body)).not.toContain("connection lost");
  });
});
