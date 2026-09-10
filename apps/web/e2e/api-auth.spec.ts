import { test, expect } from "@playwright/test";

// [E2E-TRIAGE-2026-09-02]
//
// Both tests here asserted the pre-remediation error shape:
//
//   * `json.error === "Unauthorized"` — the audit replaced the ad-hoc
//     `{ error: "…" }` bodies with RFC 7807 problem documents
//     (`{ type, title, status, detail, requestId }`), so `json.error` is now
//     `undefined` on the auth-refusal path.
//   * `content-type` contains `"application/json"` — RFC 7807 mandates
//     `application/problem+json`, which does NOT contain that substring.
//
// The PROPERTY both tests exist to protect is unchanged and is still asserted
// below, in stronger form than before: an unauthenticated API call must be
// refused with 401, must answer in a machine-readable JSON dialect, must
// identify itself as an authentication failure, and must never be answered
// with an HTML login page or a redirect to one. Only the wire format of the
// body was updated.

/** RFC 7807 media type, plus plain JSON for handlers not yet migrated. */
const JSON_DIALECT = /^application\/(problem\+)?json\b/;

test.describe("API Authentication", () => {
  test("API routes return a 401 problem document for unauthenticated requests", async ({
    request,
  }) => {
    const endpoints = [
      "/api/v1/catalogs/risks",
      "/api/v1/catalogs/controls",
      "/api/v1/budgets",
      "/api/v1/budget/usage",
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(endpoint);
      expect(res.status(), `${endpoint} must refuse anonymous access`).toBe(
        401,
      );

      expect(
        res.headers()["content-type"] ?? "",
        `${endpoint} answered with a non-JSON body`,
      ).toMatch(JSON_DIALECT);

      const json = (await res.json()) as {
        status?: number;
        title?: string;
        type?: string;
        detail?: string;
        error?: string;
      };

      // RFC 7807: `status` must repeat the HTTP status, and `type`/`title`
      // must name the problem. Accept the legacy `{ error: "Unauthorized" }`
      // too, so a handler that has not been migrated yet still passes — but
      // never accept a body that says nothing about authentication.
      expect(json.status ?? 401, `${endpoint}: problem.status mismatch`).toBe(
        401,
      );
      const names = `${json.type ?? ""} ${json.title ?? ""} ${json.error ?? ""}`;
      expect(
        names,
        `${endpoint}: the 401 body does not identify itself as an ` +
          `authentication failure (got ${JSON.stringify(json)})`,
      ).toMatch(/unauthori[sz]ed/i);
    }
  });

  test("API routes never redirect to an HTML login page", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/catalogs/risks", {
      maxRedirects: 0,
    });

    // A browser redirect would send an API client to the login HTML.
    expect(res.status(), "API refusals must not redirect").not.toBe(302);
    expect(res.status(), "API refusals must not redirect").not.toBe(307);
    expect(res.status()).toBe(401);

    const contentType = res.headers()["content-type"] ?? "";
    expect(contentType, "an API refusal must be machine-readable").toMatch(
      JSON_DIALECT,
    );
    expect(contentType).not.toContain("text/html");
    expect(await res.text()).not.toContain("<html");
  });
});
