// Strict pagination contract — the over-night QA (#NIGHT-057..060)
// found that limit=0, limit=abc, offset=N, and unknown params were all
// silently coerced or ignored. These tests pin the new strict behavior:
//
//   - bad limit/page/offset → throw PaginationError (caller wraps to 422)
//   - offset → page derivation only when offset is a clean page boundary
//   - limit > MAX_PAGE_SIZE → throw (#NIGHT-059, was: silently capped)
//   - allowedParams option enables unknown-param rejection

import { describe, it, expect } from "vitest";
import { paginate, PaginationError, MAX_PAGE_SIZE } from "@/lib/api";

function params(qs: string): URLSearchParams {
  return new URLSearchParams(qs);
}

describe("paginate — defaults", () => {
  it("returns DEFAULT_PAGE_SIZE limit and page=1 when nothing is passed", () => {
    const r = paginate(params(""));
    expect(r).toMatchObject({ page: 1, limit: 20, offset: 0 });
  });
});

describe("paginate — limit", () => {
  it("accepts a valid integer", () => {
    expect(paginate(params("limit=50")).limit).toBe(50);
  });

  it("rejects limit > MAX_PAGE_SIZE (#NIGHT-059)", () => {
    expect(() => paginate(params("limit=10000"))).toThrow(PaginationError);
  });

  it("accepts limit exactly at MAX_PAGE_SIZE", () => {
    expect(paginate(params(`limit=${MAX_PAGE_SIZE}`)).limit).toBe(
      MAX_PAGE_SIZE,
    );
  });

  it("rejects limit=0", () => {
    expect(() => paginate(params("limit=0"))).toThrow(PaginationError);
  });

  it("rejects limit=-1", () => {
    expect(() => paginate(params("limit=-1"))).toThrow(PaginationError);
  });

  it("rejects limit=abc", () => {
    expect(() => paginate(params("limit=abc"))).toThrow(PaginationError);
  });

  it("rejects limit=1.5 (non-integer)", () => {
    expect(() => paginate(params("limit=1.5"))).toThrow(PaginationError);
  });
});

describe("paginate — page", () => {
  it("accepts page=3 and computes offset", () => {
    expect(paginate(params("page=3&limit=10"))).toMatchObject({
      page: 3,
      limit: 10,
      offset: 20,
    });
  });

  it("rejects page=0", () => {
    expect(() => paginate(params("page=0"))).toThrow(PaginationError);
  });

  it("rejects page=abc", () => {
    expect(() => paginate(params("page=abc"))).toThrow(PaginationError);
  });
});

describe("paginate — offset alias", () => {
  it("derives page from offset when only offset is given", () => {
    expect(paginate(params("offset=40&limit=20"))).toMatchObject({
      page: 3,
      limit: 20,
      offset: 40,
    });
  });

  it("page wins when both page and offset are present", () => {
    expect(paginate(params("page=5&offset=999&limit=10"))).toMatchObject({
      page: 5,
      offset: 40,
    });
  });

  it("rejects offset that isn't a multiple of limit", () => {
    expect(() => paginate(params("offset=15&limit=20"))).toThrow(
      PaginationError,
    );
  });

  it("accepts offset=0", () => {
    expect(paginate(params("offset=0&limit=20"))).toMatchObject({
      page: 1,
      offset: 0,
    });
  });

  it("rejects negative offset", () => {
    expect(() => paginate(params("offset=-1&limit=20"))).toThrow(
      PaginationError,
    );
  });
});

describe("paginate — unknown params", () => {
  it("ignores genuinely unknown route-specific params by default", () => {
    expect(() => paginate(params("xyz=abc&page=1"))).not.toThrow();
  });

  it("rejects common pagination typos even without allowedParams (#NIGHT-060)", () => {
    for (const typo of ["skip", "cursor", "perPage", "per_page", "pageSize"]) {
      expect(() => paginate(params(`${typo}=5`))).toThrow(PaginationError);
    }
  });

  it("rejects unknown params when allowedParams is set", () => {
    expect(() =>
      paginate(params("status=active&page=1"), { allowedParams: ["status"] }),
    ).not.toThrow();
    expect(() =>
      paginate(params("foo=bar&page=1"), { allowedParams: ["status"] }),
    ).toThrow(PaginationError);
  });
});

describe("PaginationError shape", () => {
  it("carries field, value, and reason for the wrapper to surface", () => {
    try {
      paginate(params("limit=abc"));
      expect.fail("expected paginate to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PaginationError);
      const err = e as PaginationError;
      expect(err.field).toBe("limit");
      expect(err.value).toBe("abc");
      expect(err.reason).toContain("integer");
    }
  });
});
