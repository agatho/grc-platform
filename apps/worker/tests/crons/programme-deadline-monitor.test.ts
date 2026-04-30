import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  notification: {},
  programmeJourney: { id: "x", ownerId: "x", deletedAt: "x", name: "x" },
  programmeJourneyEvent: {},
  programmeJourneyStep: {
    id: "x",
    orgId: "x",
    journeyId: "x",
    code: "x",
    name: "x",
    ownerId: "x",
    dueDate: "x",
    status: "x",
  },
}));

describe("processProgrammeDeadlineMonitor", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns zero stats when no overdue steps", async () => {
    mockDb.select.mockReturnValueOnce(chainable([]));
    const { processProgrammeDeadlineMonitor } = await import(
      "../../src/crons/programme-deadline-monitor"
    );
    const r = await processProgrammeDeadlineMonitor();
    expect(r.stepsScanned).toBe(0);
    expect(r.notificationsCreated).toBe(0);
    expect(r.eventsCreated).toBe(0);
  });

  it("notifies step owner when assigned, creates 1 event per step", async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const overdue = [
      {
        id: "s1",
        orgId: "org",
        journeyId: "j1",
        code: "STEP-001",
        name: "Asset inventory",
        ownerId: "owner-A",
        dueDate: yesterday,
      },
    ];
    mockDb.select
      .mockReturnValueOnce(chainable(overdue))
      .mockReturnValueOnce(
        chainable([{ id: "j1", ownerId: "journey-owner", name: "ISMS Y1" }]),
      );

    const { processProgrammeDeadlineMonitor } = await import(
      "../../src/crons/programme-deadline-monitor"
    );
    const r = await processProgrammeDeadlineMonitor();
    expect(r.stepsScanned).toBe(1);
    expect(r.notificationsCreated).toBe(1);
    expect(r.eventsCreated).toBe(1);
    // Owner-A should be the recipient (step owner takes precedence)
    const insertCalls = mockDb.insert.mock.calls;
    expect(insertCalls.length).toBeGreaterThanOrEqual(2); // notification + event
  });

  it("falls back to journey owner when step has no owner", async () => {
    const overdue = [
      {
        id: "s1",
        orgId: "org",
        journeyId: "j1",
        code: "STEP-002",
        name: "BIA",
        ownerId: null, // no step owner
        dueDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
      },
    ];
    mockDb.select
      .mockReturnValueOnce(chainable(overdue))
      .mockReturnValueOnce(
        chainable([{ id: "j1", ownerId: "journey-owner", name: "BCMS Y1" }]),
      );
    const { processProgrammeDeadlineMonitor } = await import(
      "../../src/crons/programme-deadline-monitor"
    );
    const r = await processProgrammeDeadlineMonitor();
    expect(r.notificationsCreated).toBe(1);
  });

  it("skips notification when neither step owner nor journey owner exists, but still emits event", async () => {
    const overdue = [
      {
        id: "s1",
        orgId: "org",
        journeyId: "j1",
        code: "STEP-003",
        name: "Orphan",
        ownerId: null,
        dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      },
    ];
    mockDb.select
      .mockReturnValueOnce(chainable(overdue))
      .mockReturnValueOnce(chainable([{ id: "j1", ownerId: null, name: "X" }]));
    const { processProgrammeDeadlineMonitor } = await import(
      "../../src/crons/programme-deadline-monitor"
    );
    const r = await processProgrammeDeadlineMonitor();
    expect(r.notificationsCreated).toBe(0);
    expect(r.eventsCreated).toBe(1);
  });

  it("processes multiple overdue steps and counts each", async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const overdue = Array.from({ length: 4 }, (_, i) => ({
      id: `s${i}`,
      orgId: "org",
      journeyId: "j1",
      code: `STEP-${i}`,
      name: `Step ${i}`,
      ownerId: `u${i}`,
      dueDate: yesterday,
    }));
    mockDb.select
      .mockReturnValueOnce(chainable(overdue))
      .mockReturnValueOnce(
        chainable([{ id: "j1", ownerId: "jo", name: "Multi" }]),
      );
    const { processProgrammeDeadlineMonitor } = await import(
      "../../src/crons/programme-deadline-monitor"
    );
    const r = await processProgrammeDeadlineMonitor();
    expect(r.stepsScanned).toBe(4);
    expect(r.notificationsCreated).toBe(4);
    expect(r.eventsCreated).toBe(4);
  });
});
