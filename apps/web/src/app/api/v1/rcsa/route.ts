// #NIGHT-014: /api/v1/rcsa root returned 404 — only sub-routes exist.
function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? "";
}
export function GET(req: Request) {
  return Response.json({
    data: {
      module: "rcsa",
      description:
        "Risk and Control Self-Assessment — campaign-driven self-attestation by control owners",
      endpoints: [
        { method: "GET", path: "/api/v1/rcsa/campaigns" },
        { method: "GET", path: "/api/v1/rcsa/assignments" },
        { method: "GET", path: "/api/v1/rcsa/my-assignments" },
      ],
    },
    meta: { requestId: getRequestId(req) },
  });
}
