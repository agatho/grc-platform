import { describe, it, expect } from "vitest";
import {
  evaluateConditions,
  evaluateConditionsWithTrace,
  getNestedValue,
} from "../condition-evaluator";

describe("getNestedValue", () => {
  it("gets top-level value", () => {
    expect(getNestedValue({ score: 42 }, "score")).toBe(42);
  });

  it("gets nested value", () => {
    expect(getNestedValue({ a: { b: { c: 99 } } }, "a.b.c")).toBe(99);
  });

  it("returns undefined for missing path", () => {
    expect(getNestedValue({ a: 1 }, "b")).toBeUndefined();
  });

  it("returns undefined for null intermediate", () => {
    expect(getNestedValue({ a: null }, "a.b")).toBeUndefined();
  });
});

describe("evaluateConditions", () => {
  it("evaluates simple > condition", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "residual_score", op: ">", value: 15 }] },
        { residual_score: 18 },
      ),
    ).toBe(true);
  });

  it("evaluates simple > condition (not matched)", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "residual_score", op: ">", value: 15 }] },
        { residual_score: 10 },
      ),
    ).toBe(false);
  });

  it("evaluates < condition", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "ces", op: "<", value: 50 }] },
        { ces: 35 },
      ),
    ).toBe(true);
  });

  it("evaluates = condition", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "status", op: "=", value: "active" }] },
        { status: "active" },
      ),
    ).toBe(true);
  });

  it("evaluates != condition", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "status", op: "!=", value: "closed" }] },
        { status: "active" },
      ),
    ).toBe(true);
  });

  it("evaluates >= condition", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "score", op: ">=", value: 15 }] },
        { score: 15 },
      ),
    ).toBe(true);
  });

  it("evaluates <= condition", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "score", op: "<=", value: 15 }] },
        { score: 15 },
      ),
    ).toBe(true);
  });

  it("evaluates contains condition", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "title", op: "contains", value: "cyber" }] },
        { title: "Cyber Security Risk" },
      ),
    ).toBe(true);
  });

  it("evaluates contains condition (case insensitive)", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "title", op: "contains", value: "CYBER" }] },
        { title: "Cyber Security Risk" },
      ),
    ).toBe(true);
  });

  it("evaluates not_contains condition", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "title", op: "not_contains", value: "fire" }] },
        { title: "Cyber Security Risk" },
      ),
    ).toBe(true);
  });

  it("evaluates days_since condition", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 45);
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "updated_at", op: "days_since", value: 30 }] },
        { updated_at: oldDate.toISOString() },
      ),
    ).toBe(true);
  });

  it("evaluates days_since condition (not matched)", () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5);
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "updated_at", op: "days_since", value: 30 }] },
        { updated_at: recentDate.toISOString() },
      ),
    ).toBe(false);
  });

  it("evaluates AND group (all must match)", () => {
    const conditions = {
      operator: "AND" as const,
      rules: [
        { field: "score", op: ">" as const, value: 10 },
        { field: "status", op: "=" as const, value: "active" },
      ],
    };
    expect(evaluateConditions(conditions, { score: 15, status: "active" })).toBe(true);
    expect(evaluateConditions(conditions, { score: 15, status: "closed" })).toBe(false);
    expect(evaluateConditions(conditions, { score: 5, status: "active" })).toBe(false);
  });

  it("evaluates OR group (any must match)", () => {
    const conditions = {
      operator: "OR" as const,
      rules: [
        { field: "severity", op: "=" as const, value: "critical" },
        { field: "severity", op: "=" as const, value: "high" },
      ],
    };
    expect(evaluateConditions(conditions, { severity: "high" })).toBe(true);
    expect(evaluateConditions(conditions, { severity: "critical" })).toBe(true);
    expect(evaluateConditions(conditions, { severity: "low" })).toBe(false);
  });

  it("handles nested groups", () => {
    const conditions = {
      operator: "AND" as const,
      rules: [
        { field: "score", op: ">" as const, value: 15 },
        {
          operator: "OR" as const,
          rules: [
            { field: "category", op: "=" as const, value: "cyber" },
            { field: "category", op: "=" as const, value: "operational" },
          ],
        },
      ],
    };
    expect(evaluateConditions(conditions, { score: 20, category: "cyber" })).toBe(true);
    expect(evaluateConditions(conditions, { score: 20, category: "operational" })).toBe(true);
    expect(evaluateConditions(conditions, { score: 20, category: "financial" })).toBe(false);
    expect(evaluateConditions(conditions, { score: 10, category: "cyber" })).toBe(false);
  });

  it("handles deeply nested groups", () => {
    const conditions = {
      operator: "OR" as const,
      rules: [
        {
          operator: "AND" as const,
          rules: [
            { field: "tier", op: "=" as const, value: "critical" },
            { field: "risk_score", op: ">" as const, value: 80 },
          ],
        },
        {
          operator: "AND" as const,
          rules: [
            { field: "tier", op: "=" as const, value: "high" },
            { field: "risk_score", op: ">" as const, value: 90 },
          ],
        },
      ],
    };
    expect(evaluateConditions(conditions, { tier: "critical", risk_score: 85 })).toBe(true);
    expect(evaluateConditions(conditions, { tier: "high", risk_score: 95 })).toBe(true);
    expect(evaluateConditions(conditions, { tier: "high", risk_score: 70 })).toBe(false);
  });

  it("empty rules matches everything", () => {
    expect(
      evaluateConditions({ operator: "AND", rules: [] }, { anything: true }),
    ).toBe(true);
  });

  it("handles null field values gracefully", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "missing", op: ">", value: 10 }] },
        { other: 5 },
      ),
    ).toBe(false);
  });
});

describe("evaluateConditionsWithTrace", () => {
  it("returns trace with matched status", () => {
    const trace = evaluateConditionsWithTrace(
      { operator: "AND", rules: [{ field: "score", op: ">", value: 10 }] },
      { score: 15 },
    );
    expect(trace.matched).toBe(true);
    expect(trace.children).toHaveLength(1);
    expect(trace.children![0].matched).toBe(true);
    expect(trace.children![0].field).toBe("score");
    expect(trace.children![0].actualValue).toBe(15);
  });

  it("returns trace for nested group", () => {
    const trace = evaluateConditionsWithTrace(
      {
        operator: "AND",
        rules: [
          { field: "score", op: ">", value: 10 },
          {
            operator: "OR",
            rules: [
              { field: "category", op: "=", value: "a" },
              { field: "category", op: "=", value: "b" },
            ],
          },
        ],
      },
      { score: 15, category: "b" },
    );
    expect(trace.matched).toBe(true);
    expect(trace.children).toHaveLength(2);
    expect(trace.children![1].operator).toBe("OR");
    expect(trace.children![1].matched).toBe(true);
  });
});
