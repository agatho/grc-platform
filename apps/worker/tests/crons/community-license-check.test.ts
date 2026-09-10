// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape")` asserting only
// `expect(r).toBeDefined()`. What this job actually does is downgrade a paying
// tenant's edition — the payload of that UPDATE and the per-org error
// isolation are the things a test has to pin.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;
const reportJobError = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  communityEditionConfig: {
    id: "x",
    orgId: "x",
    editionType: "x",
    licenseExpiresAt: "x",
  },
}));

vi.mock("../../src/lib/job-runtime", () => ({
  reportJobError: (...args: unknown[]) => reportJobError(...args),
}));

const EXPIRED = [
  { id: "cfg-1", orgId: "org-1" },
  { id: "cfg-2", orgId: "org-2" },
];

async function run() {
  const { processCommunityLicenseCheck } =
    await import("../../src/crons/community-license-check");
  return processCommunityLicenseCheck();
}

type Result = { expiredCount: number; downgradeCount: number };

describe("processCommunityLicenseCheck", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    reportJobError.mockReset();
  });

  it("does nothing when no enterprise licence has expired", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const r = (await run()) as Result;
    expect(r).toEqual({ expiredCount: 0, downgradeCount: 0 });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("downgrades every expired licence to the community limits", async () => {
    mockDb.select.mockReturnValue(chainable(EXPIRED));
    const r = (await run()) as Result;

    expect(r.expiredCount).toBe(2);
    expect(r.downgradeCount).toBe(2);
    expect(mockDb.update).toHaveBeenCalledTimes(2);

    const payload = (
      mockDb.update.mock.results[0]!.value as {
        set: ReturnType<typeof vi.fn>;
      }
    ).set.mock.calls[0]![0] as {
      editionType: string;
      enabledModules: string[];
      maxUsers: number;
      maxEntities: number;
    };
    // The downgrade is a commercial decision written into the tenant's row;
    // silently keeping enterprise limits would be the failure mode.
    expect(payload.editionType).toBe("community");
    expect(payload.maxUsers).toBe(25);
    expect(payload.maxEntities).toBe(3);
    expect(payload.enabledModules).toEqual(["erm", "bpm", "ics", "dms"]);
  });

  it("isolates a failing org: the second one is still downgraded and the error is reported", async () => {
    mockDb.select.mockReturnValue(chainable(EXPIRED));
    let call = 0;
    mockDb.update.mockImplementation(() => {
      call++;
      if (call === 1) throw new Error("row locked");
      return chainable([]);
    });

    const r = (await run()) as Result;
    expect(r.expiredCount).toBe(2);
    expect(r.downgradeCount).toBe(1);
    // [WP9 · S10-11] the catch used to be silent.
    expect(reportJobError).toHaveBeenCalledTimes(1);
    expect(reportJobError.mock.calls[0]![0]).toMatchObject({
      job: "community-license-check",
    });
  });
});
