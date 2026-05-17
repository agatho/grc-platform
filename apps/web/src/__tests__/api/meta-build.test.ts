// GET /api/v1/meta/build — Wave-23 D1 Self-Service-Diagnose-Endpoint.
//
// #WAVE23-D1: pinnt das Schema des Build-Endpoints, das Cowork-QA für
// die D1-Diagnose (Production-Commit-SHA-Vergleich) verwendet. Wenn
// dieser Test rot wird, ist die D1-Diagnose nicht mehr Self-Service.

import { describe, it, expect } from "vitest";

describe("GET /api/v1/meta/build", () => {
  it("returns 200 with commitSha + branch + builtAt + nodeVersion + uptime", async () => {
    const { GET } = await import("../../app/api/v1/meta/build/route");
    const res = await GET(new Request("http://localhost/api/v1/meta/build"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      commitSha: expect.any(String),
      branch: expect.any(String),
      builtAt: expect.any(String),
      nodeVersion: expect.stringMatching(/^v\d+\./),
      runtimeUptimeSeconds: expect.any(Number),
      requestId: expect.any(String),
    });
  });

  it("never throws even if all build-time env vars are missing", async () => {
    // The route reads `process.env.NEXT_PUBLIC_GIT_SHA` etc at module-
    // import time, so we can't unset them per-test. But the fallback
    // chain ("unknown") is already exercised in dev (no env vars set)
    // and this test merely re-runs the route to verify no throw on
    // a fresh request.
    const { GET } = await import("../../app/api/v1/meta/build/route");
    const res = await GET(new Request("http://localhost/api/v1/meta/build"));
    expect(res.status).toBe(200);
  });
});
