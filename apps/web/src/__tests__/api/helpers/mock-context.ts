// Test helpers for API route tests.
// Builds mock Request objects + reusable auth/db mocks.

import { vi } from "vitest";

/** Create a mock Request — Web API style, accepted by Next.js route handlers. */
export function makeRequest(
  url: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Request {
  const opts: RequestInit = {
    method: init.method ?? "GET",
    headers: init.headers ?? {},
  };
  if (init.body !== undefined) {
    opts.body =
      typeof init.body === "string" ? init.body : JSON.stringify(init.body);
    opts.headers = {
      "content-type": "application/json",
      ...(opts.headers ?? {}),
    };
  }
  return new Request(url, opts);
}

/** Build params Promise for Next.js dynamic routes. */
export function makeParams<T extends Record<string, string>>(
  obj: T,
): Promise<T> {
  return Promise.resolve(obj);
}

export interface MockApiContext {
  session: { user: { id: string; email: string } };
  orgId: string;
  userId: string;
}

export const DEFAULT_AUTH_CTX: MockApiContext = {
  session: { user: { id: "user-1", email: "test@example.com" } },
  orgId: "org-1",
  userId: "user-1",
};

/** Drizzle chainable that resolves to a value. */
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
    "groupBy",
    "set",
    "values",
    "returning",
    "onConflictDoNothing",
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

export interface MockDb {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
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
