// #NIGHT-036: GET /api/v1/identity discovery root.
// The QA agent tested several "/identity/*" paths that don't exist
// because identity admin lives under /api/v1/admin/{sso,scim,roles}.
// Discovery payload + 308 redirects for the most-likely typos.

function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? "";
}
export function GET(req: Request) {
  return Response.json({
    data: {
      module: "identity",
      description:
        "Identity management lives under /api/v1/admin (sso, scim, roles). This top-level path returns a discovery map.",
      endpoints: [
        {
          method: "GET",
          path: "/api/v1/admin/sso",
          aliases: ["/identity/sso-providers", "/admin/sso-providers"],
        },
        { method: "GET", path: "/api/v1/admin/sso/discover" },
        { method: "GET", path: "/api/v1/admin/sso/metadata" },
        { method: "POST", path: "/api/v1/admin/sso/test" },
        {
          method: "GET",
          path: "/api/v1/admin/scim",
          aliases: ["/identity/scim-configs"],
        },
        {
          method: "GET",
          path: "/api/v1/admin/scim/tokens",
          aliases: ["/identity/api-keys", "/admin/api-keys"],
        },
        { method: "GET", path: "/api/v1/admin/scim/logs" },
        { method: "GET", path: "/api/v1/admin/scim/stats" },
        { method: "GET", path: "/api/v1/admin/roles" },
        { method: "GET", path: "/api/v1/admin/abac/policies" },
        { method: "GET", path: "/api/v1/users", aliases: ["/admin/users"] },
        {
          method: "GET",
          path: "/api/v1/organizations",
          aliases: ["/admin/organizations"],
        },
      ],
      requestId: getRequestId(req),
    },
  });
}
