// GET /api/v1/programmes/users
//
// Liefert eine schmale Liste der Mitglieder der aktuellen Org (id, name,
// email) — wird vom Programme-Cockpit für Owner- und Subtask-Zuweisungen
// genutzt. Bewusst ohne admin-Pflicht, da jede Rolle Aufgaben zuweisen
// können muss; sensitive Felder werden nicht zurückgegeben.

import { db, user, userOrganizationRole } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { and, eq, isNull, asc } from "drizzle-orm";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const rows = await db
    .selectDistinct({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .innerJoin(userOrganizationRole, eq(userOrganizationRole.userId, user.id))
    .where(
      and(
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
        isNull(user.deletedAt),
        eq(user.isActive, true),
      ),
    )
    .orderBy(asc(user.name));

  return Response.json({ data: rows });
}
