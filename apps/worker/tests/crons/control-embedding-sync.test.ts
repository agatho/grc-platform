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

vi.mock("@grc/ai", () => ({
  get getEmbeddingProvider() {
    return getEmbeddingProviderMock;
  },
  get generateEmbedding() {
    return generateEmbeddingMock;
  },
}));

const PROVIDER = { provider: "ollama" as const, model: "nomic-embed-text" };

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

async function run() {
  const { processControlEmbeddingSync } =
    await import("../../src/crons/control-embedding-sync");
  return processControlEmbeddingSync();
}

describe("processControlEmbeddingSync", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    getEmbeddingProviderMock.mockReset();
    generateEmbeddingMock.mockReset();
  });

  it("skips cleanly when no embedding provider is configured", async () => {
    getEmbeddingProviderMock.mockReturnValue(null);
    const r = (await run()) as { skipped: boolean; processed: number };
    expect(r.skipped).toBe(true);
    expect(r.processed).toBe(0);
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(generateEmbeddingMock).not.toHaveBeenCalled();
  });

  it("embeds every candidate and upserts with the matching content hash", async () => {
    getEmbeddingProviderMock.mockReturnValue(PROVIDER);
    generateEmbeddingMock.mockResolvedValue([0.1, 0.2, 0.3]);
    mockDb.select.mockReturnValueOnce(chainable(controls));

    const r = (await run()) as {
      skipped: boolean;
      candidates: number;
      processed: number;
      errors: number;
      model?: string;
    };
    expect(r.skipped).toBe(false);
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

  it("counts a failing embedding call as error and continues the batch", async () => {
    getEmbeddingProviderMock.mockReturnValue(PROVIDER);
    generateEmbeddingMock
      .mockRejectedValueOnce(new Error("provider hiccup"))
      .mockResolvedValueOnce([0.4]);
    mockDb.select.mockReturnValueOnce(chainable(controls));

    const r = (await run()) as { processed: number; errors: number };
    expect(r.processed).toBe(1);
    expect(r.errors).toBe(1);
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
    mockDb.select.mockReturnValueOnce(chainable(many));

    const r = (await run()) as { processed: number; errors: number };
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
