// control-embedding-sync cron (migration 0377).
//
// Covers: clean skip without a configured embedding provider, batch
// processing with mocked DB + mocked embedding call, per-item error
// handling, and the pure content-hash invalidation logic from
// @grc/shared (which must stay in sync with the cron's SQL twin).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "crypto";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";
import {
  controlEmbeddingContentHash,
  controlEmbeddingText,
  embeddingNeedsRefresh,
} from "@grc/shared";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  // [WP11 · S11-09] WP6 rebuilt this cron to iterate organisations and pin
  // every read to an org context (S05-08). The mock has to carry both, or the
  // cron dies on `organization.id` / `withOrgReadContext is not a function`
  // before a single assertion runs.
  organization: { id: "x", deletedAt: "x" },
  withOrgReadContext: (_orgId: string, fn: (tx: unknown) => unknown) =>
    Promise.resolve(fn(mockDb)),
  control: {
    id: "x",
    orgId: "x",
    title: "x",
    description: "x",
    deletedAt: "x",
  },
  controlEmbedding: {
    id: "x",
    orgId: "x",
    controlId: "x",
    embedding: "x",
    contentHash: "x",
    model: "x",
    updatedAt: "x",
  },
}));

const getEmbeddingProviderMock = vi.fn();
const generateEmbeddingMock = vi.fn();
const loadOrgAiPolicyMock = vi.fn();

// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09] Spread the real module. WP6 added
// `providerPlacements()` / `localModelRegion()` (the S05-01 jurisdiction table)
// and the cron calls them; the hand-written mock listed only two exports, so
// all three behavioural tests in this file died with "No 'providerPlacements'
// export is defined on the '@grc/ai' mock" instead of testing anything. Only
// the two functions with side effects stay stubbed.
vi.mock("@grc/ai", async () => {
  const actual = await vi.importActual<typeof import("@grc/ai")>("@grc/ai");
  return {
    ...actual,
    get getEmbeddingProvider() {
      return getEmbeddingProviderMock;
    },
    get generateEmbedding() {
      return generateEmbeddingMock;
    },
    get loadOrgAiPolicy() {
      return loadOrgAiPolicyMock;
    },
  };
});

const PROVIDER = { provider: "ollama" as const, model: "nomic-embed-text" };
const OPENAI_PROVIDER = {
  provider: "openai" as const,
  model: "text-embedding-3-small",
};

const ORGS = [{ id: "org-1" }];

const controls = [
  {
    id: "ctl-1",
    orgId: "org-1",
    title: "Endpoint Detection and Response",
    description: "EDR on all endpoints",
  },
  {
    id: "ctl-2",
    orgId: "org-1",
    title: "Offline Backups",
    description: null,
  },
];

/** Queue the two selects the cron makes per org: org list, then candidates. */
function queueSelects(orgs: unknown[], candidates: unknown[]) {
  mockDb.select
    .mockReturnValueOnce(chainable(orgs))
    .mockReturnValueOnce(chainable(candidates));
}

async function run() {
  const { processControlEmbeddingSync } =
    await import("../../src/crons/control-embedding-sync");
  return processControlEmbeddingSync();
}

interface SyncResult {
  skipped: boolean;
  degraded: boolean;
  orgsTotal: number;
  orgsProcessed: number;
  orgsPolicyBlocked: number;
  candidates: number;
  processed: number;
  errors: number;
  model?: string;
  reason?: string;
}

describe("processControlEmbeddingSync", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    getEmbeddingProviderMock.mockReset();
    generateEmbeddingMock.mockReset();
    loadOrgAiPolicyMock.mockReset();
    loadOrgAiPolicyMock.mockResolvedValue({ egressMode: "any_configured" });
  });

  it("skips cleanly when no embedding provider is configured", async () => {
    getEmbeddingProviderMock.mockReturnValue(null);
    const r = (await run()) as SyncResult;
    expect(r.skipped).toBe(true);
    expect(r.degraded).toBe(false);
    expect(r.processed).toBe(0);
    expect(r.reason).toBe("no_embedding_provider_configured");
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(generateEmbeddingMock).not.toHaveBeenCalled();
  });

  it("embeds every candidate and upserts with the matching content hash", async () => {
    getEmbeddingProviderMock.mockReturnValue(PROVIDER);
    generateEmbeddingMock.mockResolvedValue([0.1, 0.2, 0.3]);
    queueSelects(ORGS, controls);

    const r = (await run()) as SyncResult;
    expect(r.skipped).toBe(false);
    expect(r.degraded).toBe(false);
    expect(r.orgsTotal).toBe(1);
    expect(r.orgsProcessed).toBe(1);
    expect(r.orgsPolicyBlocked).toBe(0);
    expect(r.candidates).toBe(2);
    expect(r.processed).toBe(2);
    expect(r.errors).toBe(0);
    expect(r.model).toBe("nomic-embed-text");

    // Embedding is generated over the canonical text (title\ndescription).
    expect(generateEmbeddingMock).toHaveBeenCalledWith(
      "Endpoint Detection and Response\nEDR on all endpoints",
      PROVIDER,
    );
    expect(generateEmbeddingMock).toHaveBeenCalledWith(
      "Offline Backups\n",
      PROVIDER,
    );

    expect(mockDb.insert).toHaveBeenCalledTimes(2);
    const firstPayload = (
      mockDb.insert.mock.results[0]!.value as {
        values: ReturnType<typeof vi.fn>;
      }
    ).values.mock.calls[0]![0] as {
      controlId: string;
      contentHash: string;
      model: string;
      embedding: number[];
    };
    expect(firstPayload.controlId).toBe("ctl-1");
    expect(firstPayload.model).toBe("nomic-embed-text");
    expect(firstPayload.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(firstPayload.contentHash).toBe(
      controlEmbeddingContentHash(
        "Endpoint Detection and Response",
        "EDR on all endpoints",
      ),
    );
  });

  // [WP11 · S11-09] S05-07 is the reason this cron was rewritten: control
  // titles carry names of owners and org units, so a policy demanding local
  // processing must stop a third-country embedding provider. These two tests
  // are the ones that would have caught the audit finding.
  it("does not send control text to a third-country provider when the org policy forbids it", async () => {
    getEmbeddingProviderMock.mockReturnValue(OPENAI_PROVIDER);
    loadOrgAiPolicyMock.mockResolvedValue({ egressMode: "eu_only" });
    queueSelects(ORGS, controls);

    const r = (await run()) as SyncResult;
    expect(generateEmbeddingMock).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(r.orgsPolicyBlocked).toBe(1);
    expect(r.orgsProcessed).toBe(0);
    expect(r.processed).toBe(0);
    // Every org was blocked by policy — that is a correct run, not a failure.
    expect(r.degraded).toBe(false);
  });

  it("embeds nothing at all for an org with AI egress disabled", async () => {
    getEmbeddingProviderMock.mockReturnValue(PROVIDER);
    loadOrgAiPolicyMock.mockResolvedValue({ egressMode: "disabled" });
    queueSelects(ORGS, controls);

    const r = (await run()) as SyncResult;
    expect(generateEmbeddingMock).not.toHaveBeenCalled();
    expect(r.orgsPolicyBlocked).toBe(1);
    expect(r.candidates).toBe(0);
  });

  it("still embeds locally when the policy demands local processing", async () => {
    getEmbeddingProviderMock.mockReturnValue(PROVIDER); // ollama = local
    loadOrgAiPolicyMock.mockResolvedValue({ egressMode: "local_only" });
    generateEmbeddingMock.mockResolvedValue([0.5]);
    queueSelects(ORGS, controls);

    const r = (await run()) as SyncResult;
    expect(r.orgsPolicyBlocked).toBe(0);
    expect(r.processed).toBe(2);
  });

  // [WP11 · S11-09] S05-08: a run that could not process a single org used to
  // report `skipped: true`, which the instrumentation booked as success. It
  // must now report `degraded`.
  it("reports degraded — not skipped — when no org could be processed", async () => {
    getEmbeddingProviderMock.mockReturnValue(PROVIDER);
    loadOrgAiPolicyMock.mockRejectedValue(new Error("RLS: no rows"));
    queueSelects(ORGS, controls);

    const r = (await run()) as SyncResult;
    expect(r.skipped).toBe(false);
    expect(r.degraded).toBe(true);
    expect(r.orgsProcessed).toBe(0);
    expect(r.errors).toBe(1);
    expect(r.reason).toContain("RLS: no rows");
  });

  it("counts a failing embedding call as error and continues the batch", async () => {
    getEmbeddingProviderMock.mockReturnValue(PROVIDER);
    generateEmbeddingMock
      .mockRejectedValueOnce(new Error("provider hiccup"))
      .mockResolvedValueOnce([0.4]);
    queueSelects(ORGS, controls);

    const r = (await run()) as SyncResult;
    expect(r.processed).toBe(1);
    expect(r.errors).toBe(1);
    expect(r.degraded).toBe(false); // the org itself was processed
    expect(r.reason).toContain("control ctl-1");
  });

  it("aborts the batch after 3 consecutive failures with zero successes", async () => {
    getEmbeddingProviderMock.mockReturnValue(PROVIDER);
    generateEmbeddingMock.mockRejectedValue(new Error("provider down"));
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `ctl-${i}`,
      orgId: "org-1",
      title: `Control ${i}`,
      description: null,
    }));
    queueSelects(ORGS, many);

    const r = (await run()) as SyncResult;
    expect(r.processed).toBe(0);
    expect(r.errors).toBe(3);
    expect(generateEmbeddingMock).toHaveBeenCalledTimes(3);
  });

  // ── Pure invalidation logic ────────────────────────────────────

  it("content hash: canonical text and SHA-256 over title+description", () => {
    expect(controlEmbeddingText("A", "B")).toBe("A\nB");
    expect(controlEmbeddingText("A", null)).toBe("A\n");
    expect(controlEmbeddingText(null, null)).toBe("\n");

    const expected = createHash("sha256").update("A\nB", "utf8").digest("hex");
    expect(controlEmbeddingContentHash("A", "B")).toBe(expected);
    // Text change → different hash (invalidation trigger)
    expect(controlEmbeddingContentHash("A", "B")).not.toBe(
      controlEmbeddingContentHash("A", "C"),
    );
    // null and empty description canonicalise identically (no churn)
    expect(controlEmbeddingContentHash("A", null)).toBe(
      controlEmbeddingContentHash("A", ""),
    );
  });

  it("embeddingNeedsRefresh: missing row, model switch, stale hash", () => {
    const currentHash = controlEmbeddingContentHash("A", "B");
    const model = "nomic-embed-text";
    expect(
      embeddingNeedsRefresh({
        existingHash: null,
        existingModel: null,
        currentHash,
        model,
      }),
    ).toBe(true);
    expect(
      embeddingNeedsRefresh({
        existingHash: currentHash,
        existingModel: "text-embedding-3-small",
        currentHash,
        model,
      }),
    ).toBe(true);
    expect(
      embeddingNeedsRefresh({
        existingHash: controlEmbeddingContentHash("A", "OLD"),
        existingModel: model,
        currentHash,
        model,
      }),
    ).toBe(true);
    expect(
      embeddingNeedsRefresh({
        existingHash: currentHash,
        existingModel: model,
        currentHash,
        model,
      }),
    ).toBe(false);
  });
});
