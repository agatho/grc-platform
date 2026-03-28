import { describe, it, expect, vi } from "vitest";
import {
  executeActions,
  determineExecutionStatus,
  type ActionServices,
} from "../action-executor";

const mockServices: ActionServices = {
  createTask: vi.fn().mockResolvedValue({ id: "task-123" }),
  sendNotification: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
  changeStatus: vi.fn().mockResolvedValue(undefined),
  escalate: vi.fn().mockResolvedValue(undefined),
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
};

const baseContext = {
  orgId: "org-1",
  entityType: "risk",
  entityId: "risk-1",
  entity: { title: "Ransomware Risk", residual_score: 18 },
};

describe("executeActions", () => {
  it("executes create_task action with interpolated title", async () => {
    const results = await executeActions(
      [
        {
          type: "create_task",
          config: {
            title: "Review {entity.title}",
            assigneeRole: "risk_manager",
            deadlineDays: 14,
          },
        },
      ],
      baseContext,
      mockServices,
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("success");
    expect(results[0].type).toBe("create_task");
    expect(results[0].result).toEqual({
      taskId: "task-123",
      taskTitle: "Review Ransomware Risk",
    });
    expect(mockServices.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Review Ransomware Risk",
        assigneeRole: "risk_manager",
        deadlineDays: 14,
      }),
    );
  });

  it("executes send_notification action", async () => {
    const results = await executeActions(
      [
        {
          type: "send_notification",
          config: {
            role: "admin",
            message: "Risk {entity.title} over appetite",
          },
        },
      ],
      baseContext,
      mockServices,
    );

    expect(results[0].status).toBe("success");
    expect(mockServices.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Risk Ransomware Risk over appetite",
      }),
    );
  });

  it("executes send_email action", async () => {
    const results = await executeActions(
      [
        {
          type: "send_email",
          config: { templateKey: "risk_alert", recipientRole: "admin" },
        },
      ],
      baseContext,
      mockServices,
    );

    expect(results[0].status).toBe("success");
    expect(mockServices.sendEmail).toHaveBeenCalled();
  });

  it("executes change_status action", async () => {
    const results = await executeActions(
      [
        { type: "change_status", config: { newStatus: "in_review" } },
      ],
      baseContext,
      mockServices,
    );

    expect(results[0].status).toBe("success");
    expect(mockServices.changeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: "in_review" }),
    );
  });

  it("executes escalate action", async () => {
    const results = await executeActions(
      [
        {
          type: "escalate",
          config: {
            targetRole: "admin",
            message: "Urgent: {entity.title}",
          },
        },
      ],
      baseContext,
      mockServices,
    );

    expect(results[0].status).toBe("success");
    expect(mockServices.escalate).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Urgent: Ransomware Risk",
      }),
    );
  });

  it("executes trigger_webhook action", async () => {
    const results = await executeActions(
      [
        {
          type: "trigger_webhook",
          config: { webhookId: "wh-123" },
        },
      ],
      baseContext,
      mockServices,
    );

    expect(results[0].status).toBe("success");
    expect(mockServices.triggerWebhook).toHaveBeenCalled();
  });

  it("handles action failure gracefully", async () => {
    const failingServices: ActionServices = {
      ...mockServices,
      createTask: vi.fn().mockRejectedValue(new Error("DB connection failed")),
    };

    const results = await executeActions(
      [
        {
          type: "create_task",
          config: { title: "Test", assigneeRole: "admin", deadlineDays: 7 },
        },
      ],
      baseContext,
      failingServices,
    );

    expect(results[0].status).toBe("failure");
    expect(results[0].error).toBe("DB connection failed");
  });

  it("executes multiple actions sequentially", async () => {
    const results = await executeActions(
      [
        {
          type: "create_task",
          config: { title: "Task", assigneeRole: "admin", deadlineDays: 7 },
        },
        {
          type: "send_notification",
          config: { role: "admin", message: "Alert" },
        },
      ],
      baseContext,
      mockServices,
    );

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("success");
    expect(results[1].status).toBe("success");
  });
});

describe("determineExecutionStatus", () => {
  it("returns success when all actions succeed", () => {
    expect(
      determineExecutionStatus([
        { type: "create_task", status: "success" },
        { type: "send_notification", status: "success" },
      ]),
    ).toBe("success");
  });

  it("returns failure when all actions fail", () => {
    expect(
      determineExecutionStatus([
        { type: "create_task", status: "failure", error: "err" },
        { type: "send_notification", status: "failure", error: "err" },
      ]),
    ).toBe("failure");
  });

  it("returns partial_failure when mixed results", () => {
    expect(
      determineExecutionStatus([
        { type: "create_task", status: "success" },
        { type: "send_notification", status: "failure", error: "err" },
      ]),
    ).toBe("partial_failure");
  });
});
