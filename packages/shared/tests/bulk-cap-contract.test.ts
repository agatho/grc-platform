// Bulk-Cap Contract — enforces Critical Implementation Rule #11.
//
// Quote (CLAUDE.md):
//   "11. Bulk operations capped at 100 — Zod schema validates max array length"
//
// This test asserts that EVERY known bulk-style schema enforces .max(100)
// at the Zod layer (not at the route handler — that would be too late and
// inconsistent). It also covers a few negative-edge cases (empty input,
// 101 items, exactly 100, exactly 1).
//
// Why this matters: Bulk endpoints are the easiest abuse vector for both
// resource exhaustion and audit-trail-flood attacks. A single missing
// .max(100) silently turns a bounded operation into an unbounded one.

import { describe, it, expect } from "vitest";
import { bulkEnrollSchema } from "../src/schemas/academy";
import {
  createApiKeySchema,
  updateApiKeySchema,
} from "../src/schemas/api-platform";

const VALID_UUID = "a1b2c3d4-e5f6-4789-9abc-def012345678";

function uuids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const hex = i.toString(16).padStart(12, "0");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4789-9abc-def012345678`;
  });
}

describe("Bulk-Cap (CLAUDE.md Critical Rule #11) — bulkEnrollSchema (academy)", () => {
  it("accepts exactly 1 user (min boundary)", () => {
    const result = bulkEnrollSchema.safeParse({
      courseId: VALID_UUID,
      userIds: uuids(1),
    });
    expect(result.success).toBe(true);
  });

  it("accepts exactly 100 users (max boundary)", () => {
    const result = bulkEnrollSchema.safeParse({
      courseId: VALID_UUID,
      userIds: uuids(100),
    });
    expect(result.success).toBe(true);
  });

  it("rejects 101 users (just over the cap)", () => {
    const result = bulkEnrollSchema.safeParse({
      courseId: VALID_UUID,
      userIds: uuids(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects 1000 users (gross abuse)", () => {
    const result = bulkEnrollSchema.safeParse({
      courseId: VALID_UUID,
      userIds: uuids(1000),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty userIds (min:1)", () => {
    const result = bulkEnrollSchema.safeParse({
      courseId: VALID_UUID,
      userIds: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("Bulk-Cap — createApiKeySchema.scopeIds (api-platform)", () => {
  it("accepts exactly 100 scopeIds (max boundary)", () => {
    const result = createApiKeySchema.safeParse({
      name: "test-key",
      scopeIds: uuids(100),
    });
    expect(result.success).toBe(true);
  });

  it("rejects 101 scopeIds (over the cap)", () => {
    const result = createApiKeySchema.safeParse({
      name: "test-key",
      scopeIds: uuids(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty scopeIds (min:1)", () => {
    const result = createApiKeySchema.safeParse({
      name: "test-key",
      scopeIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing scopeIds entirely (required field)", () => {
    const result = createApiKeySchema.safeParse({
      name: "test-key",
    });
    expect(result.success).toBe(false);
  });
});

describe("Bulk-Cap — updateApiKeySchema.scopeIds (optional but bounded)", () => {
  it("accepts omitted scopeIds (field is optional on update)", () => {
    const result = updateApiKeySchema.safeParse({
      name: "renamed-key",
    });
    expect(result.success).toBe(true);
  });

  it("rejects 101 scopeIds even though field is optional", () => {
    const result = updateApiKeySchema.safeParse({
      scopeIds: uuids(101),
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 100 scopeIds", () => {
    const result = updateApiKeySchema.safeParse({
      scopeIds: uuids(100),
    });
    expect(result.success).toBe(true);
  });
});
