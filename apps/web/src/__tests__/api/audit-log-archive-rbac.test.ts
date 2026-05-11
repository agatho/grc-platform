// Audit-Log endpoints — RBAC contract for the three security-critical surfaces:
//   - GET  /api/v1/audit-log/archive          (admin, auditor) — produces ZIP
//   - POST /api/v1/audit-log/anchor           (admin, auditor) — manual anchor
//   - GET  /api/v1/audit-log/integrity-check  (admin, auditor) — hash-chain
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

describe("GET /api/v1/audit-log/integrity-check", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } =
      await import("../../app/api/v1/audit-log/integrity-check/route");
    const res = await GET();
    expect(res.status).toBe(401);
    expect(withAuthMock).toHaveBeenCalledWith("admin", "auditor");
  });

  it("returns 403 for non-admin/auditor roles", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    const { GET } =
      await import("../../app/api/v1/audit-log/integrity-check/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("RBAC consistency: archive, anchor, integrity-check all use same role list", async () => {
    // Defensive test against silent RBAC drift across the three audit-log endpoints.
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );

    // Reset call history across imports
    withAuthMock.mockClear();

    const { GET: archiveGet } =
      await import("../../app/api/v1/audit-log/archive/route");
    const { POST: anchorPost } =
      await import("../../app/api/v1/audit-log/anchor/route");
    const { GET: integrityGet } =
      await import("../../app/api/v1/audit-log/integrity-check/route");

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
    await integrityGet();

    // All three calls should pass identical role list
    const calls = withAuthMock.mock.calls;
    expect(calls.length).toBe(3);
    for (const call of calls) {
      expect(call).toEqual(["admin", "auditor"]);
    }
  });
});
