// /dms/documents canonical alias (Wave-21-B5)
//
// Wave-21 QA reported that /api/v1/dms/documents returned 404 even
// though /api/v1/documents worked. This test pins the alias contract:
// the new /dms/documents path re-exports the same GET + POST handlers
// from /documents/route.ts, so both URLs serve the same data with no
// behavior drift.

import { describe, it, expect, vi } from "vitest";

vi.mock("@grc/db", () => ({
  get db() {
    return {
      select() {
        return {
          from() {
            return {
              where() {
                return Promise.resolve([]);
              },
              leftJoin() {
                return {
                  leftJoin() {
                    return {
                      where() {
                        return {
                          orderBy() {
                            return { limit: () => ({ offset: () => [] }) };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    };
  },
  document: {},
  documentVersion: {},
  workItem: {},
  user: {},
  userOrganizationRole: {},
  notification: {},
}));

vi.mock("@grc/auth", () => ({
  requireModule: vi.fn(async () => undefined),
}));

vi.mock("@/lib/api", () => ({
  withAuth: vi.fn(async () => ({
    session: { user: { id: "u" } },
    orgId: "o",
    userId: "u",
  })),
  withAuditContext: vi.fn(),
  paginate: vi.fn(() => ({
    page: 1,
    limit: 10,
    offset: 0,
    searchParams: new URLSearchParams(),
  })),
  paginatedResponse: vi.fn((data: unknown, total: number) =>
    Response.json({ data, total }),
  ),
  PaginationError: class extends Error {},
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
    inArray: noop,
    ilike: noop,
    or: noop,
    sql: noop,
  };
});

describe("/api/v1/dms/documents canonical alias (Wave-21-B5)", () => {
  it("re-exports the same GET handler as /documents/route.ts", async () => {
    const original = await import("../../app/api/v1/documents/route");
    const alias = await import("../../app/api/v1/dms/documents/route");
    // The alias module re-exports the same function references — proving
    // there's no implementation drift.
    expect(alias.GET).toBe(original.GET);
    expect(alias.POST).toBe(original.POST);
  });

  it("alias route module loads + exports a function (not 404)", async () => {
    // The alias module exists and exports GET + POST. If Next.js
    // routing finds /dms/documents/route.ts the path is reachable;
    // a 404 would happen only if the file weren't there.
    const mod = await import("../../app/api/v1/dms/documents/route");
    expect(typeof mod.GET).toBe("function");
    expect(typeof mod.POST).toBe("function");
  });
});
