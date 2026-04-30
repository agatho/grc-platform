// Test-Helper für Drizzle-DB-Mocks in Cron-Job-Tests.
//
// Kein vollständiger ORM-Mock — wir mocken die *Resultate* der Drizzle-Queries
// und verifizieren die Cron-Logik.
//
// Pattern: vi.mock("@grc/db", ...) im Spec-File mit defineMockDb() vom Test.

import { vi } from "vitest";

/** Eine Drizzle-Query-Builder-Chain, die einen vorgegebenen Wert zurückliefert. */
export function chainable<T>(value: T) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "from",
    "where",
    "orderBy",
    "limit",
    "offset",
    "leftJoin",
    "rightJoin",
    "innerJoin",
    "groupBy",
    "having",
    "set",
    "values",
    "returning",
    "onConflictDoNothing",
    "onConflictDoUpdate",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Make the chain awaitable — terminal "execute" returns the value
  (chain as unknown as { then: unknown }).then = (resolve: (v: T) => void) =>
    resolve(value);
  (chain as unknown as { execute: unknown }).execute = vi
    .fn()
    .mockResolvedValue(value);
  return chain;
}

export interface MockDb {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
}

/**
 * Erzeugt einen leeren Mock-DB-Client. Per-Test mit
 *   db.select.mockReturnValueOnce(chainable([...]))
 * konfigurieren.
 */
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
