// Standard report suite — GET /api/v1/reports/{risk-register,soa,
// compliance-status}. Verifies auth gating (401), org-scoped happy path
// with minimal mocked DB data, and the output contracts: Content-Type
// application/pdf with %PDF magic bytes, XLSX MIME with PK zip magic.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;
const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// RFC-4122-valid v4 UUID — zod v4's .uuid() enforces version/variant bits.
const FRAMEWORK_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("@grc/db", async () => {
  const { dbMockFactory } = await import("./helpers/db-proxy");
  const factory = dbMockFactory() as Record<string, unknown>;
  return new Proxy(factory, {
    get(target, prop) {
      if (prop === "db") return mockDb;
      return Reflect.get(target, prop);
    },
  });
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
  withAuditContext: vi.fn(),
  searchParamsToObject: (searchParams: URLSearchParams) => {
    const out: Record<string, string> = {};
    for (const [key, value] of searchParams) {
      if (value !== "") out[key] = value;
    }
    return out;
  },
  paginate: vi.fn(() => ({
    page: 1,
    limit: 10,
    offset: 0,
    searchParams: new URLSearchParams(),
  })),
  paginatedResponse: vi.fn(),
  // api-wrapper imports PaginationError; mock must export it.
  PaginationError: class PaginationError extends Error {},
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    isNull: noop,
    count: noop,
    desc: noop,
    asc: noop,
    sql: noop,
    inArray: noop,
  };
});

/** Queue db.select() results in call order; the last value repeats. */
function sequenceSelect(results: unknown[][]): void {
  let call = 0;
  mockDb.select.mockImplementation(() => {
    const value = results[Math.min(call, results.length - 1)];
    call++;
    return chainable(value);
  });
}

function authOk(): void {
  withAuthMock.mockResolvedValue({
    session: { user: { id: "user-1", email: "u@example.com", name: "U" } },
    orgId: "org-1",
    userId: "user-1",
  });
  requireModuleMock.mockResolvedValue(undefined);
}

async function expectPdf(res: Response): Promise<void> {
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Type")).toBe("application/pdf");
  const bytes = Buffer.from(await res.arrayBuffer());
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
}

async function expectXlsx(res: Response): Promise<void> {
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Type")).toBe(XLSX_MIME);
  const bytes = Buffer.from(await res.arrayBuffer());
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
}

beforeEach(() => {
  mockDb = makeMockDb();
  withAuthMock.mockReset();
  requireModuleMock.mockReset();
});

// ─── Risk register ───────────────────────────────────────────────

describe("GET /api/v1/reports/risk-register", () => {
  const riskRow = {
    id: "risk-1",
    elementId: "RSK00000001",
    title: "Cross-tenant data leak",
    category: "cyber",
    status: "assessed",
    scoreInherent: 16,
    scoreResidual: 8,
    ownerName: "L. Schneider",
    reviewDate: "2026-09-01",
  };
  const brandingRow = {
    orgName: "Meridian Holdings GmbH",
    primaryColor: "#1e3a5f",
    confidentialityNotice: "VERTRAULICH",
    logoPath: null,
  };

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../../app/api/v1/reports/risk-register/route");
    const res = await GET(
      new Request("http://localhost/api/v1/reports/risk-register"),
      undefined,
    );
    expect(res.status).toBe(401);
  });

  it("returns a PDF with %PDF magic bytes", async () => {
    authOk();
    // select #1 risks, #2 treatment counts, #3 branding
    sequenceSelect([[riskRow], [{ riskId: "risk-1", value: 2 }], [brandingRow]]);
    const { GET } = await import("../../app/api/v1/reports/risk-register/route");
    const res = await GET(
      new Request(
        "http://localhost/api/v1/reports/risk-register?format=pdf&status=assessed",
      ),
      undefined,
    );
    await expectPdf(res);
  });

  it("returns an XLSX workbook with PK magic bytes", async () => {
    authOk();
    sequenceSelect([[riskRow], [], [brandingRow]]);
    const { GET } = await import("../../app/api/v1/reports/risk-register/route");
    const res = await GET(
      new Request("http://localhost/api/v1/reports/risk-register?format=xlsx"),
      undefined,
    );
    await expectXlsx(res);
  });
});

// ─── Statement of Applicability ──────────────────────────────────

describe("GET /api/v1/reports/soa", () => {
  const framework = { id: FRAMEWORK_ID, name: "ISO 27001 Annex A", version: "2022" };
  const entryRow = {
    id: "entry-1",
    code: "A.5.1",
    name: "Policies for information security",
    nameDe: "Informationssicherheitsrichtlinien",
    level: 1,
  };
  const soaRow = {
    catalogEntryId: "entry-1",
    applicability: "applicable",
    justification: "Contractual requirement",
    implementation: "implemented",
    notes: null,
    lastReviewed: null,
    controlTitle: "IS policy control",
    responsibleName: "Alice",
  };

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../../app/api/v1/reports/soa/route");
    const res = await GET(
      new Request(
        `http://localhost/api/v1/reports/soa?frameworkId=${FRAMEWORK_ID}`,
      ),
      undefined,
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when the framework does not exist", async () => {
    authOk();
    sequenceSelect([[]]);
    const { GET } = await import("../../app/api/v1/reports/soa/route");
    const res = await GET(
      new Request(
        `http://localhost/api/v1/reports/soa?frameworkId=${FRAMEWORK_ID}`,
      ),
      undefined,
    );
    expect(res.status).toBe(404);
  });

  it("returns a PDF with %PDF magic bytes", async () => {
    authOk();
    // select #1 framework, #2 entries, #3 soa rows, #4 branding
    sequenceSelect([[framework], [entryRow], [soaRow], []]);
    const { GET } = await import("../../app/api/v1/reports/soa/route");
    const res = await GET(
      new Request(
        `http://localhost/api/v1/reports/soa?frameworkId=${FRAMEWORK_ID}&format=pdf`,
      ),
      undefined,
    );
    await expectPdf(res);
  });

  it("returns an XLSX workbook with PK magic bytes", async () => {
    authOk();
    sequenceSelect([[framework], [entryRow], [soaRow], []]);
    const { GET } = await import("../../app/api/v1/reports/soa/route");
    const res = await GET(
      new Request(
        `http://localhost/api/v1/reports/soa?frameworkId=${FRAMEWORK_ID}&format=xlsx`,
      ),
      undefined,
    );
    await expectXlsx(res);
  });
});

// ─── Compliance status ───────────────────────────────────────────

describe("GET /api/v1/reports/compliance-status", () => {
  const framework = { id: FRAMEWORK_ID, name: "ISO 27001 Annex A", version: "2022" };
  const chapter = {
    id: "chap-1",
    parentEntryId: null,
    code: "A.5",
    name: "Organizational controls",
    nameDe: "Organisatorische Kontrollen",
    level: 0,
  };
  const leaf = {
    id: "entry-1",
    parentEntryId: "chap-1",
    code: "A.5.1",
    name: "Policies for information security",
    nameDe: "Informationssicherheitsrichtlinien",
    level: 1,
  };
  const soaRow = {
    catalogEntryId: "entry-1",
    applicability: "applicable",
    implementation: "partially_implemented",
    notes: "Rollout ongoing",
    responsibleName: "Bob",
  };

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import(
      "../../app/api/v1/reports/compliance-status/route"
    );
    const res = await GET(
      new Request(
        `http://localhost/api/v1/reports/compliance-status?frameworkId=${FRAMEWORK_ID}`,
      ),
      undefined,
    );
    expect(res.status).toBe(401);
  });

  it("returns a PDF with %PDF magic bytes", async () => {
    authOk();
    // select #1 framework, #2 entries, #3 soa rows, #4 branding
    sequenceSelect([[framework], [chapter, leaf], [soaRow], []]);
    const { GET } = await import(
      "../../app/api/v1/reports/compliance-status/route"
    );
    const res = await GET(
      new Request(
        `http://localhost/api/v1/reports/compliance-status?frameworkId=${FRAMEWORK_ID}&format=pdf`,
      ),
      undefined,
    );
    await expectPdf(res);
  });

  it("returns an XLSX workbook with PK magic bytes", async () => {
    authOk();
    sequenceSelect([[framework], [chapter, leaf], [soaRow], []]);
    const { GET } = await import(
      "../../app/api/v1/reports/compliance-status/route"
    );
    const res = await GET(
      new Request(
        `http://localhost/api/v1/reports/compliance-status?frameworkId=${FRAMEWORK_ID}&format=xlsx`,
      ),
      undefined,
    );
    await expectXlsx(res);
  });
});
