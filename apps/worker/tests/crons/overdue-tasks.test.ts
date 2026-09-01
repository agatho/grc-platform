// Tests for the overdue-tasks cron job.
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-13, S10-09, S10-12]
//
// Rewritten for the atomicity fix. Previously the job did one bulk
// `UPDATE … SET status='overdue'` over all found ids and then, in a
// completely separate loop, created the notifications. The audit's scenario:
// 5.000 overdue tasks, the worker stopped between the two (deploy, OOM,
// container restart — a realistic window at that size). All 5.000 are
// already `overdue`, some have no notification, and the next run cannot find
// them again because the selection excludes `status = 'overdue'`. The
// notification is lost for good and the state is not reconstructible.
//
// The job now flips one task and writes its notifications inside ONE
// transaction, with a guarded UPDATE (`AND status NOT IN (…)` plus
// `RETURNING`) so a concurrent run cannot notify twice. The tests reflect
// that: what `mockDb.update(...).returning()` yields decides whether the
// claim was won.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  get baseClient() {
    return undefined;
  },
  task: { id: "task.id", orgId: "task.orgId", status: "task.status" },
  notification: { id: "notification.id", orgId: "n.orgId", dedupeKey: "n.dk" },
  user: {},
}));

/** A guarded UPDATE that wins the claim (returns one row). */
const claimWon = () => chainable([{ id: "claimed" }]);
/** A guarded UPDATE that loses the claim (returns nothing). */
const claimLost = () => chainable([]);

describe("processOverdueTasks", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns processed=0 when no overdue tasks exist", async () => {
    mockDb.select.mockReturnValueOnce(chainable([]));
    const { processOverdueTasks } =
      await import("../../src/crons/overdue-tasks");
    const result = await processOverdueTasks();
    expect(result.processed).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("marks a task overdue and notifies the assignee in one transaction", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: "t1",
          orgId: "org1",
          title: "Pay invoice",
          dueDate: new Date(Date.now() - 86400000),
          assigneeId: "user-A",
          createdBy: "user-A",
          priority: "high",
        },
      ]),
    );
    mockDb.update.mockReturnValue(claimWon());

    const { processOverdueTasks } =
      await import("../../src/crons/overdue-tasks");
    const result = await processOverdueTasks();

    expect(result.processed).toBe(1);
    expect(result.errors).toEqual([]);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.update).toHaveBeenCalledOnce();
    // Assignee === creator → exactly one notification.
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("does not notify when another run already claimed the task", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: "t1",
          orgId: "org1",
          title: "Contested",
          dueDate: new Date(Date.now() - 86400000),
          assigneeId: "user-A",
          createdBy: "user-B",
          priority: "high",
        },
      ]),
    );
    mockDb.update.mockReturnValue(claimLost());

    const { processOverdueTasks } =
      await import("../../src/crons/overdue-tasks");
    const result = await processOverdueTasks();

    // The guarded UPDATE changed nothing → no notification at all.
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
  });

  it("notifies both assignee and creator when they differ", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: "t1",
          orgId: "org1",
          title: "Review",
          dueDate: new Date(Date.now() - 7 * 86400000),
          assigneeId: "user-A",
          createdBy: "user-B",
          priority: "medium",
        },
      ]),
    );
    mockDb.update.mockReturnValue(claimWon());
    const { processOverdueTasks } =
      await import("../../src/crons/overdue-tasks");
    await processOverdueTasks();
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("skips the assignee notification when no assignee is set", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: "t1",
          orgId: "org1",
          title: "Orphan",
          dueDate: new Date(Date.now() - 86400000),
          assigneeId: null,
          createdBy: "user-B",
          priority: "low",
        },
      ]),
    );
    mockDb.update.mockReturnValue(claimWon());
    const { processOverdueTasks } =
      await import("../../src/crons/overdue-tasks");
    await processOverdueTasks();
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("reports a failing task without aborting the run or claiming success", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: "t1",
          orgId: "org1",
          title: "X",
          dueDate: new Date(Date.now() - 86400000),
          assigneeId: "u1",
          createdBy: "u1",
          priority: "low",
        },
        {
          id: "t2",
          orgId: "org1",
          title: "Y",
          dueDate: new Date(Date.now() - 86400000),
          assigneeId: "u2",
          createdBy: "u2",
          priority: "low",
        },
      ]),
    );
    const failing = chainable([]);
    (failing as unknown as { set: ReturnType<typeof vi.fn> }).set = vi
      .fn()
      .mockImplementation(() => {
        throw new Error("DB exploded");
      });
    mockDb.update.mockReturnValueOnce(failing).mockReturnValue(claimWon());

    const { processOverdueTasks } =
      await import("../../src/crons/overdue-tasks");
    const result = await processOverdueTasks();

    // One task failed, the other still went through — and the run does NOT
    // report success (S10-12: the old code answered HTTP 200 success:true
    // with the errors hidden in an array nobody reads).
    expect(result.errors.length).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.processed).toBe(1);
  });

  it("processes multiple overdue tasks in a single run", async () => {
    const now = Date.now();
    mockDb.select.mockReturnValueOnce(
      chainable(
        Array.from({ length: 5 }, (_, i) => ({
          id: `t${i}`,
          orgId: "org1",
          title: `Task ${i}`,
          dueDate: new Date(now - (i + 1) * 86400000),
          assigneeId: `user-${i}`,
          createdBy: `user-${i}`,
          priority: "medium",
        })),
      ),
    );
    mockDb.update.mockReturnValue(claimWon());
    const { processOverdueTasks } =
      await import("../../src/crons/overdue-tasks");
    const result = await processOverdueTasks();
    expect(result.processed).toBe(5);
    expect(mockDb.transaction).toHaveBeenCalledTimes(5);
    expect(mockDb.insert).toHaveBeenCalledTimes(5);
  });
});
