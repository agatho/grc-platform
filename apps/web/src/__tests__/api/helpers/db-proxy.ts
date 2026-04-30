// Mock @grc/db with a stub for every known schema export.
// Mirrors apps/worker/tests/helpers/db-proxy.ts but local to the web app.

import { vi } from "vitest";

interface MockDb {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
}

export function chainable<T>(value: T) {
  const chain: Record<string, unknown> = {};
  for (const m of [
    "from",
    "where",
    "orderBy",
    "limit",
    "offset",
    "leftJoin",
    "innerJoin",
    "rightJoin",
    "groupBy",
    "having",
    "set",
    "values",
    "returning",
    "onConflictDoNothing",
    "onConflictDoUpdate",
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  (chain as unknown as { then: unknown }).then = (resolve: (v: T) => void) =>
    resolve(value);
  (chain as unknown as { execute: unknown }).execute = vi
    .fn()
    .mockResolvedValue(value);
  return chain;
}

export function makeMockDb(): MockDb {
  const db: MockDb = {
    select: vi.fn(() => chainable([])),
    update: vi.fn(() => chainable([])),
    insert: vi.fn(() => chainable([])),
    delete: vi.fn(() => chainable([])),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(async (cb: (tx: MockDb) => Promise<unknown>) => cb(db)),
  };
  return db;
}

const dbState: { current: MockDb } = { current: makeMockDb() };
export function resetMockDb(): MockDb {
  dbState.current = makeMockDb();
  return dbState.current;
}
export function getMockDb(): MockDb {
  return dbState.current;
}

/** Build a flat module export with `db` + every Drizzle table stubbed.
 *  Use as: vi.mock("@grc/db", async () => { const { dbMockFactory } = await import("./helpers/db-proxy"); return dbMockFactory(); }); */
export function dbMockFactory(): Record<string, unknown> {
  const tableStub: Record<string, unknown> = new Proxy(
    {},
    { get: (_t, p) => (typeof p === "symbol" ? undefined : "x") },
  );
  return new Proxy(
    { db: dbState.current },
    {
      get(target, prop) {
        if (prop === "db") return dbState.current;
        if (prop === "__esModule") return true;
        if (typeof prop === "symbol") {
          return (target as Record<symbol, unknown>)[prop];
        }
        return tableStub;
      },
      has(_target, prop) {
        return typeof prop === "string";
      },
      ownKeys() {
        return ["db", "__esModule"];
      },
      getOwnPropertyDescriptor(target, prop) {
        if (prop === "db") {
          return {
            enumerable: true,
            configurable: true,
            value: dbState.current,
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
    },
  );
}
