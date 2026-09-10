// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it(...)` asserting `expect(r).toBeDefined()`. WP8 rewrote this job
// for S07-16: three data-protection defects at once — a missing
// `deleted_at IS NULL` filter (a risk deleted BECAUSE it contained personal
// data still reached the index), `onConflictDoNothing` (a correction never
// reached the index, Art. 5(1)(d)) and no pruning path at all. Plus S10-11:
// the empty catch is gone.
//
// These four properties are exactly what the tests below assert. The old
// assertion held none of them.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  copilotRagSource: {
    id: "x",
    orgId: "x",
    sourceType: "x",
    entityId: "x",
    chunkIndex: "x",
  },
}));

async function run() {
  const { processCopilotRagIndexer } =
    await import("../../src/crons/copilot-rag-indexer");
  return processCopilotRagIndexer();
}

type Result = {
  orgsProcessed: number;
  sourcesIndexed: number;
  sourcesUpdated: number;
  sourcesPruned: number;
};

const RISK = {
  id: "risk-1",
  title: "Ausfall Rechenzentrum",
  description: "Standort Frankfurt",
};

/** org list → prune count → risk list (per org) */
function queue(orgs: string[], pruned: number, risks: unknown[]) {
  mockDb.execute.mockResolvedValueOnce(orgs.map((org_id) => ({ org_id })));
  for (let i = 0; i < orgs.length; i++) {
    mockDb.execute
      .mockResolvedValueOnce([{ n: pruned }])
      .mockResolvedValueOnce(risks);
  }
  mockDb.execute.mockResolvedValue([]);
}

function sqlText(callIndex: number): string {
  return JSON.stringify(mockDb.execute.mock.calls[callIndex]![0]);
}

describe("processCopilotRagIndexer", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "src-1" }]),
        }),
      }),
    });
  });

  it("indexes nothing when no org had a conversation in the last 30 days", async () => {
    mockDb.execute.mockResolvedValue([]);
    const r = (await run()) as Result;
    expect(r).toEqual({
      orgsProcessed: 0,
      sourcesIndexed: 0,
      sourcesUpdated: 0,
      sourcesPruned: 0,
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("excludes soft-deleted risks from the index (S07-16.1)", async () => {
    queue(["org-1"], 0, [RISK]);
    await run();
    // Call 0 = org list, 1 = prune, 2 = risk query.
    const riskQuery = sqlText(2);
    expect(riskQuery).toContain("FROM risk");
    expect(
      riskQuery,
      "a risk deleted because its description held personal data must not " +
        "reach the RAG index",
    ).toContain("deleted_at IS NULL");
  });

  it("prunes before indexing so a just-deleted row does not survive the run (S07-16.3)", async () => {
    queue(["org-1"], 3, [RISK]);
    const r = (await run()) as Result;
    expect(r.sourcesPruned).toBe(3);
    // Prune must be the FIRST statement of the org, before the risk read.
    expect(sqlText(1)).toContain("copilot_rag_prune");
    expect(sqlText(2)).toContain("FROM risk");
  });

  it("upserts so a corrected description reaches the index (S07-16.2)", async () => {
    queue(["org-1"], 0, [RISK]);
    const r = (await run()) as Result;
    expect(r.sourcesIndexed).toBe(1);

    const values = (
      mockDb.insert.mock.results[0]!.value as {
        values: ReturnType<typeof vi.fn>;
      }
    ).values;
    const payload = values.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.sourceType).toBe("risk");
    expect(payload.entityId).toBe("risk-1");
    expect(payload.orgId).toBe("org-1");
    expect(String(payload.content)).toContain("Standort Frankfurt");

    const chain = values.mock.results[0]!.value as {
      onConflictDoUpdate: ReturnType<typeof vi.fn>;
    };
    expect(
      chain.onConflictDoUpdate,
      "onConflictDoNothing would freeze the first version forever",
    ).toHaveBeenCalledTimes(1);
  });

  it("falls back to a placeholder title instead of writing null", async () => {
    queue(["org-1"], 0, [{ id: "risk-2", title: null, description: null }]);
    await run();
    const payload = (
      mockDb.insert.mock.results[0]!.value as {
        values: ReturnType<typeof vi.fn>;
      }
    ).values.mock.calls[0]![0] as { title: string };
    expect(payload.title).toBe("Untitled Risk");
  });

  it("fails the run when an org could not be pruned (S10-11)", async () => {
    mockDb.execute
      .mockResolvedValueOnce([{ org_id: "org-1" }])
      .mockRejectedValueOnce(new Error("function copilot_rag_prune missing"));

    // An org whose prune failed keeps deleted content in the index. The old
    // empty catch reported that as a clean run.
    await expect(run()).rejects.toThrow(/org-1/);
  });
});
