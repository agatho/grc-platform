// #NIGHT-014: /api/v1/compliance root returned 404 — only sub-routes exist.
function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? "";
}
export function GET(req: Request) {
  return Response.json({
    data: {
      module: "compliance",
      description:
        "Compliance utility endpoints — CCI catalogs and regulatory simulator",
      endpoints: [
        { method: "GET", path: "/api/v1/compliance/cci" },
        { method: "POST", path: "/api/v1/compliance/simulator" },
      ],
    },
    meta: { requestId: getRequestId(req) },
  });
}
