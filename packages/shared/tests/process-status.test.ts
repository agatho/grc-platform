// Unit tests for Process Status Transition Logic (Sprint 3)
// Tests validateStatusTransition(), PROCESS_STATUS_TRANSITIONS,
// and TRANSITIONS_REQUIRING_COMMENT from process-status.ts

import { describe, it, expect } from "vitest";
import {
  validateStatusTransition,
  PROCESS_STATUS_TRANSITIONS,
  TRANSITIONS_REQUIRING_COMMENT,
} from "../src/process-status";

// ---------------------------------------------------------------------------
// validateStatusTransition
// ---------------------------------------------------------------------------

describe("validateStatusTransition", () => {
  // ── draft -> in_review ──────────────────────────────────────

  it("draft -> in_review: allowed for process_owner", () => {
    const result = validateStatusTransition(
      "draft",
      "in_review",
      "process_owner",
      false,
    );
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("draft -> in_review: allowed for admin", () => {
    const result = validateStatusTransition(
      "draft",
      "in_review",
      "admin",
      false,
    );
    expect(result.valid).toBe(true);
  });

  it("draft -> in_review: denied for viewer (returns error)", () => {
    const result = validateStatusTransition(
      "draft",
      "in_review",
      "viewer",
      false,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  // ── in_review -> approved ───────────────────────────────────

  it("in_review -> approved: allowed for admin", () => {
    const result = validateStatusTransition(
      "in_review",
      "approved",
      "admin",
      false,
    );
    expect(result.valid).toBe(true);
  });

  it("in_review -> approved: allowed when user is assigned reviewer", () => {
    const result = validateStatusTransition(
      "in_review",
      "approved",
      "viewer",
      true,
    );
    expect(result.valid).toBe(true);
  });

  // ── in_review -> draft (rejection) ─────────────────────────

  it("in_review -> draft: allowed for admin (reject)", () => {
    const result = validateStatusTransition(
      "in_review",
      "draft",
      "admin",
      false,
    );
    expect(result.valid).toBe(true);
  });

  it("in_review -> draft: denied for process_owner", () => {
    const result = validateStatusTransition(
      "in_review",
      "draft",
      "process_owner",
      false,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  // ── approved -> published ──────────────────────────────────

  it("approved -> published: allowed for admin", () => {
    const result = validateStatusTransition(
      "approved",
      "published",
      "admin",
      false,
    );
    expect(result.valid).toBe(true);
  });

  it("approved -> published: denied for process_owner", () => {
    const result = validateStatusTransition(
      "approved",
      "published",
      "process_owner",
      false,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  // ── approved -> in_review (send back) ──────────────────────

  it("approved -> in_review: allowed for admin (send back)", () => {
    const result = validateStatusTransition(
      "approved",
      "in_review",
      "admin",
      false,
    );
    expect(result.valid).toBe(true);
  });

  // ── published -> archived ──────────────────────────────────

  it("published -> archived: allowed for admin", () => {
    const result = validateStatusTransition(
      "published",
      "archived",
      "admin",
      false,
    );
    expect(result.valid).toBe(true);
  });

  it("published -> archived: denied for process_owner", () => {
    const result = validateStatusTransition(
      "published",
      "archived",
      "process_owner",
      false,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  // ── archived -> anything: denied (terminal state) ──────────

  it("archived -> draft: denied (terminal state)", () => {
    const result = validateStatusTransition(
      "archived",
      "draft",
      "admin",
      false,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("archived -> in_review: denied (terminal state)", () => {
    const result = validateStatusTransition(
      "archived",
      "in_review",
      "admin",
      false,
    );
    expect(result.valid).toBe(false);
  });

  it("archived -> approved: denied (terminal state)", () => {
    const result = validateStatusTransition(
      "archived",
      "approved",
      "admin",
      false,
    );
    expect(result.valid).toBe(false);
  });

  it("archived -> published: denied (terminal state)", () => {
    const result = validateStatusTransition(
      "archived",
      "published",
      "admin",
      false,
    );
    expect(result.valid).toBe(false);
  });

  // ── Skip transitions: denied ───────────────────────────────

  it("draft -> published: denied (skip not allowed)", () => {
    const result = validateStatusTransition(
      "draft",
      "published",
      "admin",
      false,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("draft -> approved: denied (skip not allowed)", () => {
    const result = validateStatusTransition(
      "draft",
      "approved",
      "admin",
      false,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("draft -> archived: denied (skip not allowed)", () => {
    const result = validateStatusTransition(
      "draft",
      "archived",
      "admin",
      false,
    );
    expect(result.valid).toBe(false);
  });

  // ── Reviewer special case ──────────────────────────────────

  it("in_review -> draft: allowed for reviewer (rejection via reviewer flag)", () => {
    const result = validateStatusTransition(
      "in_review",
      "draft",
      "viewer",
      true,
    );
    expect(result.valid).toBe(true);
  });

  // ── Auditor role ───────────────────────────────────────────

  it("in_review -> approved: allowed for auditor", () => {
    const result = validateStatusTransition(
      "in_review",
      "approved",
      "auditor",
      false,
    );
    expect(result.valid).toBe(true);
  });

  it("in_review -> draft: allowed for auditor (rejection)", () => {
    const result = validateStatusTransition(
      "in_review",
      "draft",
      "auditor",
      false,
    );
    expect(result.valid).toBe(true);
  });

  // ── Return shape ───────────────────────────────────────────

  it("returns object with valid boolean and optional error string", () => {
    const success = validateStatusTransition(
      "draft",
      "in_review",
      "admin",
      false,
    );
    expect(typeof success.valid).toBe("boolean");
    expect(success.error).toBeUndefined();

    const failure = validateStatusTransition(
      "draft",
      "published",
      "admin",
      false,
    );
    expect(typeof failure.valid).toBe("boolean");
    expect(typeof failure.error).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// PROCESS_STATUS_TRANSITIONS
// ---------------------------------------------------------------------------

describe("PROCESS_STATUS_TRANSITIONS", () => {
  it("draft has exactly 1 transition target", () => {
    expect(PROCESS_STATUS_TRANSITIONS["draft"]).toHaveLength(1);
    expect(PROCESS_STATUS_TRANSITIONS["draft"]).toEqual(["in_review"]);
  });

  it("in_review has exactly 2 transition targets", () => {
    expect(PROCESS_STATUS_TRANSITIONS["in_review"]).toHaveLength(2);
    expect(PROCESS_STATUS_TRANSITIONS["in_review"]).toContain("approved");
    expect(PROCESS_STATUS_TRANSITIONS["in_review"]).toContain("draft");
  });

  it("approved has exactly 2 transition targets", () => {
    expect(PROCESS_STATUS_TRANSITIONS["approved"]).toHaveLength(2);
    expect(PROCESS_STATUS_TRANSITIONS["approved"]).toContain("published");
    expect(PROCESS_STATUS_TRANSITIONS["approved"]).toContain("in_review");
  });

  it("published has exactly 1 transition target", () => {
    expect(PROCESS_STATUS_TRANSITIONS["published"]).toHaveLength(1);
    expect(PROCESS_STATUS_TRANSITIONS["published"]).toEqual(["archived"]);
  });

  it("archived has exactly 0 transition targets (terminal state)", () => {
    expect(PROCESS_STATUS_TRANSITIONS["archived"]).toHaveLength(0);
    expect(PROCESS_STATUS_TRANSITIONS["archived"]).toEqual([]);
  });

  it("all five statuses are present in the map", () => {
    const statuses = Object.keys(PROCESS_STATUS_TRANSITIONS);
    expect(statuses).toContain("draft");
    expect(statuses).toContain("in_review");
    expect(statuses).toContain("approved");
    expect(statuses).toContain("published");
    expect(statuses).toContain("archived");
    expect(statuses).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// TRANSITIONS_REQUIRING_COMMENT
// ---------------------------------------------------------------------------

describe("TRANSITIONS_REQUIRING_COMMENT", () => {
  it("in_review -> approved requires comment", () => {
    expect(TRANSITIONS_REQUIRING_COMMENT).toContain("in_review->approved");
  });

  it("in_review -> draft requires comment", () => {
    expect(TRANSITIONS_REQUIRING_COMMENT).toContain("in_review->draft");
  });

  it("approved -> in_review requires comment", () => {
    expect(TRANSITIONS_REQUIRING_COMMENT).toContain("approved->in_review");
  });

  it("draft -> in_review does NOT require comment", () => {
    expect(TRANSITIONS_REQUIRING_COMMENT).not.toContain("draft->in_review");
  });

  it("approved -> published does NOT require comment", () => {
    expect(TRANSITIONS_REQUIRING_COMMENT).not.toContain("approved->published");
  });

  it("published -> archived does NOT require comment", () => {
    expect(TRANSITIONS_REQUIRING_COMMENT).not.toContain("published->archived");
  });

  it("contains exactly 3 transition keys", () => {
    expect(TRANSITIONS_REQUIRING_COMMENT).toHaveLength(3);
  });
});
