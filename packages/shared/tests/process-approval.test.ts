// B2 Release-Cycle: unit tests for the approval-step chain logic
// (process-approval.ts) — status transitions, assignee checks and
// chain-outcome evaluation.

import { describe, it, expect } from "vitest";
import {
  APPROVAL_STEP_STATUS_TRANSITIONS,
  isValidApprovalStepTransition,
  isDecidableStepStatus,
  approvalDecisionRequiresComment,
  canDecideApprovalStep,
  evaluateApprovalDecision,
  type ApprovalStepLike,
} from "../src/process-approval";

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

describe("APPROVAL_STEP_STATUS_TRANSITIONS", () => {
  it("pending can move to in_progress, completed, rejected, skipped", () => {
    expect(APPROVAL_STEP_STATUS_TRANSITIONS["pending"]).toEqual([
      "in_progress",
      "completed",
      "rejected",
      "skipped",
    ]);
  });

  it("in_progress can move to completed, rejected, skipped", () => {
    expect(APPROVAL_STEP_STATUS_TRANSITIONS["in_progress"]).toEqual([
      "completed",
      "rejected",
      "skipped",
    ]);
  });

  it("completed, rejected, skipped are terminal", () => {
    expect(APPROVAL_STEP_STATUS_TRANSITIONS["completed"]).toHaveLength(0);
    expect(APPROVAL_STEP_STATUS_TRANSITIONS["rejected"]).toHaveLength(0);
    expect(APPROVAL_STEP_STATUS_TRANSITIONS["skipped"]).toHaveLength(0);
  });

  it("isValidApprovalStepTransition validates against the map", () => {
    expect(isValidApprovalStepTransition("pending", "in_progress")).toBe(true);
    expect(isValidApprovalStepTransition("in_progress", "completed")).toBe(
      true,
    );
    expect(isValidApprovalStepTransition("completed", "pending")).toBe(false);
    expect(isValidApprovalStepTransition("rejected", "completed")).toBe(false);
    expect(isValidApprovalStepTransition("in_progress", "pending")).toBe(
      false,
    );
  });

  it("isDecidableStepStatus is true only for pending/in_progress", () => {
    expect(isDecidableStepStatus("pending")).toBe(true);
    expect(isDecidableStepStatus("in_progress")).toBe(true);
    expect(isDecidableStepStatus("completed")).toBe(false);
    expect(isDecidableStepStatus("rejected")).toBe(false);
    expect(isDecidableStepStatus("skipped")).toBe(false);
  });

  it("only reject requires a comment", () => {
    expect(approvalDecisionRequiresComment("reject")).toBe(true);
    expect(approvalDecisionRequiresComment("approve")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Assignee check
// ---------------------------------------------------------------------------

describe("canDecideApprovalStep", () => {
  it("assigned user may decide", () => {
    expect(
      canDecideApprovalStep(
        { assigneeUserId: "u1", assigneeRole: null },
        { userId: "u1", roles: ["viewer"] },
      ),
    ).toBe(true);
  });

  it("holder of assigned role may decide", () => {
    expect(
      canDecideApprovalStep(
        { assigneeUserId: null, assigneeRole: "auditor" },
        { userId: "u2", roles: ["auditor"] },
      ),
    ).toBe(true);
  });

  it("admin may always decide", () => {
    expect(
      canDecideApprovalStep(
        { assigneeUserId: "u1", assigneeRole: null },
        { userId: "u9", roles: ["admin"] },
      ),
    ).toBe(true);
  });

  it("unrelated user may not decide", () => {
    expect(
      canDecideApprovalStep(
        { assigneeUserId: "u1", assigneeRole: "auditor" },
        { userId: "u2", roles: ["viewer", "process_owner"] },
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Chain evaluation
// ---------------------------------------------------------------------------

function mkChain(): ApprovalStepLike[] {
  return [
    {
      id: "s1",
      stepOrder: 1,
      stepType: "review",
      status: "in_progress",
      assigneeUserId: "reviewer",
    },
    {
      id: "s2",
      stepOrder: 2,
      stepType: "approval",
      status: "pending",
      assigneeRole: "admin",
    },
    {
      id: "s3",
      stepOrder: 3,
      stepType: "acknowledgment",
      status: "pending",
      assigneeUserId: "reader1",
    },
  ];
}

describe("evaluateApprovalDecision", () => {
  it("approve on the first step completes it and activates the next gate", () => {
    const outcome = evaluateApprovalDecision(mkChain(), "s1", "approve");
    expect(outcome.processOutcome).toBeNull();
    expect(outcome.nextStepId).toBe("s2");
    expect(outcome.stepUpdates).toContainEqual({
      id: "s1",
      status: "completed",
    });
    expect(outcome.stepUpdates).toContainEqual({
      id: "s2",
      status: "in_progress",
    });
  });

  it("approve on the last gate step approves the process — acknowledgments never block", () => {
    const chain = mkChain();
    chain[0].status = "completed";
    chain[1].status = "in_progress";
    const outcome = evaluateApprovalDecision(chain, "s2", "approve");
    expect(outcome.processOutcome).toBe("approved");
    expect(outcome.nextStepId).toBeNull();
    expect(outcome.stepUpdates).toEqual([{ id: "s2", status: "completed" }]);
  });

  it("reject marks the step rejected, skips remaining open steps and rejects the process", () => {
    const outcome = evaluateApprovalDecision(mkChain(), "s1", "reject");
    expect(outcome.processOutcome).toBe("rejected");
    expect(outcome.stepUpdates).toContainEqual({
      id: "s1",
      status: "rejected",
    });
    expect(outcome.stepUpdates).toContainEqual({ id: "s2", status: "skipped" });
    expect(outcome.stepUpdates).toContainEqual({ id: "s3", status: "skipped" });
  });

  it("reject leaves already-completed steps untouched", () => {
    const chain = mkChain();
    chain[0].status = "completed";
    chain[1].status = "in_progress";
    const outcome = evaluateApprovalDecision(chain, "s2", "reject");
    expect(
      outcome.stepUpdates.find((u) => u.id === "s1"),
    ).toBeUndefined();
    expect(outcome.stepUpdates).toContainEqual({
      id: "s2",
      status: "rejected",
    });
    expect(outcome.stepUpdates).toContainEqual({ id: "s3", status: "skipped" });
  });

  it("throws when the step is not part of the chain", () => {
    expect(() =>
      evaluateApprovalDecision(mkChain(), "nope", "approve"),
    ).toThrow(/not part of the chain/);
  });

  it("throws when the step is already terminal", () => {
    const chain = mkChain();
    chain[0].status = "completed";
    expect(() => evaluateApprovalDecision(chain, "s1", "approve")).toThrow(
      /cannot be decided/,
    );
  });

  it("steps are activated in stepOrder even when the chain array is unordered", () => {
    const chain = mkChain().reverse();
    const outcome = evaluateApprovalDecision(chain, "s1", "approve");
    expect(outcome.nextStepId).toBe("s2");
  });
});
