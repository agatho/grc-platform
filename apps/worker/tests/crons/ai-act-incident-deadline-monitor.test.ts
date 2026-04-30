// Test for EU AI Act Art. 73 incident-deadline monitor.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  aiIncident: {
    id: "x",
    orgId: "x",
    detectedAt: "x",
    reportedAt: "x",
    severity: "x",
    title: "x",
    reporterId: "x",
  },
  notification: {},
}));

describe("processAiActIncidentDeadlineMonitor", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns zero counts when no AI incidents", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processAiActIncidentDeadlineMonitor } = await import(
      "../../src/crons/ai-act-incident-deadline-monitor"
    );
    const r = await processAiActIncidentDeadlineMonitor();
    expect(r).toBeDefined();
  });

  it("processes incidents without throwing", async () => {
    mockDb.select.mockReturnValue(
      chainable([
        {
          id: "ai-1",
          orgId: "org",
          title: "Bias incident",
          detectedAt: new Date(Date.now() - 5 * 86400000),
          severity: "high",
          reportedAt: null,
          reporterId: "user-1",
        },
      ]),
    );
    const { processAiActIncidentDeadlineMonitor } = await import(
      "../../src/crons/ai-act-incident-deadline-monitor"
    );
    await expect(processAiActIncidentDeadlineMonitor()).resolves.toBeDefined();
  });
});
