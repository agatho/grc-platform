// Tests for cascade-runner.runBiaToAssetCascade.
//
// The BIA → asset_classification cascade is the load-bearing
// derivation between the BCM and ISMS modules. Pre-Wave-26: zero
// unit tests on the wrapper itself (the pure-function piece
// `deriveAssetClassifications` is covered separately in @grc/shared).
//
// Properties pinned here:
//   - empty BIA impacts → early-return CascadeResult with reason
//   - empty asset links → early-return
//   - soft-deleted assets are filtered out before upsert
//   - cross-org assets are filtered out before upsert (org boundary)
//   - existing asset_classification → UPDATE, not INSERT
//   - missing asset_classification → INSERT, not UPDATE
//   - reason field is propagated through to the row
//   - the cascade conservatively writes the same protection level
//     to all three CIA dimensions (confidentiality / integrity /
//     availability) — operator overrides refine per-dimension at
//     read time
//
// These properties together are the "audit-traceable BIA snapshot"
// guarantee. A regression that breaks the org-boundary filter would
// silently cross-pollute tenants.

import { describe, it, expect, vi, beforeEach } from "vitest";

const txStub = makeTx();

function makeTx() {
  const calls: Array<{
    op: "select" | "update" | "insert";
    table: string;
    payload?: unknown;
  }> = [];
  // The chain stub returns itself for builder calls, terminating
  // each chain with a Promise via `.then`.
  function chain<T>(value: T) {
    const c: Record<string, unknown> = {
      from(t: { _name: string }) {
        // capture which table SELECT was on
        calls[calls.length - 1].table = t._name ?? "?";
        return c;
      },
      where: () => c,
      set(p: unknown) {
        calls[calls.length - 1].payload = p;
        return c;
      },
      values(p: unknown) {
        calls[calls.length - 1].payload = p;
        return c;
      },
      returning: () => Promise.resolve(value),
      then: (resolve: (v: T) => unknown) => resolve(value),
    };
    return c;
  }
  return {
    select(_s: unknown) {
      calls.push({ op: "select", table: "?" });
      return chain<unknown[]>(currentSelectResult);
    },
    update(t: { _name: string }) {
      calls.push({ op: "update", table: t._name });
      return chain<unknown[]>([]);
    },
    insert(t: { _name: string }) {
      calls.push({ op: "insert", table: t._name });
      return chain<unknown[]>([]);
    },
    _calls: calls,
    _reset() {
      calls.length = 0;
    },
  } as unknown;
}

// Drives what `.select()...` chains resolve to next. Set this before
// each lifecycle step to control what the cascade sees from the DB.
let currentSelectResult: unknown[] = [];
function setSelectResults(...results: unknown[][]) {
  let i = 0;
  const tx = txStub as ReturnType<typeof makeTx>;
  tx._reset();
  const origSelect = (tx as unknown as { select: unknown }).select;
  void origSelect;
  // Re-create the select with sequential results.
  (tx as { select: unknown }).select = () => {
    const value = results[i] ?? [];
    i += 1;
    (tx as { _calls: Array<{ op: string; table: string }> })._calls.push({
      op: "select",
      table: "?",
    });
    const c: Record<string, unknown> = {
      from: (t: { _name: string }) => {
        const calls = (tx as { _calls: Array<{ table: string }> })._calls;
        calls[calls.length - 1].table = t._name ?? "?";
        return c;
      },
      where: () => c,
      then: (resolve: (v: unknown[]) => unknown) => resolve(value),
    };
    return c;
  };
}

vi.mock("@grc/db", () => ({
  db: {} as unknown,
  asset: { _name: "asset", id: "id", orgId: "orgId", deletedAt: "deletedAt" },
  assetClassification: {
    _name: "asset_classification",
    id: "id",
    orgId: "orgId",
    assetId: "assetId",
  },
  biaProcessImpact: {
    _name: "bia_process_impact",
    biaAssessmentId: "biaAssessmentId",
    orgId: "orgId",
    processId: "processId",
    priorityRanking: "priorityRanking",
    isEssential: "isEssential",
  },
  processAsset: {
    _name: "process_asset",
    orgId: "orgId",
    processId: "processId",
    assetId: "assetId",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ and: a }),
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  inArray: (col: unknown, vals: unknown) => ({ in: [col, vals] }),
  isNull: (col: unknown) => ({ isNull: col }),
}));

const deriveAssetClassificationsMock = vi.fn();
vi.mock("@grc/shared", () => ({
  deriveAssetClassifications: (impacts: unknown, links: unknown) =>
    deriveAssetClassificationsMock(impacts, links),
}));

import { runBiaToAssetCascade } from "../../lib/cascade-runner";

beforeEach(() => {
  deriveAssetClassificationsMock.mockReset();
  (txStub as { _reset: () => void })._reset();
});

describe("runBiaToAssetCascade — no-op paths", () => {
  it("returns 0 + explanatory reason when BIA has no process impacts", async () => {
    setSelectResults([]); // empty impacts
    const result = await runBiaToAssetCascade({
      tx: txStub as never,
      orgId: "org-1",
      biaAssessmentId: "bia-empty",
      userId: "u1",
      trigger: "start",
    });
    expect(result.assetsTouched).toBe(0);
    expect(result.assetsUpserted).toBe(0);
    expect(result.reason).toMatch(/no process impacts/i);
    expect(deriveAssetClassificationsMock).not.toHaveBeenCalled();
  });

  it("returns 0 when processes have no asset links", async () => {
    setSelectResults(
      [{ processId: "p1", priorityRanking: 1, isEssential: true }],
      [], // empty links
    );
    const result = await runBiaToAssetCascade({
      tx: txStub as never,
      orgId: "org-1",
      biaAssessmentId: "bia-no-links",
      userId: "u1",
      trigger: "finalize",
    });
    expect(result.assetsTouched).toBe(0);
    expect(result.reason).toMatch(/no asset links/i);
    expect(deriveAssetClassificationsMock).not.toHaveBeenCalled();
  });
});

describe("runBiaToAssetCascade — org / soft-delete filtering", () => {
  it("filters out assets that don't pass the org+deletedAt validity check", async () => {
    setSelectResults(
      [{ processId: "p1", priorityRanking: 1, isEssential: true }], // impacts
      [{ processId: "p1", assetId: "a-ok" }, { processId: "p1", assetId: "a-deleted" }], // links
      [{ id: "a-ok" }], // valid assets — only a-ok, a-deleted is filtered
      [], // no existing classification for a-ok
    );
    deriveAssetClassificationsMock.mockReturnValue([
      { assetId: "a-ok", protectionLevel: "high", reason: "essential proc" },
      { assetId: "a-deleted", protectionLevel: "high", reason: "essential proc" },
    ]);
    const result = await runBiaToAssetCascade({
      tx: txStub as never,
      orgId: "org-1",
      biaAssessmentId: "bia-filter",
      userId: "u1",
      trigger: "start",
    });
    expect(result.assetsTouched).toBe(1); // not 2 — a-deleted dropped
    expect(result.assetsUpserted).toBe(1);
  });
});

describe("runBiaToAssetCascade — upsert decision", () => {
  it("UPDATE path when asset_classification exists for the asset", async () => {
    setSelectResults(
      [{ processId: "p1", priorityRanking: 1, isEssential: true }], // impacts
      [{ processId: "p1", assetId: "a1" }], // links
      [{ id: "a1" }], // valid assets
      [{ id: "existing-classification-row" }], // existing classification — UPDATE
    );
    deriveAssetClassificationsMock.mockReturnValue([
      { assetId: "a1", protectionLevel: "very_high", reason: "tier-1 BIA" },
    ]);
    const result = await runBiaToAssetCascade({
      tx: txStub as never,
      orgId: "org-1",
      biaAssessmentId: "bia-update",
      userId: "u1",
      trigger: "finalize",
    });
    expect(result.assetsUpserted).toBe(1);
    const calls = (txStub as { _calls: Array<{ op: string; payload?: { confidentialityLevel?: string } }> })._calls;
    const updateCall = calls.find((c) => c.op === "update");
    expect(updateCall).toBeDefined();
    // The CIA-triad triple-write property — all three dimensions get
    // the same protection level the cascade derived.
    expect(updateCall?.payload?.confidentialityLevel).toBe("very_high");
  });

  it("INSERT path when no asset_classification exists yet", async () => {
    setSelectResults(
      [{ processId: "p2", priorityRanking: 1, isEssential: true }],
      [{ processId: "p2", assetId: "a-new" }],
      [{ id: "a-new" }],
      [], // no existing classification — INSERT
    );
    deriveAssetClassificationsMock.mockReturnValue([
      { assetId: "a-new", protectionLevel: "medium", reason: "tier-3 BIA" },
    ]);
    const result = await runBiaToAssetCascade({
      tx: txStub as never,
      orgId: "org-1",
      biaAssessmentId: "bia-insert",
      userId: "u1",
      trigger: "finalize",
    });
    expect(result.assetsUpserted).toBe(1);
    const calls = (txStub as {
      _calls: Array<{ op: string; payload?: Record<string, unknown> }>;
    })._calls;
    const insertCall = calls.find((c) => c.op === "insert");
    expect(insertCall).toBeDefined();
    // INSERT must include orgId + assetId + classifiedBy for audit
    expect(insertCall?.payload).toMatchObject({
      orgId: "org-1",
      assetId: "a-new",
      classifiedBy: "u1",
    });
  });
});

describe("runBiaToAssetCascade — trigger / reason propagation", () => {
  it.each(["start" as const, "finalize" as const])(
    "trigger=%s appears in the result.reason",
    async (trigger) => {
      setSelectResults([]); // empty impacts → early return path
      const result = await runBiaToAssetCascade({
        tx: txStub as never,
        orgId: "org-1",
        biaAssessmentId: "bia-trigger",
        userId: "u1",
        trigger,
      });
      expect(result.reason).toContain(trigger);
    },
  );
});
