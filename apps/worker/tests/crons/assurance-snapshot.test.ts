// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape")` asserting
// `expect(r).toBeDefined()`. What this job must get right is: it writes a
// snapshot only for the modules an organisation has actually enabled, it
// upserts per (org, module, day) rather than duplicating, and a failure in one
// module neither aborts the org nor disappears.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  organization: { id: "x", deletedAt: "x" },
  assuranceScoreSnapshot: {
    orgId: "x",
    module: "x",
    snapshotDate: "x",
  },
  moduleConfig: { orgId: "x", moduleKey: "x", uiStatus: "x" },
  control: { orgId: "x", deletedAt: "x" },
  controlTest: { orgId: "x", controlId: "x" },
  evidence: { orgId: "x", deletedAt: "x", createdAt: "x" },
}));

async function run() {
  const { processAssuranceSnapshot } =
    await import("../../src/crons/assurance-snapshot");
  return processAssuranceSnapshot();
}

type Result = {
  orgsProcessed: number;
  snapshotsCreated: number;
  errors: number;
};

/** One org, then its module list, then 3 metric queries per enabled module. */
function queue(orgs: { id: string }[], enabledModules: string[]) {
  mockDb.select
    .mockReturnValueOnce(chainable(orgs))
    .mockReturnValueOnce(
      chainable(enabledModules.map((moduleKey) => ({ moduleKey }))),
    );
  for (let i = 0; i < enabledModules.length; i++) {
    mockDb.select
      .mockReturnValueOnce(chainable([{ totalControls: 10 }]))
      .mockReturnValueOnce(chainable([{ testedControls: 6 }]))
      .mockReturnValueOnce(chainable([{ totalEvidence: 20, avgAgeDays: 30 }]));
  }
  mockDb.select.mockReturnValue(chainable([]));
}

describe("processAssuranceSnapshot", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("writes nothing when there is no organisation", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const r = (await run()) as Result;
    expect(r).toEqual({
      orgsProcessed: 0,
      snapshotsCreated: 0,
      errors: 0,
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("processes an org with no enabled module without writing a snapshot", async () => {
    queue([{ id: "org-1" }], []);
    const r = (await run()) as Result;
    expect(r.orgsProcessed).toBe(1);
    expect(r.snapshotsCreated).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("writes one snapshot per enabled module and none for disabled ones", async () => {
    queue([{ id: "org-1" }], ["isms", "ics"]);
    const r = (await run()) as Result;

    expect(r.orgsProcessed).toBe(1);
    expect(r.snapshotsCreated).toBe(2);
    expect(r.errors).toBe(0);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);

    const modules = mockDb.insert.mock.results.map(
      (res) =>
        (
          (res.value as { values: ReturnType<typeof vi.fn> }).values.mock
            .calls[0]![0] as { module: string }
        ).module,
    );
    expect(modules).toEqual(["isms", "ics"]);
  });

  it("stamps the snapshot with today's date and upserts instead of duplicating", async () => {
    queue([{ id: "org-1" }], ["erm"]);
    await run();

    const call = (
      mockDb.insert.mock.results[0]!.value as {
        values: ReturnType<typeof vi.fn>;
      }
    ).values;
    const payload = call.mock.calls[0]![0] as {
      orgId: string;
      snapshotDate: string;
      score: number;
    };
    expect(payload.orgId).toBe("org-1");
    expect(payload.snapshotDate).toBe(new Date().toISOString().split("T")[0]);
    expect(typeof payload.score).toBe("number");

    // A weekly job that runs twice must not create a second row for the day.
    const chain = call.mock.results[0]!.value as {
      onConflictDoUpdate: ReturnType<typeof vi.fn>;
    };
    expect(chain.onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it("counts a failing module and still writes the next one", async () => {
    queue([{ id: "org-1" }], ["isms", "ics"]);
    let call = 0;
    mockDb.insert.mockImplementation(() => {
      call++;
      if (call === 1) throw new Error("check constraint violated");
      return chainable([]);
    });

    const r = (await run()) as Result;
    expect(r.snapshotsCreated).toBe(1);
    expect(r.errors).toBe(1);
    expect(r.orgsProcessed).toBe(1);
  });
});
