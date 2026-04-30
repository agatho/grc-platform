// Mock @grc/db with a stub for every known schema export.
// The full list is generated from packages/db/src/schema/*.ts (878 exports).

import { vi } from "vitest";
import { makeMockDb, type MockDb } from "./mock-db";
import { DB_SCHEMA_EXPORTS } from "./db-exports";

const dbState: { current: MockDb } = { current: makeMockDb() };

export function resetMockDb(): MockDb {
  dbState.current = makeMockDb();
  return dbState.current;
}

export function getMockDb(): MockDb {
  return dbState.current;
}

/** Builds a flat object with `db` + every documented schema export
 *  set to a generic table-stub. vitest's auto-export-check passes
 *  because all keys are real own-properties. */
export function dbMockFactory(): Record<string, unknown> {
  const tableStub: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_t, p) => (typeof p === "symbol" ? undefined : "x"),
    },
  );
  const out: Record<string, unknown> = {
    get db() {
      return dbState.current;
    },
  };
  for (const name of DB_SCHEMA_EXPORTS) {
    if (name === "db") continue;
    out[name] = tableStub;
  }
  return out;
}

/** Stub for @grc/email — most tests don't exercise actual email send. */
export const emailMockFactory = () => ({
  emailService: {
    send: vi.fn().mockResolvedValue({ ok: true, messageId: "test" }),
    sendBatch: vi.fn().mockResolvedValue({ ok: true }),
  },
});

/** Stub for @grc/events. */
export const eventsMockFactory = () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    subscribe: vi.fn(),
    onEvent: vi.fn(),
    offEvent: vi.fn(),
    emitEvent: vi.fn(),
  },
  emitEntityCreated: vi.fn(),
  emitEntityUpdated: vi.fn(),
  emitEntityDeleted: vi.fn(),
  emitEntityStatusChanged: vi.fn(),
  formatGenericPayload: vi.fn().mockReturnValue({}),
  formatSlackPayload: vi.fn().mockReturnValue({}),
  formatTeamsPayload: vi.fn().mockReturnValue({}),
  formatWebhookPayload: vi.fn().mockReturnValue({}),
  generateWebhookSecret: vi.fn().mockReturnValue({ secret: "x", hash: "x" }),
  hashSecret: vi.fn().mockReturnValue("x"),
  signPayload: vi.fn().mockReturnValue("sig"),
  verifySignature: vi.fn().mockReturnValue(true),
});

/** Stub for @grc/ai. */
export const aiMockFactory = () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0, 0, 0]),
  callLlm: vi.fn().mockResolvedValue({ content: "" }),
  routeRequest: vi.fn().mockResolvedValue({ content: "" }),
});

/** Stub for @grc/automation. */
export const automationMockFactory = () => ({
  AutomationEngine: class {
    constructor() {}
    subscribe = vi.fn();
    setActionServices = vi.fn();
    handleEvent = vi.fn().mockResolvedValue(undefined);
  },
});

/** Stub for @grc/graph. */
export const graphMockFactory = () => ({
  buildKnowledgeGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
  computeImpactAnalysis: vi.fn().mockResolvedValue([]),
});
