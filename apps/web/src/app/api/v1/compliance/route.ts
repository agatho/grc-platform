// #NIGHT-014: /api/v1/compliance root returned 404 — only sub-routes exist.
function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? "";
}
export function GET(req: Request) {
  return Response.json({
    data: {
      module: "compliance",
      description:
        "Compliance overview endpoints — CCI catalogs, regulatory simulator, and the cross-framework rollups that feed compliance dashboards",
      endpoints: [
        { method: "GET", path: "/api/v1/compliance/cci" },
        { method: "POST", path: "/api/v1/compliance/simulator" },
        { method: "GET", path: "/api/v1/compliance/coverage" },
        { method: "GET", path: "/api/v1/compliance/score" },
        { method: "GET", path: "/api/v1/compliance/calendar" },
      ],
    },
    meta: { requestId: getRequestId(req) },
  });
}
