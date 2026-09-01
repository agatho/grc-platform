// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape")` asserting
// `expect(r).toBeDefined()`. The snapshot this job writes is an immutable
// certification-readiness record; what has to hold is that the score follows
// the checks (a green org scores higher than an empty one), that the snapshot
// carries framework, gap count and pass count, and that a failing org is
// counted rather than turning the run into a lie.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";
import { CERT_READINESS_CHECKS } from "@grc/shared";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  organization: { id: "x", deletedAt: "x" },
  certificationReadinessSnapshot: {},
  soaEntry: {
    orgId: "x",
    applicability: "x",
    implementation: "x",
    controlId: "x",
  },
  managementReview: {
    orgId: "x",
    status: "x",
    reviewDate: "x",
    auditResults: "x",
  },
  assetClassification: { orgId: "x" },
  asset: { orgId: "x", deletedAt: "x" },
}));

async function run() {
  const { processCertReadinessSnapshot } =
    await import("../../src/crons/cert-readiness-snapshot");
  return processCertReadinessSnapshot();
}

type Result = {
  orgsProcessed: number;
  snapshotsCreated: number;
  errors: number;
};

/**
 * Every readiness check reads a different projection. One default row that
 * satisfies all of them keeps the test about the OUTCOME instead of about the
 * exact call order — a brittle mock sequence would break on any query reorder
 * without any behaviour changing.
 */
const GREEN_ROW = {
  total: 10,
  applicable: 10,
  withEvidence: 10,
  count: 10,
  totalAssets: 5,
  classified: 5,
  gapCount: 2,
  reviewDate: new Date().toISOString(),
  status: "completed",
  auditResults: { summary: "clean" },
};

const EMPTY_ROW = {
  total: 0,
  applicable: 0,
  withEvidence: 0,
  count: 0,
  totalAssets: 0,
  classified: 0,
  gapCount: 0,
  reviewDate: null,
  status: null,
  auditResults: null,
};

function payload(index = 0): Record<string, unknown> {
  return (
    mockDb.insert.mock.results[index]!.value as {
      values: ReturnType<typeof vi.fn>;
    }
  ).values.mock.calls[0]![0] as Record<string, unknown>;
}

describe("processCertReadinessSnapshot", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("writes no snapshot when there is no organisation", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const r = (await run()) as Result;
    expect(r).toEqual({
      orgsProcessed: 0,
      snapshotsCreated: 0,
      errors: 0,
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("writes one ISO-27001 snapshot per organisation with the full check list", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-1" }]))
      .mockReturnValue(chainable([GREEN_ROW]));

    const r = (await run()) as Result;
    expect(r.orgsProcessed).toBe(1);
    expect(r.snapshotsCreated).toBe(1);
    expect(r.errors).toBe(0);

    const p = payload();
    expect(p.orgId).toBe("org-1");
    expect(p.framework).toBe("iso27001");
    expect(p.totalChecks).toBe(CERT_READINESS_CHECKS.length);
    expect(p.gapCount).toBe(2);
    expect(Array.isArray(p.checksJson)).toBe(true);
    expect((p.checksJson as unknown[]).length).toBe(
      CERT_READINESS_CHECKS.length,
    );
  });

  it("scores a prepared organisation higher than an empty one", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-1" }]))
      .mockReturnValue(chainable([GREEN_ROW]));
    await run();
    const green = payload() as { score: number; passedCount: number };

    mockDb = makeMockDb();
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-2" }]))
      .mockReturnValue(chainable([EMPTY_ROW]));
    await run();
    const empty = payload() as { score: number; passedCount: number };

    // The score must react to the evidence. A constant number would be the
    // "fabricated evidence" pattern the audit found elsewhere (S10-24).
    expect(green.passedCount).toBeGreaterThan(empty.passedCount);
    expect(green.score).toBeGreaterThan(empty.score);
  });

  it("counts a failing organisation and keeps processing the next", async () => {
    let call = 0;
    mockDb.select.mockImplementation(() => {
      call++;
      if (call === 1) return chainable([{ id: "org-1" }, { id: "org-2" }]);
      if (call === 2) throw new Error("statement timeout");
      return chainable([GREEN_ROW]);
    });

    const r = (await run()) as Result;
    expect(r.orgsProcessed).toBe(2);
    expect(r.errors).toBe(1);
    expect(r.snapshotsCreated).toBe(1);
  });

  it("counts a failure of the org query itself instead of reporting a clean run", async () => {
    mockDb.select.mockImplementation(() => {
      throw new Error("relation organization does not exist");
    });
    const r = (await run()) as Result;
    expect(r.errors).toBe(1);
    expect(r.snapshotsCreated).toBe(0);
  });
});
