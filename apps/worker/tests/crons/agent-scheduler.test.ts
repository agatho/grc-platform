// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns shape with no scheduled agents")` asserting
// `expect(r).toBeDefined()`. The interesting behaviour of this job is the
// guarded claim WP9 introduced for S10-09: an agent another worker has already
// claimed must be skipped, not run twice. That is what these tests pin,
// together with the error path that writes the message onto the agent row.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;
const claimRow = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  agentRegistration: {
    id: "x",
    orgId: "x",
    isActive: "x",
    status: "x",
    nextRunAt: "x",
    lastRunAt: "x",
    totalRunCount: "x",
    errorMessage: "x",
    updatedAt: "x",
  },
}));

vi.mock("../../src/lib/job-runtime", () => ({
  claimRow: (...args: unknown[]) => claimRow(...args),
}));

const AGENTS = [
  { id: "agent-1", totalRunCount: 4, config: { scanFrequencyMinutes: 30 } },
  { id: "agent-2", totalRunCount: 0, config: {} },
];

async function run() {
  const { processAgentScheduler } =
    await import("../../src/crons/agent-scheduler");
  return processAgentScheduler();
}

type Result = { checked: number; triggered: number };

function setCallOf(index: number): Record<string, unknown> {
  return (
    mockDb.update.mock.results[index]!.value as {
      set: ReturnType<typeof vi.fn>;
    }
  ).set.mock.calls[0]![0] as Record<string, unknown>;
}

describe("processAgentScheduler", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    claimRow.mockReset();
  });

  it("does not claim or update anything when no agent is due", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const r = (await run()) as Result;
    expect(r).toEqual({ checked: 0, triggered: 0 });
    expect(claimRow).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("claims each due agent with the idle→running guard (S10-09)", async () => {
    mockDb.select.mockReturnValue(chainable(AGENTS));
    claimRow.mockResolvedValue(true);

    const r = (await run()) as Result;
    expect(r).toEqual({ checked: 2, triggered: 2 });
    expect(claimRow).toHaveBeenCalledTimes(2);
    expect(claimRow.mock.calls[0]![0]).toEqual({
      table: "agent_registration",
      id: "agent-1",
      expectedStatus: "idle",
      nextStatus: "running",
    });
  });

  it("skips an agent another worker already claimed instead of running it twice", async () => {
    mockDb.select.mockReturnValue(chainable(AGENTS));
    claimRow.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const r = (await run()) as Result;
    expect(r.checked).toBe(2);
    expect(r.triggered).toBe(1);
    // Exactly one completion UPDATE — the lost agent must not be touched.
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("advances the run counter and reschedules by the agent's own frequency", async () => {
    mockDb.select.mockReturnValue(chainable([AGENTS[0]!]));
    claimRow.mockResolvedValue(true);
    const before = Date.now();

    await run();

    const payload = setCallOf(0) as unknown as {
      status: string;
      totalRunCount: number;
      nextRunAt: Date;
    };
    expect(payload.status).toBe("idle");
    expect(payload.totalRunCount).toBe(5); // 4 + 1
    const deltaMinutes = (payload.nextRunAt.getTime() - before) / 60000;
    expect(deltaMinutes).toBeGreaterThan(29);
    expect(deltaMinutes).toBeLessThan(31);
  });

  it("falls back to 60 minutes when the agent config carries no frequency", async () => {
    mockDb.select.mockReturnValue(chainable([AGENTS[1]!]));
    claimRow.mockResolvedValue(true);
    const before = Date.now();

    await run();

    const payload = setCallOf(0) as unknown as { nextRunAt: Date };
    const deltaMinutes = (payload.nextRunAt.getTime() - before) / 60000;
    expect(deltaMinutes).toBeGreaterThan(59);
    expect(deltaMinutes).toBeLessThan(61);
  });

  it("records the failure on the agent row so the UI can show it", async () => {
    mockDb.select.mockReturnValue(chainable([AGENTS[0]!]));
    claimRow.mockRejectedValue(new Error("claim query failed"));

    const r = (await run()) as Result;
    expect(r.triggered).toBe(0);
    const payload = setCallOf(0) as unknown as {
      status: string;
      errorMessage: string;
    };
    expect(payload.status).toBe("error");
    expect(payload.errorMessage).toBe("claim query failed");
  });
});
