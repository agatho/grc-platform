import { test, expect } from "@playwright/test";

test.describe("API Authentication", () => {
  test("API routes return 401 JSON for unauthenticated requests", async ({ request }) => {
    const endpoints = [
      "/api/v1/catalogs/risks",
      "/api/v1/catalogs/controls",
      "/api/v1/budgets",
      "/api/v1/budget/usage",
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(endpoint);
      expect(res.status()).toBe(401);

      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    }
  });

  test("API routes never redirect to HTML login page", async ({ request }) => {
    const res = await request.get("/api/v1/catalogs/risks", {
      maxRedirects: 0,
    });

    // Should be 401, not 302
    expect(res.status()).not.toBe(302);
    expect(res.headers()["content-type"]).toContain("application/json");
  });
});
