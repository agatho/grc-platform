// Domain RBAC suite — parametric coverage for 8 mutating Domain endpoints.
//
// Pattern: each row defines a route + its expected `withAuth(...)` role list
// + module key. The test imports the route and asserts:
//   - 401 when withAuth returns Unauthorized response
//   - 403 when withAuth returns Forbidden response
//   - withAuth was called with the documented role list
//   - requireModule was called with the documented module key (when present)
//
// Why parametric: writing the same boilerplate per endpoint is the bug surface
// itself — the role list drifts and we don't notice. A central spec table
// makes drift LOUD.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;
const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const withAuditContextMock = vi.fn();

vi.mock("@grc/db", () => {
  const tableProxy = new Proxy(
    {},
    {
      get: () => ({
        userId: "userId",
        orgId: "orgId",
        deletedAt: "deletedAt",
        id: "id",
      }),
    },
  );
  return new Proxy(
    {
      get db() {
        return mockDb;
      },
    },
    {
      get(target, prop) {
        if (prop === "db") return mockDb;
        return tableProxy;
      },
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
    return withAuditContextMock;
  },
  paginate: vi.fn(() => ({
    page: 1,
    limit: 10,
    offset: 0,
    searchParams: new URLSearchParams(),
  })),
  paginatedResponse: vi.fn((data: unknown, total: number) =>
    Response.json({ data, total, page: 1, limit: 10 }),
  ),
  // api-wrapper imports PaginationError; mock must export it for instanceof check.
  PaginationError: class PaginationError extends Error {},
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    isNull: noop,
    isNotNull: noop,
    count: noop,
    desc: noop,
    asc: noop,
    inArray: noop,
    sql: noop,
    ilike: noop,
    gte: noop,
    lte: noop,
    or: noop,
    not: noop,
    ne: noop,
  };
});

interface RouteSpec {
  /** Display name for the test description */
  name: string;
  /** Route module path relative to apps/web/src/app */
  routePath: string;
  /** HTTP method exported by the route */
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  /** Role list passed to withAuth(...) — this is the contract under test */
  expectedRoles: string[];
  /** Optional module key passed to requireModule */
  expectedModule?: string;
  /** URL path for the request (relative) */
  urlPath: string;
}

const SPECS: RouteSpec[] = [
  {
    name: "POST /api/v1/vendors",
    routePath: "../../app/api/v1/vendors/route",
    method: "POST",
    expectedRoles: ["admin", "risk_manager", "process_owner"],
    expectedModule: "tprm",
    urlPath: "/api/v1/vendors",
  },
  {
    name: "POST /api/v1/contracts",
    routePath: "../../app/api/v1/contracts/route",
    method: "POST",
    expectedRoles: ["admin", "risk_manager", "process_owner"],
    expectedModule: "contract",
    urlPath: "/api/v1/contracts",
  },
  {
    name: "POST /api/v1/findings",
    routePath: "../../app/api/v1/findings/route",
    method: "POST",
    // Findings can be raised by audit/risk/control/process roles
    expectedRoles: [
      "admin",
      "auditor",
      "risk_manager",
      "control_owner",
      "process_owner",
    ],
    urlPath: "/api/v1/findings",
  },
  {
    name: "POST /api/v1/dpms/dpia",
    routePath: "../../app/api/v1/dpms/dpia/route",
    method: "POST",
    expectedRoles: ["admin", "dpo"],
    expectedModule: "dpms",
    urlPath: "/api/v1/dpms/dpia",
  },
  {
    name: "POST /api/v1/dpms/dsr",
    routePath: "../../app/api/v1/dpms/dsr/route",
    method: "POST",
    expectedRoles: ["admin", "dpo"],
    expectedModule: "dpms",
    urlPath: "/api/v1/dpms/dsr",
  },
  {
    name: "POST /api/v1/dpms/ropa",
    routePath: "../../app/api/v1/dpms/ropa/route",
    method: "POST",
    expectedRoles: ["admin", "dpo"],
    expectedModule: "dpms",
    urlPath: "/api/v1/dpms/ropa",
  },
  {
    name: "POST /api/v1/bcms/bia",
    routePath: "../../app/api/v1/bcms/bia/route",
    method: "POST",
    expectedRoles: ["admin", "risk_manager"],
    expectedModule: "bcms",
    urlPath: "/api/v1/bcms/bia",
  },
  {
    name: "POST /api/v1/audit-mgmt/audits",
    routePath: "../../app/api/v1/audit-mgmt/audits/route",
    method: "POST",
    expectedRoles: ["admin", "auditor", "risk_manager"],
    expectedModule: "audit",
    urlPath: "/api/v1/audit-mgmt/audits",
  },
];

function makeReq(method: string, url: string): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

describe("Domain RBAC suite — parametric", () => {
  for (const spec of SPECS) {
    describe(spec.name, () => {
      beforeEach(() => {
        mockDb = makeMockDb();
        withAuthMock.mockReset();
        requireModuleMock.mockReset().mockResolvedValue(undefined);
        withAuditContextMock.mockReset();
      });

      it("returns 401 when not authenticated", async () => {
        withAuthMock.mockResolvedValue(
          Response.json({ error: "Unauthorized" }, { status: 401 }),
        );
        const mod = (await import(spec.routePath)) as Record<string, unknown>;
        const handler = mod[spec.method] as (req: Request) => Promise<Response>;
        expect(typeof handler).toBe("function");
        const res = await handler(makeReq(spec.method, spec.urlPath));
        expect(res.status).toBe(401);
      });

      it("calls withAuth with the documented role list", async () => {
        withAuthMock.mockResolvedValue(
          Response.json({ error: "Unauthorized" }, { status: 401 }),
        );
        const mod = (await import(spec.routePath)) as Record<string, unknown>;
        const handler = mod[spec.method] as (req: Request) => Promise<Response>;
        await handler(makeReq(spec.method, spec.urlPath));
        expect(withAuthMock).toHaveBeenCalledWith(...spec.expectedRoles);
      });

      it("returns 403 when role is rejected (e.g. viewer)", async () => {
        withAuthMock.mockResolvedValue(
          Response.json({ error: "Forbidden" }, { status: 403 }),
        );
        const mod = (await import(spec.routePath)) as Record<string, unknown>;
        const handler = mod[spec.method] as (req: Request) => Promise<Response>;
        const res = await handler(makeReq(spec.method, spec.urlPath));
        expect(res.status).toBe(403);
      });

      if (spec.expectedModule) {
        it(`enforces requireModule("${spec.expectedModule}") gate`, async () => {
          withAuthMock.mockResolvedValue({
            session: { user: { id: "user-1" } },
            orgId: "org-1",
            userId: "user-1",
          });
          requireModuleMock.mockResolvedValue(
            Response.json({ error: "Module disabled" }, { status: 404 }),
          );
          const mod = (await import(spec.routePath)) as Record<string, unknown>;
          const handler = mod[spec.method] as (
            req: Request,
          ) => Promise<Response>;
          const res = await handler(makeReq(spec.method, spec.urlPath));
          expect(res.status).toBe(404);
          // Module key check is the second argument
          const moduleCall = requireModuleMock.mock.calls[0];
          expect(moduleCall?.[0]).toBe(spec.expectedModule);
        });
      }
    });
  }
});
