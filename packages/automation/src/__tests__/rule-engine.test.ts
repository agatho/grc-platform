import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutomationEngine } from "../rule-engine";
import type { ActionServices } from "../action-executor";

// Mock the @grc/db module
vi.mock("@grc/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
  automationRule: {
    id: "id",
    orgId: "org_id",
    isActive: "is_active",
    executionCount: "execution_count",
  },
  automationRuleExecution: {},
}));

const mockServices: ActionServices = {
  createTask: vi.fn().mockResolvedValue({ id: "task-1" }),
  sendNotification: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
  changeStatus: vi.fn().mockResolvedValue(undefined),
  escalate: vi.fn().mockResolvedValue(undefined),
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
};

describe("AutomationEngine", () => {
  let engine: AutomationEngine;

  beforeEach(() => {
    engine = new AutomationEngine({ services: mockServices });
    engine.clearCaches();
  });

  describe("isInCooldown", () => {
    it("returns false when no previous execution", () => {
      expect(engine.isInCooldown("rule-1", "entity-1")).toBe(false);
    });
  });

  describe("isRateLimited", () => {
    it("returns false when no executions tracked", () => {
      expect(engine.isRateLimited("rule-1", 100)).toBe(false);
    });
  });

  describe("clearCaches", () => {
    it("clears all internal caches", () => {
      engine.clearCaches();
      expect(engine.isInCooldown("any", "any")).toBe(false);
      expect(engine.isRateLimited("any", 100)).toBe(false);
    });
  });
});
