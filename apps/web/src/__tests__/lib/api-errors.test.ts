// Tests for the RFC 7807 problem-details helper.
// Bezug: apps/web/src/lib/api-errors.ts (ADR-021)

import { describe, it, expect } from "vitest";
import {
  ErrorTypes,
  problemResponse,
  problem,
  getRequestId,
} from "../../lib/api-errors";

describe("ErrorTypes", () => {
  it("contains documented standard types", () => {
    expect(ErrorTypes).toEqual(
      expect.objectContaining({
        VALIDATION: expect.any(String),
      }),
    );
  });
});

describe("problemResponse", () => {
  it("returns Response with application/problem+json content-type", async () => {
    const res = problemResponse({
      type: ErrorTypes.VALIDATION,
      title: "Invalid input",
      status: 422,
      instance: "/api/v1/x",
      requestId: "abc",
    });
    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toContain("problem+json");
    const body = await res.json();
    expect(body.title).toBe("Invalid input");
    expect(body.status).toBe(422);
  });

  it("includes errors array when provided", async () => {
    const res = problemResponse({
      type: ErrorTypes.VALIDATION,
      title: "Validation failed",
      status: 422,
      instance: "/x",
      requestId: "r-1",
      errors: [{ path: "email", message: "must be email" }],
    });
    const body = await res.json();
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toEqual({
      path: "email",
      message: "must be email",
    });
  });
});

describe("problem helpers (shorthand)", () => {
  it("validation() returns 422", async () => {
    const res = problem.validation({
      requestId: "r1",
      instance: "/x",
      errors: [],
    });
    expect(res.status).toBe(422);
  });

  it("notFound() returns 404", async () => {
    const res = problem.notFound({ requestId: "r1", instance: "/x" });
    expect(res.status).toBe(404);
  });

  it("forbidden() returns 403", async () => {
    const res = problem.forbidden({ requestId: "r1", instance: "/x" });
    expect(res.status).toBe(403);
  });

  it("rateLimited() returns 429 with Retry-After header", async () => {
    const res = problem.rateLimited({
      requestId: "r1",
      instance: "/x",
      retryAfterSeconds: 30,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
  });

  it("unauthorized() returns 401", async () => {
    const res = problem.unauthorized({ requestId: "r1", instance: "/x" });
    expect(res.status).toBe(401);
  });
});

describe("getRequestId", () => {
  it("returns x-request-id header when present", () => {
    const req = new Request("http://x/", {
      headers: { "x-request-id": "abc-123" },
    });
    expect(getRequestId(req)).toBe("abc-123");
  });

  // #WAVE23: getRequestId now falls back to `crypto.randomUUID()`
  // when no x-request-id header is set. Production middleware always
  // sets the header before handlers run, but the fallback guarantees
  // that every problem+json error body carries a non-empty
  // correlation ID for log-grep — Wave 23 acceptance-tests assert
  // `requestId` truthy on every error response.
  it("returns a fresh UUID fallback when header is absent", () => {
    const req = new Request("http://x/");
    const id = getRequestId(req);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("returns the same header value for repeated calls when header is set", () => {
    const req = new Request("http://x/", {
      headers: { "x-request-id": "r-stable" },
    });
    expect(getRequestId(req)).toBe(getRequestId(req));
  });

  it("returns a DIFFERENT fresh UUID per call when header is absent (fallback)", () => {
    const req = new Request("http://x/");
    const a = getRequestId(req);
    const b = getRequestId(req);
    // Two calls without a header → two distinct UUIDs. Production
    // middleware prevents this in real traffic, but the test pins
    // the fallback semantics: do not cache the UUID on Request.
    expect(a).not.toBe(b);
  });
});
