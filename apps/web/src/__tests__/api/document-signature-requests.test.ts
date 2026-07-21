// API tests for the multi-signer document e-signature workflow
// (W21-DMS-MULTISIGN-01).
//
// Contract under test:
//   - 401 when unauthenticated (withAuth short-circuits)
//   - POST /documents/[id]/signature-requests: 404 unknown doc,
//     422 doc without file, 201 happy path (sequential → only the
//     first signer is notified)
//   - POST /signature-requests/[id]/sign: 403 foreign user,
//     409 sequential order violation, 422 fileSha256 mismatch,
//     201 last signer → request completed + creator notified,
//     chain link anchored to the previous chain hash
//   - POST /signature-requests/[id]/decline: 422 missing reason,
//     201 → request declined
//   - GET /signature-requests/[id]/certificate: application/pdf with
//     %PDF magic bytes

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────

// FIFO of rows returned by consecutive db.select() calls.
const selectQueue: unknown[][] = [];

function chainable(value: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const m of [
    "from",
    "where",
    "orderBy",
    "limit",
    "leftJoin",
    "innerJoin",
  ]) {
    chain[m] = () => chain;
  }
  (chain as { then?: unknown }).then = (resolve: (v: unknown[]) => void) =>
    resolve(value);
  return chain;
}

vi.mock("@grc/db", () => ({
  db: {
    select: () => chainable(selectQueue.shift() ?? []),
    execute: vi.fn(async () => []),
  },
  document: {},
  documentVersion: {},
  documentSignature: {},
  documentSignatureRequest: {},
  notification: {},
  user: {},
  userOrganizationRole: {},
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    or: noop,
    isNull: noop,
    asc: noop,
    desc: noop,
    inArray: noop,
    sql: Object.assign(noop, { raw: noop }),
  };
});

vi.mock("@grc/auth", () => ({
  requireModule: vi.fn(async () => undefined),
}));

// Captured tx mutations + configurable returning() results.
const inserted: Array<{ table: unknown; values: unknown }> = [];
const updated: Array<{ table: unknown; set: unknown }> = [];
const insertReturning: unknown[][] = [];
const updateReturning: unknown[][] = [];

function txThenable(result: unknown[]) {
  const chain: Record<string, unknown> = {
    where: () => chain,
    returning: async () => result,
  };
  (chain as { then?: unknown }).then = (resolve: (v: unknown[]) => void) =>
    resolve(result);
  return chain;
}

const txMock = {
  insert: (table: unknown) => ({
    values: (vals: unknown) => {
      inserted.push({ table, values: vals });
      return txThenable(insertReturning.shift() ?? []);
    },
  }),
  update: (table: unknown) => ({
    set: (vals: unknown) => {
      updated.push({ table, set: vals });
      return txThenable(updateReturning.shift() ?? []);
    },
  }),
};

let authResult: unknown = null; // set in beforeEach

vi.mock("@/lib/api", () => ({
  withAuth: vi.fn(async () => authResult),
  withAuditContext: vi.fn(
    async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(txMock),
  ),
}));

import { POST as createRequest } from "../../app/api/v1/documents/[id]/signature-requests/route";
import { POST as signRoute } from "../../app/api/v1/signature-requests/[requestId]/sign/route";
import { POST as declineRoute } from "../../app/api/v1/signature-requests/[requestId]/decline/route";
import { GET as certificateRoute } from "../../app/api/v1/signature-requests/[requestId]/certificate/route";
import {
  documentSignatureRequest,
  documentSignature,
  notification,
} from "@grc/db";

// ─── Fixtures ───────────────────────────────────────────────────────

const ME = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER = "bbbbbbbb-0000-4000-8000-000000000002";
const CREATOR = "cccccccc-0000-4000-8000-000000000003";
const SHA = "a".repeat(64);

function makeCtx() {
  return {
    session: {
      user: {
        id: ME,
        name: "Max Mustermann",
        email: "max@example.com",
        roles: [{ orgId: "org-1", role: "admin" }],
      },
    },
    orgId: "org-1",
    userId: ME,
  };
}

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    orgId: "org-1",
    documentId: "doc-1",
    versionId: "ver-1",
    fileSha256: SHA,
    title: "IS-Richtlinie",
    message: null,
    status: "pending",
    sequential: false,
    dueDate: null,
    completedAt: null,
    createdBy: CREATOR,
    createdAt: new Date("2026-07-10T08:00:00.000Z"),
    ...overrides,
  };
}

function sigRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sig-1",
    orgId: "org-1",
    requestId: "req-1",
    signerUserId: ME,
    signOrder: 1,
    status: "pending",
    signedAt: null,
    declineReason: null,
    contentHash: null,
    previousChainHash: null,
    chainHash: null,
    ipAddress: null,
    userAgent: null,
    ...overrides,
  };
}

function jsonRequest(url: string, body?: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.7",
      "user-agent": "vitest",
    },
    body: JSON.stringify(body ?? {}),
  });
}

beforeEach(() => {
  selectQueue.length = 0;
  inserted.length = 0;
  updated.length = 0;
  insertReturning.length = 0;
  updateReturning.length = 0;
  authResult = makeCtx();
});

// ─── POST /documents/[id]/signature-requests ────────────────────────

describe("POST /documents/[id]/signature-requests", () => {
  const call = (body: unknown) =>
    createRequest(
      jsonRequest(
        "http://localhost/api/v1/documents/doc-1/signature-requests",
        body,
      ),
      { params: Promise.resolve({ id: "doc-1" }) },
    );

  it("returns 401 when unauthenticated", async () => {
    authResult = Response.json({ error: "Unauthorized" }, { status: 401 });
    const res = await call({ signers: [OTHER] });
    expect(res.status).toBe(401);
  });

  it("returns 422 for an invalid body", async () => {
    const res = await call({ signers: [] });
    expect(res.status).toBe(422);
  });

  it("returns 404 for an unknown document", async () => {
    selectQueue.push([]); // document lookup
    const res = await call({ signers: [OTHER] });
    expect(res.status).toBe(404);
  });

  it("returns 422 when the document has no signable file", async () => {
    selectQueue.push([{ id: "doc-1", title: "Doc", fileSha256: null }]);
    selectQueue.push([]); // no current version
    const res = await call({ signers: [OTHER] });
    expect(res.status).toBe(422);
  });

  it("returns 422 when a signer is not an org member", async () => {
    selectQueue.push([{ id: "doc-1", title: "Doc", fileSha256: SHA }]);
    selectQueue.push([{ id: "ver-1", fileSha256: SHA }]);
    selectQueue.push([]); // membership lookup: nobody found
    const res = await call({ signers: [OTHER] });
    expect(res.status).toBe(422);
  });

  it("creates the request and notifies only the first signer when sequential", async () => {
    selectQueue.push([{ id: "doc-1", title: "Doc", fileSha256: SHA }]);
    selectQueue.push([{ id: "ver-1", fileSha256: SHA }]);
    selectQueue.push([{ userId: OTHER }, { userId: CREATOR }]);
    insertReturning.push([requestRow({ createdBy: ME })]); // request insert
    insertReturning.push([
      sigRow({ id: "sig-1", signerUserId: OTHER, signOrder: 1 }),
      sigRow({ id: "sig-2", signerUserId: CREATOR, signOrder: 2 }),
    ]);

    const res = await call({ signers: [OTHER, CREATOR], sequential: true });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.request.id).toBe("req-1");
    expect(body.data.signatures).toHaveLength(2);

    const notifications = inserted.filter((i) => i.table === notification);
    expect(notifications).toHaveLength(1);
    expect((notifications[0].values as { userId: string }).userId).toBe(OTHER);
  });
});

// ─── POST /signature-requests/[id]/sign ─────────────────────────────

describe("POST /signature-requests/[id]/sign", () => {
  const call = () =>
    signRoute(
      jsonRequest("http://localhost/api/v1/signature-requests/req-1/sign"),
      { params: Promise.resolve({ requestId: "req-1" }) },
    );

  it("returns 401 when unauthenticated", async () => {
    authResult = Response.json({ error: "Unauthorized" }, { status: 401 });
    const res = await call();
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown request", async () => {
    selectQueue.push([]); // request lookup
    const res = await call();
    expect(res.status).toBe(404);
  });

  it("returns 403 when the caller is not a signer", async () => {
    selectQueue.push([requestRow()]);
    selectQueue.push([sigRow({ signerUserId: OTHER })]);
    const res = await call();
    expect(res.status).toBe(403);
  });

  it("returns 409 when the request is no longer pending", async () => {
    selectQueue.push([requestRow({ status: "cancelled" })]);
    selectQueue.push([sigRow()]);
    const res = await call();
    expect(res.status).toBe(409);
  });

  it("enforces sequential order with 409", async () => {
    selectQueue.push([requestRow({ sequential: true })]);
    selectQueue.push([
      sigRow({ id: "sig-1", signerUserId: OTHER, signOrder: 1 }),
      sigRow({ id: "sig-2", signerUserId: ME, signOrder: 2 }),
    ]);
    const res = await call();
    expect(res.status).toBe(409);
  });

  it("returns 422 when the file hash no longer matches the frozen hash", async () => {
    selectQueue.push([requestRow()]);
    selectQueue.push([sigRow()]);
    selectQueue.push([{ versionSha: "b".repeat(64), docSha: null }]);
    const res = await call();
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("integrity");
  });

  it("signs as last signer → chain link anchored, request completed, creator notified", async () => {
    const previousChainHash = "f".repeat(64);
    selectQueue.push([requestRow()]);
    selectQueue.push([
      sigRow({
        id: "sig-other",
        signerUserId: OTHER,
        signOrder: 1,
        status: "signed",
        signedAt: new Date("2026-07-11T09:00:00.000Z"),
        contentHash: "e".repeat(64),
        previousChainHash: null,
        chainHash: previousChainHash,
      }),
      sigRow({ id: "sig-me", signerUserId: ME, signOrder: 2 }),
    ]);
    selectQueue.push([{ versionSha: SHA, docSha: null }]);
    updateReturning.push([
      sigRow({ id: "sig-me", signerUserId: ME, status: "signed" }),
    ]);

    const res = await call();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.requestCompleted).toBe(true);

    // Chain link: previous_chain_hash anchors to the earlier signature.
    const sigUpdate = updated.find((u) => u.table === documentSignature);
    expect(sigUpdate).toBeDefined();
    const set = sigUpdate!.set as {
      status: string;
      contentHash: string;
      previousChainHash: string | null;
      chainHash: string;
      ipAddress: string;
    };
    expect(set.status).toBe("signed");
    expect(set.previousChainHash).toBe(previousChainHash);
    expect(set.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(set.chainHash).toMatch(/^[0-9a-f]{64}$/);
    expect(set.ipAddress).toBe("203.0.113.7");

    // Request completed
    const reqUpdate = updated.find((u) => u.table === documentSignatureRequest);
    expect((reqUpdate!.set as { status: string }).status).toBe("completed");

    // Creator notified
    const notifications = inserted.filter((i) => i.table === notification);
    expect(notifications).toHaveLength(1);
    expect((notifications[0].values as { userId: string }).userId).toBe(
      CREATOR,
    );
  });
});

// ─── POST /signature-requests/[id]/decline ──────────────────────────

describe("POST /signature-requests/[id]/decline", () => {
  const call = (body?: unknown) =>
    declineRoute(
      jsonRequest(
        "http://localhost/api/v1/signature-requests/req-1/decline",
        body,
      ),
      { params: Promise.resolve({ requestId: "req-1" }) },
    );

  it("returns 422 without a reason", async () => {
    const res = await call({});
    expect(res.status).toBe(422);
  });

  it("declines with a reason → request declined + chain link written", async () => {
    selectQueue.push([requestRow()]);
    selectQueue.push([sigRow()]);
    updateReturning.push([
      sigRow({ status: "declined", declineReason: "Inhaltlich falsch" }),
    ]);

    const res = await call({ reason: "Inhaltlich falsch" });
    expect(res.status).toBe(201);

    const sigUpdate = updated.find((u) => u.table === documentSignature);
    const set = sigUpdate!.set as {
      status: string;
      declineReason: string;
      contentHash: string;
    };
    expect(set.status).toBe("declined");
    expect(set.declineReason).toBe("Inhaltlich falsch");
    expect(set.contentHash).toMatch(/^[0-9a-f]{64}$/);

    const reqUpdate = updated.find((u) => u.table === documentSignatureRequest);
    expect((reqUpdate!.set as { status: string }).status).toBe("declined");
  });
});

// ─── GET /signature-requests/[id]/certificate ───────────────────────

describe("GET /signature-requests/[id]/certificate", () => {
  it("renders a valid PDF certificate (%PDF magic bytes)", async () => {
    selectQueue.push([
      {
        req: requestRow({ status: "completed" }),
        documentTitle: "IS-Richtlinie",
        docSha: null,
        versionLabel: "3.0",
        versionSha: SHA,
      },
    ]);
    selectQueue.push([
      {
        sig: sigRow({
          status: "signed",
          signedAt: new Date("2026-07-11T09:00:00.000Z"),
          contentHash: "e".repeat(64),
          previousChainHash: null,
          chainHash: "f".repeat(64),
          ipAddress: "203.0.113.7",
        }),
        signerName: "Max Mustermann",
      },
    ]);

    const res = await certificateRoute(
      new Request(
        "http://localhost/api/v1/signature-requests/req-1/certificate",
      ),
      { params: Promise.resolve({ requestId: "req-1" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("returns 404 for an unknown request", async () => {
    selectQueue.push([]);
    const res = await certificateRoute(
      new Request(
        "http://localhost/api/v1/signature-requests/req-1/certificate",
      ),
      { params: Promise.resolve({ requestId: "req-1" }) },
    );
    expect(res.status).toBe(404);
  });
});
