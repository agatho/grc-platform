/**
 * Response cache headers for API endpoints.
 *
 * - List endpoints: short cache (60s) with stale-while-revalidate
 * - Detail endpoints: no cache (data may change)
 * - Static reference data: long cache (1h)
 * - Dashboard summaries: medium cache (5min)
 */

export function withCacheHeaders(
  response: Response,
  strategy: "list" | "detail" | "static" | "dashboard",
): Response {
  const headers: Record<string, string> = {
    list: "public, max-age=60, stale-while-revalidate=120",
    detail: "private, no-cache",
    static: "public, max-age=3600, stale-while-revalidate=7200",
    dashboard: "private, max-age=300, stale-while-revalidate=600",
  };

  response.headers.set("Cache-Control", headers[strategy]);
  return response;
}
