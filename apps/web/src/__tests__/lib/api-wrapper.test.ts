// Tests for withErrorHandler — the wrapper guards every route handler
// against the empty-500 regression that bit Wave-9. It maps Postgres
// SQLSTATE codes, Zod issues, PaginationError, and the Wave-23
// FindingFkMismatchError to RFC-7807 problem+json responses.
//
// Pre-Wave-26 there was zero unit coverage of this mapping table. A
// future refactor that "tidied up" the SQLSTATE set without realising
// it was load-bearing would silently regress 1700+ routes back into
// empty-500 territory. This file pins the contract.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be hoisted before the import of api-wrapper.
vi.mock("@/lib/logger", () => {
  const noop = vi.fn();
  return {
    log: {
      withContext: () => ({
        error: noop,
        warn: noop,
        info: noop,
      }),
      error: noop,
      warn: noop,
      info: noop,
    },
  };
});

vi.mock("@/lib/api-errors", () => ({
  getRequestId: () => "test-req-id",
  problem: {
    validation: (opts: {
      requestId: string;
      instance: string;
      detail: string;
      errors: Array<{ path: string; message: string }>;
    }) =>
      new Response(
        JSON.stringify({
          type: "https://arctos.charliehund.de/errors/validation",
          title: "Validation failed",
          status: 422,
          detail: opts.detail,
          errors: opts.errors,
          requestId: opts.requestId,
          instance: opts.instance,
        }),
        {
          status: 422,
          headers: {
            "content-type": "application/problem+json; charset=utf-8",
          },
        },
      ),
  },
}));

vi.mock("@/lib/api", () => ({
  PaginationError: class PaginationError extends Error {
    constructor(
      public readonly field: string,
      public readonly value: string,
      public readonly reason: string,
    ) {
      super(`Invalid pagination: ${field}=${value} (${reason})`);
      this.name = "PaginationError";
    }
  },
}));

import { withErrorHandler } from "../../lib/api-wrapper";
import { PaginationError } from "../../lib/api";

const REQ_URL = "http://localhost/api/v1/test";
function req(): Request {
  return new Request(REQ_URL, { method: "POST" });
}

describe("withErrorHandler — happy path", () => {
  it("returns the handler's response unchanged on success", async () => {
    const wrapped = withErrorHandler(async () =>
      Response.json({ data: "ok" }, { status: 201 }),
    );
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ data: "ok" });
  });

  it("passes the route context (params etc.) through to the handler", async () => {
    const seen: unknown[] = [];
    const wrapped = withErrorHandler<{ params: Promise<{ id: string }> }>(
      async (_req, ctx) => {
        seen.push(ctx);
        const { id } = await ctx.params;
        return Response.json({ id });
      },
    );
    await wrapped(req(), { params: Promise.resolve({ id: "x1" }) });
    expect(seen).toHaveLength(1);
  });
});

describe("withErrorHandler — Postgres constraint errors → 422", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["23502", "not_null_violation"],
    ["23503", "foreign_key_violation"],
    ["23505", "unique_violation"],
    ["23514", "check_violation"],
    ["23P01", "exclusion_violation"],
  ])("maps SQLSTATE %s (%s) to 422", async (code) => {
    const wrapped = withErrorHandler(async () => {
      throw Object.assign(new Error("constraint"), {
        code,
        detail: "demo detail",
      });
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toContain("demo detail");
  });
});

describe("withErrorHandler — Postgres invalid input → 422", () => {
  it.each([
    ["22P02", "invalid_text_representation"],
    ["22008", "datetime_field_overflow"],
    ["22023", "invalid_parameter_value"],
    ["22001", "string_data_right_truncation"],
  ])("maps SQLSTATE %s (%s) to 422", async (code) => {
    const wrapped = withErrorHandler(async () => {
      throw Object.assign(new Error("bad input"), { code });
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(422);
  });
});

describe("withErrorHandler — connection timeouts → 503", () => {
  it.each([
    "CONNECT_TIMEOUT",
    "CONNECTION_ENDED",
    "CONNECTION_DESTROYED",
    "CONNECTION_CLOSED",
  ])("maps %s to 503 with retry-after header", async (code) => {
    const wrapped = withErrorHandler(async () => {
      throw Object.assign(new Error("db unreachable"), { code });
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("5");
    expect(res.headers.get("content-type")).toContain("problem+json");
  });
});

describe("withErrorHandler — PaginationError → 422", () => {
  it("maps PaginationError to a validation problem+json", async () => {
    const wrapped = withErrorHandler(async () => {
      throw new PaginationError("limit", "abc", "must be a positive integer");
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      detail: string;
      errors: Array<{ path: string }>;
    };
    expect(body.detail).toMatch(/limit/);
    expect(body.errors[0].path).toBe("limit");
  });
});

describe("withErrorHandler — ZodError-shaped → 422", () => {
  it("detects {issues: [...]} and emits a 422 with path-level errors", async () => {
    const fakeZodError = Object.assign(new Error("invalid"), {
      issues: [
        { path: ["body", "email"], message: "Invalid email" },
        { path: ["body", "age"], message: "Expected number" },
      ],
    });
    const wrapped = withErrorHandler(async () => {
      throw fakeZodError;
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      errors: Array<{ path: string; message: string }>;
    };
    expect(body.errors).toHaveLength(2);
    expect(body.errors[0]).toMatchObject({
      path: "body.email",
      message: "Invalid email",
    });
  });
});

describe("withErrorHandler — FindingFkMismatchError → 500 with diagnostic body", () => {
  it("emits a structured 500 with the mismatches array", async () => {
    const mismatches = [
      {
        field: "controlId",
        expected: "uuid-x",
        actual: null,
      },
    ];
    const fkErr = Object.assign(new Error("FK mismatch"), {
      name: "FindingFkMismatchError",
      mismatches,
    });
    const wrapped = withErrorHandler(async () => {
      throw fkErr;
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      type: string;
      mismatches: unknown[];
    };
    expect(body.type).toMatch(/fk-persistence-mismatch/);
    expect(body.mismatches).toEqual(mismatches);
  });
});

describe("withErrorHandler — unknown error → 500 without leaking detail", () => {
  it("returns a generic 500 problem+json with only requestId for correlation", async () => {
    const wrapped = withErrorHandler(async () => {
      throw new Error("super secret schema name: customer_pii_v2");
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    // Critical: the error message MUST NOT appear in the response body.
    // CodeQL js/stack-trace-exposure would flag the previous shape.
    expect(JSON.stringify(body)).not.toContain("customer_pii_v2");
    expect(body.requestId).toBe("test-req-id");
    expect(body.title).toBe("Internal server error");
  });

  it("sets x-request-id header on every error response", async () => {
    const wrapped = withErrorHandler(async () => {
      throw new Error("boom");
    });
    const res = await wrapped(req(), undefined);
    expect(res.headers.get("x-request-id")).toBe("test-req-id");
  });
});

describe("withErrorHandler — observability", () => {
  it("uses a custom routeLabel when provided (for log aggregation)", async () => {
    const wrapped = withErrorHandler(async () => {
      throw new Error("x");
    }, "POST /custom/label");
    const res = await wrapped(req(), undefined);
    // Can't easily assert on log() in this mock setup, but verifying no
    // crash + correct status is enough to pin the public behaviour.
    expect(res.status).toBe(500);
  });
});
