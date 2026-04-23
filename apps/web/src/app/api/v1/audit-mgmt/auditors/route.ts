import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";

// GET /api/v1/audit-mgmt/auditors
//
// Listet User der aktuellen Org, die in der Rolle auditor oder admin stehen.
// Wird vom Lead-Auditor-Picker im Audit-Create/Edit-Form konsumiert.
// Keine admin-Restriction — jede:r auditor darf andere Auditor:innen sehen
// um Lead- oder Team-Zuweisungen vorzunehmen.
export async function GET(req: Request) {
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
}
