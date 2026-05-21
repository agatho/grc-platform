// Audit-Log endpoints — RBAC contract for the three security-critical surfaces:
//   - GET  /api/v1/audit-log/archive          (admin, auditor) — produces ZIP
//   - POST /api/v1/audit-log/anchor           (admin, auditor) — manual anchor
//   - GET  /api/v1/audit-log/integrity        (admin, auditor) — hash-chain (per-tenant, ADR-011 rev.2)
//
// All three are auditor-grade endpoints. They MUST refuse non-privileged
// roles even before they touch the database, and they MUST share the same
// allow-list. A drift between them is a quiet compliance hole.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;
const withAuthMock = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  auditLog: {},
  auditAnchor: {},
  organization: {},
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
  // api-wrapper imports PaginationError; mock must export it for instanceof check.
  PaginationError: class PaginationError extends Error {},
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    and: noop,
    eq: noop,
    sql: (strings: TemplateStringsArray) => ({ sql: strings.raw }),
    gte: noop,
    lte: noop,
    asc: noop,
    desc: noop,
    isNotNull: noop,
    lt: noop,
  };
});

vi.mock("jszip", () => ({
  default: class {
    file = vi.fn();
    folder = vi.fn(() => ({ file: vi.fn() }));
    generateAsync = vi.fn().mockResolvedValue(Buffer.from(""));
  },
}));

vi.mock("@grc/shared/lib/merkle-tree", () => ({
  merkleRoot: vi.fn().mockReturnValue("root"),
}));
vi.mock("@grc/shared/lib/freetsa", () => ({
  submitTimestamp: vi.fn(),
}));
vi.mock("@grc/shared/lib/opentimestamps", () => ({
  submitTimestamp: vi.fn(),
}));

describe("GET /api/v1/audit-log/archive", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../../app/api/v1/audit-log/archive/route");
    const res = await GET(
      new Request(
        "http://localhost/api/v1/audit-log/archive?from=2026-01-01&to=2026-03-31",
      ),
    );
    expect(res.status).toBe(401);
    expect(withAuthMock).toHaveBeenCalledWith("admin", "auditor");
  });

  it("returns 403 when caller is not admin/auditor (e.g. dpo, viewer, risk_manager)", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    const { GET } = await import("../../app/api/v1/audit-log/archive/route");
    const res = await GET(
      new Request(
        "http://localhost/api/v1/audit-log/archive?from=2026-01-01&to=2026-03-31",
      ),
    );
    expect(res.status).toBe(403);
    // Critical: dpo gets audit-log LIST but NOT the offline archive
    // (the archive contains raw payloads which fall outside the dpo's scope)
    expect(withAuthMock).not.toHaveBeenCalledWith("admin", "auditor", "dpo");
  });
});

describe("POST /api/v1/audit-log/anchor", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { POST } = await import("../../app/api/v1/audit-log/anchor/route");
    const res = await POST(
      new Request("http://localhost/api/v1/audit-log/anchor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(401);
    expect(withAuthMock).toHaveBeenCalledWith("admin", "auditor");
  });

  it("returns 403 for non-admin/auditor roles", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    const { POST } = await import("../../app/api/v1/audit-log/anchor/route");
    const res = await POST(
      new Request("http://localhost/api/v1/audit-log/anchor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /api/v1/audit-log/integrity", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../../app/api/v1/audit-log/integrity/route");
    const res = await GET(
      new Request("http://localhost/api/v1/audit-log/integrity"),
    );
    expect(res.status).toBe(401);
    // #WAVE24-B1: integrity widened to include ciso + compliance_officer
    // (read-only chain health check). Archive (export) and anchor
    // (timestamping) remain admin/auditor only — see consistency test
    // below.
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "auditor",
      "ciso",
      "compliance_officer",
    );
  });

  it("returns 403 for non-admin/auditor roles", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    const { GET } = await import("../../app/api/v1/audit-log/integrity/route");
    const res = await GET(
      new Request("http://localhost/api/v1/audit-log/integrity"),
    );
    expect(res.status).toBe(403);
  });

  it("RBAC: archive + anchor stay admin/auditor; integrity adds read-only roles", async () => {
    // #WAVE24-B1: defensive test against silent RBAC drift. Archive
    // (export-with-audit-trail) and anchor (FreeTSA mutation) remain
    // restricted to admin/auditor — they have compliance side-effects.
    // Integrity is read-only and now includes ciso + compliance_officer
    // so 2nd-line oversight roles can verify chain health for their
    // quarterly reviews without needing audit-team privileges.
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );

    withAuthMock.mockClear();

    const { GET: archiveGet } =
      await import("../../app/api/v1/audit-log/archive/route");
    const { POST: anchorPost } =
      await import("../../app/api/v1/audit-log/anchor/route");
    const { GET: integrityGet } =
      await import("../../app/api/v1/audit-log/integrity/route");

    await archiveGet(
      new Request(
        "http://localhost/api/v1/audit-log/archive?from=2026-01-01&to=2026-01-02",
      ),
    );
    await anchorPost(
      new Request("http://localhost/api/v1/audit-log/anchor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    await integrityGet(
      new Request("http://localhost/api/v1/audit-log/integrity"),
    );

    const calls = withAuthMock.mock.calls;
    expect(calls.length).toBe(3);
    // archive + anchor stay locked down
    expect(calls[0]).toEqual(["admin", "auditor"]);
    expect(calls[1]).toEqual(["admin", "auditor"]);
    // integrity widened for read-only oversight roles
    expect(calls[2]).toEqual([
      "admin",
      "auditor",
      "ciso",
      "compliance_officer",
    ]);
  });
});
