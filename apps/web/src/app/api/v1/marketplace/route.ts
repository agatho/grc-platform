// #NIGHT-014: /api/v1/marketplace root returned 404 — only sub-routes exist.
function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? "";
}
export function GET(req: Request) {
  return Response.json({
    data: {
      module: "marketplace",
      description:
        "Plugin / extension marketplace — listings, categories, publishers, installations, security scans",
      endpoints: [
        { method: "GET", path: "/api/v1/marketplace/listings" },
        { method: "GET", path: "/api/v1/marketplace/categories" },
        { method: "GET", path: "/api/v1/marketplace/publishers" },
        { method: "GET", path: "/api/v1/marketplace/installations" },
        { method: "GET", path: "/api/v1/marketplace/reviews" },
        { method: "GET", path: "/api/v1/marketplace/security-scans" },
        { method: "GET", path: "/api/v1/marketplace/versions" },
      ],
    },
    meta: { requestId: getRequestId(req) },
  });
}
