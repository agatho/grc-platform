// #NIGHT-036: /admin/connectors discovery — connector configs are
// scattered across /api/v1/{cloud-connectors,identity-saas-connectors,
// devops-connectors,evidence-connectors}. This payload lists them.
//
// F#18 (overnight 2026-05-18): this route used to skip auth entirely
// because the payload is structural only. But the /admin/ prefix
// invariant in the rest of the app is "admin-only" — leaving one route
// open invites future routes in this directory to copy the wrong
// pattern. Now requires admin.

import { withAuth } from "@/lib/api";

function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? "";
}

export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

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
