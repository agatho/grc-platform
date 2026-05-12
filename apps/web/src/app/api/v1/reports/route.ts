// #NIGHT-014: /api/v1/reports root returned 404 — only sub-routes exist.
// Discovery payload helps API clients find the real endpoints.
function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? "";
}
export function GET(req: Request) {
  return Response.json({
    data: {
      module: "reports",
      description:
        "BI reporting module — templates, scheduled jobs, data sources, generation pipeline",
      endpoints: [
        { method: "GET", path: "/api/v1/reports/templates" },
        { method: "GET", path: "/api/v1/reports/schedules" },
        { method: "GET", path: "/api/v1/reports/history" },
        { method: "GET", path: "/api/v1/reports/jobs" },
        { method: "GET", path: "/api/v1/reports/data-sources" },
        { method: "POST", path: "/api/v1/reports/generate" },
        { method: "POST", path: "/api/v1/reports/preview" },
      ],
    },
    meta: { requestId: getRequestId(req) },
  });
}
