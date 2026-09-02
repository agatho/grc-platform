import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/audit-mgmt/auditors
//
// Listet User der aktuellen Org, die in der Rolle auditor oder admin stehen.
// Wird vom Lead-Auditor-Picker im Audit-Create/Edit-Form konsumiert.
// Keine admin-Restriction — jede:r auditor darf andere Auditor:innen sehen
// um Lead- oder Team-Zuweisungen vorzunehmen.
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const rows = await db.execute<{
    id: string;
    name: string | null;
    email: string;
    role: string;
  }>(sql`
    SELECT DISTINCT u.id, u.name, u.email, uor.role
    FROM "user" u
    JOIN user_organization_role uor ON uor.user_id = u.id
    WHERE uor.org_id = ${ctx.orgId}
      AND uor.deleted_at IS NULL
      AND u.deleted_at IS NULL
      AND u.is_active = true
      AND uor.role IN ('auditor', 'admin')
    ORDER BY u.name NULLS LAST, u.email
  `);

  return Response.json({ data: rows });
});
