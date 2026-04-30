import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  programmeJourney: {
    id: "x",
    orgId: "x",
    status: "x",
    progressPercent: "x",
    deletedAt: "x",
  },
  programmeJourneyEvent: {},
  programmeJourneyStep: { journeyId: "x", orgId: "x", status: "x" },
}));

describe("processProgrammeProgressSnapshot", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns zero when no journeys exist", async () => {
    mockDb.select.mockReturnValueOnce(chainable([]));
    const { processProgrammeProgressSnapshot } = await import(
      "../../src/crons/programme-progress-snapshot"
    );
    const r = await processProgrammeProgressSnapshot();
    expect(r.journeysSnapshot).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("writes one snapshot event per journey with correct counts", async () => {
    const journeys = [
      { id: "j1", orgId: "o", status: "active", progressPercent: "42.50" },
    ];
    const steps = [
      { status: "completed" },
      { status: "completed" },
      { status: "in_progress" },
      { status: "blocked" },
      { status: "pending" },
    ];
    mockDb.select
      .mockReturnValueOnce(chainable(journeys))
      .mockReturnValueOnce(chainable(steps));
    const { processProgrammeProgressSnapshot } = await import(
      "../../src/crons/programme-progress-snapshot"
    );
    const r = await processProgrammeProgressSnapshot();
    expect(r.journeysSnapshot).toBe(1);
    expect(mockDb.insert).toHaveBeenCalledOnce();
    const insertChain = mockDb.insert.mock.results[0]?.value as {
      values: ReturnType<typeof vi.fn>;
    };
    const payload = insertChain.values.mock.calls[0]![0];
    expect(payload.eventType).toBe("journey.progress_snapshot");
    expect(payload.payload.counts.total).toBe(5);
    expect(payload.payload.counts.completed).toBe(2);
    expect(payload.payload.counts.in_progress).toBe(1);
    expect(payload.payload.counts.blocked).toBe(1);
    expect(payload.payload.counts.pending).toBe(1);
  });

  it("snapshots multiple journeys independently", async () => {
    const journeys = [
      { id: "j1", orgId: "o1", status: "active", progressPercent: "50.00" },
      { id: "j2", orgId: "o2", status: "completed", progressPercent: "100.00" },
    ];
    mockDb.select
      .mockReturnValueOnce(chainable(journeys))
      .mockReturnValueOnce(chainable([{ status: "completed" }]))
      .mockReturnValueOnce(chainable([{ status: "completed" }]));
    const { processProgrammeProgressSnapshot } = await import(
      "../../src/crons/programme-progress-snapshot"
    );
    const r = await processProgrammeProgressSnapshot();
    expect(r.journeysSnapshot).toBe(2);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });
});
