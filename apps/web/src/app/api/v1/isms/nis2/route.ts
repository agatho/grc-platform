// #NIGHT-005: /api/v1/isms/nis2 root returned 404 — only sub-routes
// (status, reports, readiness-score, reporting-tracker) exist.
// Returning a discovery payload helps API clients find the real
// endpoints without trial-and-error.

function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? "";
}

export function GET(req: Request) {
  return Response.json({
    data: {
      module: "isms.nis2",
      description: "EU NIS2 Directive (2022/2555) implementation tracker",
      endpoints: [
        {
          method: "GET",
          path: "/api/v1/isms/nis2/status",
          description: "Org-level NIS2 implementation status",
        },
        {
          method: "GET",
          path: "/api/v1/isms/nis2/readiness-score",
          description: "Aggregate readiness score",
        },
        {
          method: "GET",
          path: "/api/v1/isms/nis2/reports",
          description: "Submitted regulatory reports",
        },
        {
          method: "GET",
          path: "/api/v1/isms/nis2/reporting-tracker",
          description: "Report deadline tracker",
        },
      ],
    },
    meta: { requestId: getRequestId(req) },
  });
}
