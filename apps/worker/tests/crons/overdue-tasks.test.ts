// Tests for the overdue-tasks cron job.
// Verifies query construction, batch update, and notification fan-out.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  task: { id: "task.id", orgId: "task.orgId" },
  notification: {},
  user: {},
}));

describe("processOverdueTasks", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns processed=0 when no overdue tasks exist", async () => {
    mockDb.select.mockReturnValueOnce(chainable([]));
    const { processOverdueTasks } = await import(
      "../../src/crons/overdue-tasks"
    );
    const result = await processOverdueTasks();
    expect(result.processed).toBe(0);
    expect(result.errors).toEqual([]);
    // No update or notification calls
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("marks tasks overdue and notifies assignee", async () => {
    const tasks = [
      {
        id: "t1",
        orgId: "org1",
        title: "Pay invoice",
        dueDate: new Date(Date.now() - 86400000), // 1 day ago
        assigneeId: "user-A",
        createdBy: "user-A",
        priority: "high",
      },
    ];
    mockDb.select.mockReturnValueOnce(chainable(tasks));

    const { processOverdueTasks } = await import(
      "../../src/crons/overdue-tasks"
    );
    const result = await processOverdueTasks();

    expect(result.processed).toBe(1);
    expect(result.errors).toEqual([]);
    expect(mockDb.update).toHaveBeenCalledOnce();
    // Assignee + creator are same → only one notification
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("notifies both assignee and creator when they differ", async () => {
    const tasks = [
      {
        id: "t1",
        orgId: "org1",
        title: "Review",
        dueDate: new Date(Date.now() - 7 * 86400000),
        assigneeId: "user-A",
        createdBy: "user-B",
        priority: "medium",
      },
    ];
    mockDb.select.mockReturnValueOnce(chainable(tasks));
    const { processOverdueTasks } = await import(
      "../../src/crons/overdue-tasks"
    );
    await processOverdueTasks();
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("skips creator notification when no assignee is set", async () => {
    const tasks = [
      {
        id: "t1",
        orgId: "org1",
        title: "Orphan",
        dueDate: new Date(Date.now() - 86400000),
        assigneeId: null,
        createdBy: "user-B",
        priority: "low",
      },
    ];
    mockDb.select.mockReturnValueOnce(chainable(tasks));
    const { processOverdueTasks } = await import(
      "../../src/crons/overdue-tasks"
    );
    await processOverdueTasks();
    // No assignee → only creator notification (1)
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("returns errors when batch update fails", async () => {
    const tasks = [
      {
        id: "t1",
        orgId: "org1",
        title: "X",
        dueDate: new Date(Date.now() - 86400000),
        assigneeId: "u1",
        createdBy: "u1",
        priority: "low",
      },
    ];
    mockDb.select.mockReturnValueOnce(chainable(tasks));
    const failingChain = chainable([]);
    (failingChain as unknown as { where: ReturnType<typeof vi.fn> }).where = vi
      .fn()
      .mockRejectedValue(new Error("DB exploded"));
    mockDb.update.mockReturnValueOnce(failingChain);

    const { processOverdueTasks } = await import(
      "../../src/crons/overdue-tasks"
    );
    const result = await processOverdueTasks();
    expect(result.processed).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Batch status update failed");
  });

  it("processes multiple overdue tasks in a single run", async () => {
    const now = Date.now();
    const tasks = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`,
      orgId: "org1",
      title: `Task ${i}`,
      dueDate: new Date(now - (i + 1) * 86400000),
      assigneeId: `user-${i}`,
      createdBy: `user-${i}`,
      priority: "medium",
    }));
    mockDb.select.mockReturnValueOnce(chainable(tasks));
    const { processOverdueTasks } = await import(
      "../../src/crons/overdue-tasks"
    );
    const result = await processOverdueTasks();
    expect(result.processed).toBe(5);
    // 5 tasks × 1 notification (creator==assignee) = 5
    expect(mockDb.insert).toHaveBeenCalledTimes(5);
  });
});
