// GET /api/v1/admin/license
//
// #WAVE17-P2-04: Wave-14 QA flagged this as a 404. ARCTOS is an
// open-source self-hosted GRC platform — there's no license-key
// enforcement, no per-seat metering, no remote phone-home. The /admin
// UI link is here so operators can confirm that, point at the licence
// in their compliance docs, and stop their procurement team from
// asking "where do we buy more seats from?" every quarter.
//
// Edition / build metadata is read from the bundled package.json so
// audit trails can pin the exact build that's running.

import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  return Response.json({
    data: {
      type: "self_hosted_open_source",
      edition: "community",
      // No artificial limits — the platform refuses no row, throttles
      // no API call. Practical limits are whatever the Postgres + Node
      // host can handle.
      limits: {
        users: null,
        organizations: null,
        apiRequestsPerMinute: null,
        storageGb: null,
      },
      compliance: {
        gdpr: "self_hosted__no_data_leaves_your_infrastructure",
        dataResidency: "wherever_you_host_it",
        sourceCode: "audit-able + modifiable",
      },
      links: {
        license: "https://github.com/agatho/grc-platform/blob/main/LICENSE",
        repository: "https://github.com/agatho/grc-platform",
      },
      runtime: {
        nodeVersion: process.version,
        // process.env.npm_package_version is set when launched via npm;
        // falls back to the git-tag-baked release string in CI.
        appVersion:
          process.env.npm_package_version ?? process.env.APP_VERSION ?? null,
      },
    },
  });
});
