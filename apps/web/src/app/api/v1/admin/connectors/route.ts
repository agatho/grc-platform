// #NIGHT-036: /admin/connectors discovery — connector configs are
// scattered across /api/v1/{cloud-connectors,identity-saas-connectors,
// devops-connectors,evidence-connectors}. This payload lists them.

function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? "";
}
export function GET(req: Request) {
  return Response.json({
    data: {
      module: "admin.connectors",
      description:
        "Connector configurations are organised by integration domain. This admin path returns the full inventory.",
      endpoints: [
        {
          method: "GET",
          path: "/api/v1/cloud-connectors",
          description: "AWS / Azure / GCP",
        },
        {
          method: "GET",
          path: "/api/v1/identity-saas-connectors",
          description: "Okta / Entra / Workday",
        },
        {
          method: "GET",
          path: "/api/v1/devops-connectors",
          description: "GitHub / GitLab / Jira",
        },
        {
          method: "GET",
          path: "/api/v1/evidence-connectors",
          description: "S3 / SharePoint / Confluence",
        },
      ],
      requestId: getRequestId(req),
    },
  });
}
