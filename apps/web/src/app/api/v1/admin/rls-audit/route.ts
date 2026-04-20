import { runRlsAudit } from "@grc/db";
import { withAuth } from "@/lib/api";

// GET /api/v1/admin/rls-audit
//
// Exposes the ADR-001 RLS coverage check as an API endpoint so the
// admin UI can render a current-state report and a CI job can fail a
// deploy if new tenant tables were added without an RLS policy.
//
// Admin-only. The check reads pg_catalog (RLS state, policies) and
// information_schema.columns; it does not read any tenant data, so
// exposing it to admins is safe.
//
// 200 { data: RlsAuditReport }    — report generated
// 503 { error, data }             — same body, but hints that at least
//                                    one tenant table is not protected
//                                    (CI can grep for the status code)
export async function GET(_req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const report = await runRlsAudit();
  const gaps =
    report.counts.tenantsMissingRls +
    report.counts.tenantsMissingForce +
    report.counts.tenantsMissingPolicies;

  return Response.json(
    { data: report },
    { status: gaps === 0 ? 200 : 503 },
  );
}
