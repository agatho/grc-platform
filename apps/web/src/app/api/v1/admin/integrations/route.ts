// GET /api/v1/admin/integrations
//
// #WAVE17-P2-04: Wave-14 QA flagged this as a 404. The canonical
// inventory has historically lived at /api/v1/admin/connectors
// (#NIGHT-036), but the Wave-14 settings UI links to "integrations"
// — the more user-friendly term for the same thing. Returns the same
// inventory shape as /admin/connectors plus a per-domain reachability
// roll-up so the settings page can colour the tile red/yellow/green.

import { db, connectorInstance } from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

interface IntegrationDomain {
  domain: string;
  description: string;
  configEndpoint: string;
  // connector_type prefixes that route to this domain. The
  // `connector_instance.connector_type` column holds values like
  // `aws`, `azure`, `gcp`, `okta`, etc.; we bucket them into the four
  // higher-level domains the UI surfaces.
  typePrefixes: readonly string[];
  active: number;
  total: number;
}

export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // Roll-up per connector_type. Drizzle returns rows; we bucket them
  // into four UI-facing domains by type prefix. Type list is open
  // (governed by connector_type_definition), so prefix-bucketing is
  // forward-compatible — new types just need to slot under one of the
  // existing prefixes or extend the table below.
  const counts = await db
    .select({
      connectorType: connectorInstance.connectorType,
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${connectorInstance.isActive} = true)::int`,
    })
    .from(connectorInstance)
    .where(eq(connectorInstance.orgId, ctx.orgId))
    .groupBy(connectorInstance.connectorType);

  const sumFor = (prefixes: readonly string[]) => {
    let total = 0;
    let active = 0;
    for (const c of counts) {
      if (prefixes.some((p) => c.connectorType.startsWith(p))) {
        total += c.total;
        active += c.active;
      }
    }
    return { total, active };
  };

  const domainSpecs = [
    {
      domain: "cloud",
      description: "AWS / Azure / GCP cloud-account connectors",
      configEndpoint: "/api/v1/cloud-connectors",
      typePrefixes: ["aws", "azure", "gcp"] as const,
    },
    {
      domain: "identity_saas",
      description: "Okta / Entra / Workday identity providers",
      configEndpoint: "/api/v1/identity-saas-connectors",
      typePrefixes: ["okta", "entra", "workday", "scim"] as const,
    },
    {
      domain: "devops",
      description: "GitHub / GitLab / Jira pipeline + ticket connectors",
      configEndpoint: "/api/v1/devops-connectors",
      typePrefixes: ["github", "gitlab", "jira"] as const,
    },
    {
      domain: "evidence",
      description: "S3 / SharePoint / Confluence evidence repositories",
      configEndpoint: "/api/v1/evidence-connectors",
      typePrefixes: ["s3", "sharepoint", "confluence"] as const,
    },
  ];

  const domains: IntegrationDomain[] = domainSpecs.map((s) => ({
    ...s,
    ...sumFor(s.typePrefixes),
  }));

  const totalActive = domains.reduce((s, d) => s + d.active, 0);
  const totalConfigured = domains.reduce((s, d) => s + d.total, 0);

  return Response.json({
    data: {
      module: "admin.integrations",
      summary: {
        totalDomains: domains.length,
        totalConfigured,
        totalActive,
      },
      domains,
      note: "Same inventory as /api/v1/admin/connectors. POST/PUT operations live on each per-domain endpoint.",
    },
  });
});
