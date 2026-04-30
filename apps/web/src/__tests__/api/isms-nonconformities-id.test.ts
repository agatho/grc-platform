// Tests für PUT /api/v1/isms/nonconformities/[id] — die im Overnight-Cleanup
// erweiterte State-Machine-Validierung + Closure-Gate.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  makeMockDb,
  type MockDb,
  makeRequest,
  makeParams,
} from "./helpers/mock-context";

let mockDb: MockDb;
let withAuthMock: ReturnType<typeof vi.fn>;
let withAuditCtxMock: ReturnType<typeof vi.fn>;
let requireModuleMock: ReturnType<typeof vi.fn>;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
}));

vi.mock("@grc/auth", () => ({
  get requireModule() {
    return requireModuleMock;
  },
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
  get withAuditContext() {
    return withAuditCtxMock;
  },
}));

vi.mock("@grc/shared", () => ({
  NC_STATUSES: [
    "open",
    "analysis",
    "action_planned",
    "in_progress",
    "verification",
    "closed",
    "reopened",
  ] as const,
  validateNcTransition: vi.fn(({ from, to }) => {
    const allowed: Record<string, string[]> = {
      open: ["analysis"],
      analysis: ["action_planned", "open"],
      action_planned: ["in_progress", "analysis"],
      in_progress: ["verification", "action_planned"],
      verification: ["closed", "in_progress"],
      closed: ["reopened"],
      reopened: ["analysis"],
    };
    if (from === to) return { ok: true };
    if (allowed[from]?.includes(to)) return { ok: true };
    return { ok: false, reason: `Transition ${from} → ${to} not allowed` };
  }),
  assertCanCloseNc: vi.fn((actions) => {
    if (actions.length === 0) return { ok: false, reason: "no actions" };
    const ok = actions.some(
      (a: { status: string; verificationResult: string }) =>
        (a.status === "verified" || a.status === "closed") &&
        a.verificationResult === "effective",
    );
    return ok ? { ok: true } : { ok: false, reason: "no effective CA" };
  }),
  assertCanCloseMajorNc: vi.fn((actions) => {
    const base = actions.length > 0;
    return base ? { ok: true } : { ok: false, reason: "major-nc-no-actions" };
  }),
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({
    sql: strings.raw,
    vals,
  }),
}));

const ROUTE = "../../app/api/v1/isms/nonconformities/[id]/route";

describe("PUT /api/v1/isms/nonconformities/[id]", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock = vi.fn().mockResolvedValue({
      session: { user: { id: "u1" } },
      orgId: "o1",
      userId: "u1",
    });
    withAuditCtxMock = vi.fn(async (_ctx, fn: () => Promise<unknown>) => fn());
    requireModuleMock = vi.fn().mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValueOnce(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { PUT } = await import(ROUTE);
    const res = await PUT(
      makeRequest("http://localhost/api/v1/isms/nonconformities/abc", {
        method: "PUT",
        body: { status: "analysis" },
      }),
      { params: makeParams({ id: "abc" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when ISMS module is disabled", async () => {
    requireModuleMock.mockResolvedValueOnce(
      Response.json({ error: "disabled" }, { status: 404 }),
    );
    const { PUT } = await import(ROUTE);
    const res = await PUT(
      makeRequest("http://localhost/api/v1/isms/nonconformities/abc", {
        method: "PUT",
        body: { status: "analysis" },
      }),
      { params: makeParams({ id: "abc" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 422 for invalid status enum value", async () => {
    const { PUT } = await import(ROUTE);
    const res = await PUT(
      makeRequest("http://localhost/api/v1/isms/nonconformities/abc", {
        method: "PUT",
        body: { status: "BOGUS_STATUS" },
      }),
      { params: makeParams({ id: "abc" }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 404 when NC does not exist (status update path)", async () => {
    mockDb.execute.mockResolvedValueOnce([]); // current NC lookup
    const { PUT } = await import(ROUTE);
    const res = await PUT(
      makeRequest("http://localhost/api/v1/isms/nonconformities/abc", {
        method: "PUT",
        body: { status: "analysis" },
      }),
      { params: makeParams({ id: "abc" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 422 for forbidden status transition (open → closed)", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { status: "open", severity: "minor" },
    ]);
    const { PUT } = await import(ROUTE);
    const res = await PUT(
      makeRequest("http://localhost/api/v1/isms/nonconformities/abc", {
        method: "PUT",
        body: { status: "closed" },
      }),
      { params: makeParams({ id: "abc" }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Invalid status transition");
    expect(body.from).toBe("open");
    expect(body.to).toBe("closed");
  });

  it("blocks closure when no effective corrective action exists (minor NC)", async () => {
    mockDb.execute
      .mockResolvedValueOnce([{ status: "verification", severity: "minor" }])
      .mockResolvedValueOnce([]); // no corrective actions
    const { PUT } = await import(ROUTE);
    const res = await PUT(
      makeRequest("http://localhost/api/v1/isms/nonconformities/abc", {
        method: "PUT",
        body: { status: "closed" },
      }),
      { params: makeParams({ id: "abc" }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Cannot close nonconformity");
    expect(body.reason).toMatch(/no actions|effective/);
  });

  it("allows valid transition (open → analysis) with no closure check", async () => {
    mockDb.execute
      .mockResolvedValueOnce([{ status: "open", severity: "minor" }])
      .mockResolvedValueOnce([{ id: "nc-1", status: "analysis" }]);
    const { PUT } = await import(ROUTE);
    const res = await PUT(
      makeRequest("http://localhost/api/v1/isms/nonconformities/abc", {
        method: "PUT",
        body: { status: "analysis" },
      }),
      { params: makeParams({ id: "abc" }) },
    );
    expect(res.status).toBe(200);
  });
});
