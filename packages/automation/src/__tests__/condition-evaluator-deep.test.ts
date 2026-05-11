// Deep edge-case tests for evaluateConditions — nested groups, all operators,
// boundary cases. The existing condition-evaluator.test.ts has 24 cases for
// flat rules; this file targets the recursion + uncommon paths that bite
// production rules silently.

import { describe, it, expect } from "vitest";
import {
  evaluateConditions,
  evaluateConditionsWithTrace,
  getNestedValue,
} from "../condition-evaluator";

describe("getNestedValue — corner cases", () => {
  it("returns the root for a single-segment path", () => {
    expect(getNestedValue({ a: 1 }, "a")).toBe(1);
  });

  it("walks two levels", () => {
    expect(getNestedValue({ a: { b: 2 } }, "a.b")).toBe(2);
  });

  it("walks three levels", () => {
    expect(getNestedValue({ a: { b: { c: 3 } } }, "a.b.c")).toBe(3);
  });

  it("returns undefined when an intermediate is null", () => {
    expect(
      getNestedValue({ a: null as unknown as object }, "a.b"),
    ).toBeUndefined();
  });

  it("returns undefined when an intermediate is a primitive (not walkable)", () => {
    expect(
      getNestedValue({ a: "string" as unknown as object }, "a.b"),
    ).toBeUndefined();
  });

  it("returns undefined when path doesn't exist", () => {
    expect(getNestedValue({ a: 1 }, "x.y.z")).toBeUndefined();
  });

  it("handles arrays as objects (numeric-string indexing)", () => {
    // Implementation walks as object, so array[0] is reachable as "0"
    expect(getNestedValue({ list: [10, 20, 30] }, "list.1")).toBe(20);
  });
});

describe("evaluateConditions — empty/trivial cases", () => {
  it("returns true for empty rules array (vacuous AND)", () => {
    expect(evaluateConditions({ operator: "AND", rules: [] }, {})).toBe(true);
  });

  it("returns true for empty rules array (vacuous OR)", () => {
    expect(evaluateConditions({ operator: "OR", rules: [] }, {})).toBe(true);
  });
});

describe("evaluateConditions — AND vs OR semantics", () => {
  const entity = { score: 50, status: "open", priority: "high" };

  it("AND requires all rules to match", () => {
    const cg = {
      operator: "AND" as const,
      rules: [
        { field: "score", op: ">" as const, value: 0 },
        { field: "status", op: "=" as const, value: "open" },
      ],
    };
    expect(evaluateConditions(cg, entity)).toBe(true);
  });

  it("AND fails if any rule fails", () => {
    const cg = {
      operator: "AND" as const,
      rules: [
        { field: "score", op: ">" as const, value: 0 },
        { field: "status", op: "=" as const, value: "closed" },
      ],
    };
    expect(evaluateConditions(cg, entity)).toBe(false);
  });

  it("OR requires only one rule to match", () => {
    const cg = {
      operator: "OR" as const,
      rules: [
        { field: "score", op: ">" as const, value: 1000 },
        { field: "status", op: "=" as const, value: "open" },
      ],
    };
    expect(evaluateConditions(cg, entity)).toBe(true);
  });

  it("OR fails when no rule matches", () => {
    const cg = {
      operator: "OR" as const,
      rules: [
        { field: "score", op: ">" as const, value: 1000 },
        { field: "status", op: "=" as const, value: "closed" },
      ],
    };
    expect(evaluateConditions(cg, entity)).toBe(false);
  });
});

describe("evaluateConditions — nested groups", () => {
  const entity = {
    severity: "critical",
    score: 25,
    owner: "alice",
    department: "security",
  };

  it("AND of (OR ∨ AND) — true when sub-OR matches and sub-AND matches", () => {
    const cg = {
      operator: "AND" as const,
      rules: [
        {
          operator: "OR" as const,
          rules: [
            { field: "severity", op: "=" as const, value: "critical" },
            { field: "severity", op: "=" as const, value: "high" },
          ],
        },
        {
          operator: "AND" as const,
          rules: [
            { field: "score", op: ">" as const, value: 20 },
            { field: "department", op: "=" as const, value: "security" },
          ],
        },
      ],
    };
    expect(evaluateConditions(cg, entity)).toBe(true);
  });

  it("AND of (OR ∨ AND) — false when sub-AND fails (department mismatch)", () => {
    const cg = {
      operator: "AND" as const,
      rules: [
        {
          operator: "OR" as const,
          rules: [{ field: "severity", op: "=" as const, value: "critical" }],
        },
        {
          operator: "AND" as const,
          rules: [{ field: "department", op: "=" as const, value: "finance" }],
        },
      ],
    };
    expect(evaluateConditions(cg, entity)).toBe(false);
  });

  it("3-level deep nesting: OR of AND of OR", () => {
    const cg = {
      operator: "OR" as const,
      rules: [
        {
          operator: "AND" as const,
          rules: [
            { field: "score", op: ">" as const, value: 100 }, // false
            {
              operator: "OR" as const,
              rules: [{ field: "severity", op: "=" as const, value: "low" }],
            },
          ],
        },
        // ↑ first branch is false; second branch saves it
        { field: "severity", op: "=" as const, value: "critical" }, // true
      ],
    };
    expect(evaluateConditions(cg, entity)).toBe(true);
  });
});

describe("evaluateConditions — all comparison operators", () => {
  const entity = {
    score: 42,
    flag: true,
    name: "Production Server",
    createdAt: "2020-01-01",
  };

  it("> works", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "score", op: ">", value: 40 }] },
        entity,
      ),
    ).toBe(true);
  });

  it("< works", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "score", op: "<", value: 50 }] },
        entity,
      ),
    ).toBe(true);
  });

  it(">= boundary inclusive", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "score", op: ">=", value: 42 }] },
        entity,
      ),
    ).toBe(true);
  });

  it("<= boundary inclusive", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "score", op: "<=", value: 42 }] },
        entity,
      ),
    ).toBe(true);
  });

  it("= compares as string", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "score", op: "=", value: 42 }] },
        entity,
      ),
    ).toBe(true);
  });

  it("!= compares as string", () => {
    expect(
      evaluateConditions(
        { operator: "AND", rules: [{ field: "score", op: "!=", value: 99 }] },
        entity,
      ),
    ).toBe(true);
  });

  it("contains is case-insensitive", () => {
    expect(
      evaluateConditions(
        {
          operator: "AND",
          rules: [{ field: "name", op: "contains", value: "production" }],
        },
        entity,
      ),
    ).toBe(true);
  });

  it("not_contains is case-insensitive", () => {
    expect(
      evaluateConditions(
        {
          operator: "AND",
          rules: [{ field: "name", op: "not_contains", value: "test" }],
        },
        entity,
      ),
    ).toBe(true);
  });

  it("days_since: a 5-year-old date is > 30 days old", () => {
    expect(
      evaluateConditions(
        {
          operator: "AND",
          rules: [{ field: "createdAt", op: "days_since", value: 30 }],
        },
        entity,
      ),
    ).toBe(true);
  });
});

describe("evaluateConditions — null/undefined field handling", () => {
  it("a missing field does NOT match any comparison (returns false)", () => {
    const entity = { other: "x" };
    for (const op of [">", "<", "=", "!=", "contains"] as const) {
      expect(
        evaluateConditions(
          {
            operator: "AND",
            rules: [{ field: "missing", op, value: "anything" }],
          },
          entity,
        ),
      ).toBe(false);
    }
  });

  it("explicitly null field does NOT match (defensive vs accidental nulls)", () => {
    expect(
      evaluateConditions(
        {
          operator: "AND",
          rules: [{ field: "x", op: "=", value: "anything" }],
        },
        { x: null as unknown as string },
      ),
    ).toBe(false);
  });
});

describe("evaluateConditionsWithTrace — debug shape", () => {
  it("returns a tree mirroring the rule structure", () => {
    const entity = { score: 10, status: "open" };
    const trace = evaluateConditionsWithTrace(
      {
        operator: "AND",
        rules: [
          { field: "score", op: ">", value: 5 },
          { field: "status", op: "=", value: "open" },
        ],
      },
      entity,
    );
    expect(trace.operator).toBe("AND");
    expect(trace.matched).toBe(true);
    expect(trace.children).toHaveLength(2);
    expect(trace.children?.[0]?.field).toBe("score");
    expect(trace.children?.[0]?.actualValue).toBe(10);
    expect(trace.children?.[0]?.matched).toBe(true);
    expect(trace.children?.[1]?.matched).toBe(true);
  });

  it("nested group trace has children of children", () => {
    const trace = evaluateConditionsWithTrace(
      {
        operator: "OR",
        rules: [
          {
            operator: "AND",
            rules: [
              { field: "a", op: "=", value: "x" },
              { field: "b", op: "=", value: "y" },
            ],
          },
          { field: "c", op: "=", value: "z" },
        ],
      },
      { a: "x", b: "y", c: "wrong" },
    );
    expect(trace.matched).toBe(true);
    expect(trace.children).toHaveLength(2);
    expect(trace.children?.[0]?.children).toHaveLength(2);
    expect(trace.children?.[1]?.children).toBeUndefined();
  });
});
