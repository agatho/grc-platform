// Tests für Due-Diligence Token + Score-Helper
// Bezug: packages/shared/src/dd-token.ts

import { describe, it, expect } from "vitest";
import { generateDdToken, computeScore } from "../src/dd-token";

describe("generateDdToken", () => {
  it("returns a base64url-safe string", () => {
    const token = generateDdToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("token length is 64 characters (48 bytes base64url)", () => {
    expect(generateDdToken()).toHaveLength(64);
  });

  it("produces unique tokens (1000 iterations, no collisions)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateDdToken());
    expect(seen.size).toBe(1000);
  });

  it("does not contain padding characters (=)", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateDdToken()).not.toContain("=");
    }
  });

  it("does not contain unsafe URL characters (+ /)", () => {
    for (let i = 0; i < 50; i++) {
      const t = generateDdToken();
      expect(t).not.toContain("+");
      expect(t).not.toContain("/");
    }
  });

  it("entropy: ≥ 30 distinct characters across 5 tokens", () => {
    const distinct = new Set<string>();
    for (let i = 0; i < 5; i++) {
      for (const c of generateDdToken()) distinct.add(c);
    }
    expect(distinct.size).toBeGreaterThanOrEqual(30);
  });
});

describe("computeScore", () => {
  it("returns zero score when there are no responses", () => {
    const r = computeScore([], [{ maxScore: 10 }]);
    expect(r).toEqual({ total: 0, max: 10, percent: 0 });
  });

  it("returns zero percent when max score is zero", () => {
    const r = computeScore([{ score: 5 }], []);
    expect(r).toEqual({ total: 5, max: 0, percent: 0 });
  });

  it("computes total + max + percent for normal inputs", () => {
    const responses = [{ score: 3 }, { score: 4 }, { score: 5 }];
    const questions = [{ maxScore: 5 }, { maxScore: 5 }, { maxScore: 5 }];
    const r = computeScore(responses, questions);
    expect(r).toEqual({ total: 12, max: 15, percent: 80 });
  });

  it("treats null/undefined scores as 0", () => {
    const r = computeScore(
      [{ score: 5 }, { score: null }, { score: undefined as never }],
      [{ maxScore: 5 }, { maxScore: 5 }, { maxScore: 5 }],
    );
    expect(r.total).toBe(5);
    expect(r.max).toBe(15);
    expect(r.percent).toBe(33);
  });

  it("treats null/undefined maxScores as 0", () => {
    const r = computeScore(
      [{ score: 3 }, { score: 4 }],
      [{ maxScore: null }, { maxScore: undefined as never }],
    );
    expect(r.max).toBe(0);
    expect(r.percent).toBe(0);
  });

  it("rounds percent to nearest integer", () => {
    const r = computeScore(
      [{ score: 1 }, { score: 1 }, { score: 1 }],
      [{ maxScore: 5 }, { maxScore: 5 }, { maxScore: 5 }],
    );
    // 3/15 = 0.2 = 20%
    expect(r.percent).toBe(20);
  });

  it("100% for perfect score", () => {
    const r = computeScore(
      [{ score: 5 }, { score: 5 }],
      [{ maxScore: 5 }, { maxScore: 5 }],
    );
    expect(r.percent).toBe(100);
  });

  it("0% when total is 0 and max > 0", () => {
    const r = computeScore(
      [{ score: 0 }, { score: 0 }],
      [{ maxScore: 5 }, { maxScore: 5 }],
    );
    expect(r.percent).toBe(0);
  });

  it("handles negative scores gracefully (no clipping)", () => {
    // Implementation does not clamp; documents current behaviour.
    const r = computeScore([{ score: -2 }, { score: 5 }], [{ maxScore: 5 }, { maxScore: 5 }]);
    expect(r.total).toBe(3);
  });
});
