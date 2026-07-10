// Tests für das Management-Review-Cockpit (ISO 27001 Kap. 9.3):
//   - GET  /api/v1/isms/reviews/[id]/dashboard   (Aggregations-Shape, 401, 404)
//   - POST /api/v1/isms/reviews/[id]/items       (Create, 422 bei completed)
//   - PUT/DELETE /items/[itemId]                 (422 bei completed)
//   - PUT  /api/v1/isms/reviews/[id]             (Status-Transitions, read-only)

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  makeMockDb,
  chainable,
  type MockDb,
  makeRequest,
  makeParams,
} from "./helpers/mock-context";

let mockDb: MockDb;
let withAuthMock: ReturnType<typeof vi.fn>;
let withAuditCtxMock: ReturnType<typeof vi.fn>;
let requireModuleMock: ReturnType<typeof vi.fn>;

vi.mock("@grc/db", () => {
  const tableStub = new Proxy(
    {},
    { get: (_t, p) => (typeof p === "symbol" ? undefined : `col_${String(p)}`) },
  );
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "db") return mockDb;
        if (prop === "__esModule") return true;
        if (typeof prop === "symbol") return undefined;
        return tableStub;
      },
      has: (_t, prop) => typeof prop === "string",
    },
  );
});

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
  PaginationError: class PaginationError extends Error {},
}));

vi.mock("drizzle-orm", () => {
  const op = (name: string) =>
    vi.fn((...args: unknown[]) => ({ op: name, args }));
  return {
    eq: op("eq"),
    and: op("and"),
    ne: op("ne"),
    gt: op("gt"),
    gte: op("gte"),
    lt: op("lt"),
    lte: op("lte"),
    isNull: op("isNull"),
    isNotNull: op("isNotNull"),
    asc: op("asc"),
    desc: op("desc"),
    inArray: op("inArray"),
    count: op("count"),
    or: op("or"),
    ilike: op("ilike"),
    sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({
      sql: strings.raw,
      vals,
    }),
  };
});

const DASHBOARD_ROUTE = "../../app/api/v1/isms/reviews/[id]/dashboard/route";
const ITEMS_ROUTE = "../../app/api/v1/isms/reviews/[id]/items/route";
const ITEM_ROUTE = "../../app/api/v1/isms/reviews/[id]/items/[itemId]/route";
const REVIEW_ROUTE = "../../app/api/v1/isms/reviews/[id]/route";

const REVIEW_ID = "a1b2c3d4-e5f6-4789-9abc-def012345678";
const ITEM_ID = "b1b2c3d4-e5f6-4789-9abc-def012345678";

beforeEach(() => {
  mockDb = makeMockDb();
  withAuthMock = vi.fn().mockResolvedValue({
    session: { user: { id: "u1" } },
    orgId: "o1",
    userId: "u1",
  });
  withAuditCtxMock = vi.fn(async (_ctx, fn: (tx: MockDb) => Promise<unknown>) =>
    fn(mockDb),
  );
  requireModuleMock = vi.fn().mockResolvedValue(undefined);
});

const unauthorized = () =>
  Response.json({ error: "Unauthorized" }, { status: 401 });

describe("GET /api/v1/isms/reviews/[id]/dashboard", () => {
  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValueOnce(unauthorized());
    const { GET } = await import(DASHBOARD_ROUTE);
    const res = await GET(
      makeRequest(`http://localhost/api/v1/isms/reviews/${REVIEW_ID}/dashboard`),
      { params: makeParams({ id: REVIEW_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when the review does not exist", async () => {
    // review lookup → []
    mockDb.select.mockReturnValueOnce(chainable([]));
    const { GET } = await import(DASHBOARD_ROUTE);
    const res = await GET(
      makeRequest(`http://localhost/api/v1/isms/reviews/${REVIEW_ID}/dashboard`),
      { params: makeParams({ id: REVIEW_ID }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns the aggregated 9.3 input shape (empty org, fallback period)", async () => {
    // 1) review lookup, 2) last-completed lookup → none; alle Aggregate → []
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: REVIEW_ID,
          orgId: "o1",
          title: "Review Q2",
          reviewDate: "2026-06-30",
          status: "in_progress",
          periodStart: null,
          periodEnd: null,
        },
      ]),
    );
    const { GET } = await import(DASHBOARD_ROUTE);
    const res = await GET(
      makeRequest(`http://localhost/api/v1/isms/reviews/${REVIEW_ID}/dashboard`),
      { params: makeParams({ id: REVIEW_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const d = body.data;

    // Zeitraum: kein Vorgänger-Review → 12-Monats-Fallback
    expect(d.period).toEqual({
      from: "2025-06-30",
      to: "2026-06-30",
      source: "fallback_12m",
    });

    // Alle Input-Kategorien (a–h) vorhanden
    expect(d.previousActions).toEqual({
      review: null,
      items: [],
      legacyActionItems: null,
    });
    expect(d.risks).toMatchObject({
      byStatus: {},
      newInPeriod: 0,
      closedInPeriod: 0,
      top: [],
      acceptances: { activeCount: 0, expiringSoonest: [] },
    });
    expect(d.findings).toMatchObject({
      open: 0,
      closedInPeriod: 0,
      overdue: [],
      overdueCount: 0,
    });
    expect(d.audits).toEqual({ completedInPeriod: [], completedCount: 0 });
    expect(d.controlEffectiveness).toEqual({
      byToeResult: {},
      testedInPeriod: 0,
    });
    expect(d.incidents).toMatchObject({ totalInPeriod: 0, recent: [] });
    expect(d.documents).toEqual({ overdueReviewCount: 0, overdue: [] });
    expect(d.kpis).toEqual({ byAlertStatus: {}, red: [] });
  });

  it("uses the last completed review as period start", async () => {
    mockDb.select
      .mockReturnValueOnce(
        chainable([
          {
            id: REVIEW_ID,
            orgId: "o1",
            title: "Review Q2",
            reviewDate: "2026-06-30",
            status: "planned",
            periodStart: null,
            periodEnd: null,
          },
        ]),
      )
      .mockReturnValueOnce(
        chainable([
          {
            id: "prev-1",
            title: "Review Q4/2025",
            reviewDate: "2025-12-15",
            actionItems: [{ title: "legacy" }],
          },
        ]),
      );
    const { GET } = await import(DASHBOARD_ROUTE);
    const res = await GET(
      makeRequest(`http://localhost/api/v1/isms/reviews/${REVIEW_ID}/dashboard`),
      { params: makeParams({ id: REVIEW_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.period).toEqual({
      from: "2025-12-15",
      to: "2026-06-30",
      source: "last_completed",
    });
    expect(body.data.previousActions.review).toEqual({
      id: "prev-1",
      title: "Review Q4/2025",
      reviewDate: "2025-12-15",
    });
    expect(body.data.previousActions.legacyActionItems).toEqual([
      { title: "legacy" },
    ]);
  });
});

describe("POST /api/v1/isms/reviews/[id]/items", () => {
  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValueOnce(unauthorized());
    const { POST } = await import(ITEMS_ROUTE);
    const res = await POST(
      makeRequest(`http://localhost/api/v1/isms/reviews/${REVIEW_ID}/items`, {
        method: "POST",
        body: { category: "risks", content: "x" },
      }),
      { params: makeParams({ id: REVIEW_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 422 for an unknown category", async () => {
    const { POST } = await import(ITEMS_ROUTE);
    const res = await POST(
      makeRequest(`http://localhost/api/v1/isms/reviews/${REVIEW_ID}/items`, {
        method: "POST",
        body: { category: "BOGUS", content: "x" },
      }),
      { params: makeParams({ id: REVIEW_ID }) },
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when the review is completed (read-only)", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([{ id: REVIEW_ID, status: "completed" }]),
    );
    const { POST } = await import(ITEMS_ROUTE);
    const res = await POST(
      makeRequest(`http://localhost/api/v1/isms/reviews/${REVIEW_ID}/items`, {
        method: "POST",
        body: { category: "risks", content: "Risikolage stabil" },
      }),
      { params: makeParams({ id: REVIEW_ID }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Review is read-only");
  });

  it("creates an item and a linked work_item when an action is given", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: REVIEW_ID, status: "in_progress" }]))
      // max(sortOrder) im tx
      .mockReturnValueOnce(chainable([{ max: 1 }]));
    mockDb.insert
      // work_item insert
      .mockReturnValueOnce(chainable([{ id: "wi-1", elementId: "WIT00000042" }]))
      // item insert
      .mockReturnValueOnce(
        chainable([
          {
            id: ITEM_ID,
            reviewId: REVIEW_ID,
            category: "findings",
            content: "3 überfällige Findings",
            actionWorkItemId: "wi-1",
            sortOrder: 2,
          },
        ]),
      );

    const { POST } = await import(ITEMS_ROUTE);
    const res = await POST(
      makeRequest(`http://localhost/api/v1/isms/reviews/${REVIEW_ID}/items`, {
        method: "POST",
        body: {
          category: "findings",
          content: "3 überfällige Findings",
          decision: "Nachverfolgung bis Q3",
          action: { title: "Findings abarbeiten", dueDate: "2026-09-30" },
        },
      }),
      { params: makeParams({ id: REVIEW_ID }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.actionWorkItemId).toBe("wi-1");
    expect(body.data.actionElementId).toBe("WIT00000042");
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });
});

describe("PUT/DELETE /api/v1/isms/reviews/[id]/items/[itemId]", () => {
  it("PUT returns 422 when the review is completed", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: REVIEW_ID, status: "completed" }]))
      .mockReturnValueOnce(
        chainable([{ id: ITEM_ID, actionWorkItemId: null }]),
      );
    const { PUT } = await import(ITEM_ROUTE);
    const res = await PUT(
      makeRequest(
        `http://localhost/api/v1/isms/reviews/${REVIEW_ID}/items/${ITEM_ID}`,
        { method: "PUT", body: { decision: "geändert" } },
      ),
      { params: makeParams({ id: REVIEW_ID, itemId: ITEM_ID }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Review is read-only");
  });

  it("PUT updates an item on an in_progress review", async () => {
    mockDb.select
      .mockReturnValueOnce(
        chainable([{ id: REVIEW_ID, status: "in_progress" }]),
      )
      .mockReturnValueOnce(
        chainable([{ id: ITEM_ID, actionWorkItemId: null }]),
      );
    mockDb.update.mockReturnValueOnce(
      chainable([{ id: ITEM_ID, decision: "Beschluss gefasst" }]),
    );
    const { PUT } = await import(ITEM_ROUTE);
    const res = await PUT(
      makeRequest(
        `http://localhost/api/v1/isms/reviews/${REVIEW_ID}/items/${ITEM_ID}`,
        { method: "PUT", body: { decision: "Beschluss gefasst" } },
      ),
      { params: makeParams({ id: REVIEW_ID, itemId: ITEM_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.decision).toBe("Beschluss gefasst");
  });

  it("DELETE returns 422 when the review is completed", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: REVIEW_ID, status: "completed" }]))
      .mockReturnValueOnce(
        chainable([{ id: ITEM_ID, actionWorkItemId: null }]),
      );
    const { DELETE } = await import(ITEM_ROUTE);
    const res = await DELETE(
      makeRequest(
        `http://localhost/api/v1/isms/reviews/${REVIEW_ID}/items/${ITEM_ID}`,
        { method: "DELETE" },
      ),
      { params: makeParams({ id: REVIEW_ID, itemId: ITEM_ID }) },
    );
    expect(res.status).toBe(422);
  });

  it("DELETE returns 404 when the item does not exist", async () => {
    mockDb.select
      .mockReturnValueOnce(
        chainable([{ id: REVIEW_ID, status: "in_progress" }]),
      )
      .mockReturnValueOnce(chainable([]));
    const { DELETE } = await import(ITEM_ROUTE);
    const res = await DELETE(
      makeRequest(
        `http://localhost/api/v1/isms/reviews/${REVIEW_ID}/items/${ITEM_ID}`,
        { method: "DELETE" },
      ),
      { params: makeParams({ id: REVIEW_ID, itemId: ITEM_ID }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/v1/isms/reviews/[id] — status transitions", () => {
  it("rejects planned → completed (422)", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([{ id: REVIEW_ID, status: "planned" }]),
    );
    const { PUT } = await import(REVIEW_ROUTE);
    const res = await PUT(
      makeRequest(`http://localhost/api/v1/isms/reviews/${REVIEW_ID}`, {
        method: "PUT",
        body: { status: "completed" },
      }),
      { params: makeParams({ id: REVIEW_ID }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Invalid status transition");
    expect(body.from).toBe("planned");
    expect(body.to).toBe("completed");
  });

  it("rejects any mutation of a completed review (422 read-only)", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([{ id: REVIEW_ID, status: "completed" }]),
    );
    const { PUT } = await import(REVIEW_ROUTE);
    const res = await PUT(
      makeRequest(`http://localhost/api/v1/isms/reviews/${REVIEW_ID}`, {
        method: "PUT",
        body: { title: "Umbenannt" },
      }),
      { params: makeParams({ id: REVIEW_ID }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Review is read-only");
  });

  it("allows in_progress → completed and sets completedAt", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([{ id: REVIEW_ID, status: "in_progress" }]),
    );
    mockDb.update.mockReturnValueOnce(
      chainable([{ id: REVIEW_ID, status: "completed" }]),
    );
    const { PUT } = await import(REVIEW_ROUTE);
    const res = await PUT(
      makeRequest(`http://localhost/api/v1/isms/reviews/${REVIEW_ID}`, {
        method: "PUT",
        body: { status: "completed" },
      }),
      { params: makeParams({ id: REVIEW_ID }) },
    );
    expect(res.status).toBe(200);
    // set() wurde mit completedAt aufgerufen
    const updateChain = mockDb.update.mock.results[0]?.value as {
      set: ReturnType<typeof vi.fn>;
    };
    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(setArg.completedAt).toBeInstanceOf(Date);
    expect(setArg.status).toBe("completed");
  });

  it("allows planned → in_progress", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([{ id: REVIEW_ID, status: "planned" }]),
    );
    mockDb.update.mockReturnValueOnce(
      chainable([{ id: REVIEW_ID, status: "in_progress" }]),
    );
    const { PUT } = await import(REVIEW_ROUTE);
    const res = await PUT(
      makeRequest(`http://localhost/api/v1/isms/reviews/${REVIEW_ID}`, {
        method: "PUT",
        body: { status: "in_progress" },
      }),
      { params: makeParams({ id: REVIEW_ID }) },
    );
    expect(res.status).toBe(200);
  });
});
