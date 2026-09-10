import { db, user, userOrganizationRole } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/users/:id — User details (admin or self)
export const GET = withErrorHandler(async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const isSelf = id === ctx.userId;

  // Non-admins can only view themselves
  if (!isSelf) {
    // [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076] `ctx.session.user` ist
    // vom NextAuth-Typ her offen; die Rollenliste wird hier genannt statt
    // ueber `any` unterlaufen.
    const sessionRoles = (
      ctx.session.user as { roles?: Array<{ orgId: string; role: string }> }
    ).roles;
    const isAdmin = (sessionRoles ?? []).some(
      (r) => r.orgId === ctx.orgId && r.role === "admin",
    );
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // [ARCTOS-FULL-2026-08-31 / WP2 · S01-05] Mitgliedschaftsprüfung.
  //
  // Die Autorisierung oben prüft nur, ob der AUFRUFER in SEINER Org Admin
  // ist — nicht, ob der angefragte Nutzer dieser Org überhaupt angehört. Ein
  // Admin von Mandant A bekam damit für eine beliebige fremde Nutzer-UUID
  // HTTP 200 mit email/name/avatarUrl/isActive/lastLoginAt (DSGVO Art. 32).
  // Die Datenbank fing das nicht ab, weil `user` keine RLS trug (S01-04).
  //
  // Migration 0392 gibt `user` jetzt eine Policy, die aus einem etablierten
  // Request-Kontext nur eigene Org-Mitglieder und die eigene Zeile zeigt —
  // die Abfrage unten liefert also bereits nichts mehr. Der explizite Join
  // bleibt trotzdem: er macht die Regel im Code sichtbar und trägt auch
  // dann, wenn die Route (heute nicht) ausserhalb eines Request-Kontexts
  // oder unter einer Superuser-Verbindung läuft.
  if (!isSelf) {
    const [member] = await db
      .select({ id: userOrganizationRole.id })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, id),
          eq(userOrganizationRole.orgId, ctx.orgId),
          isNull(userOrganizationRole.deletedAt),
        ),
      )
      .limit(1);
    if (!member) return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [found] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      language: user.language,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(eq(user.id, id), isNull(user.deletedAt)));

  if (!found) return Response.json({ error: "Not found" }, { status: 404 });

  // Include roles in the current org
  const roles = await db
    .select({
      id: userOrganizationRole.id,
      role: userOrganizationRole.role,
      department: userOrganizationRole.department,
      lineOfDefense: userOrganizationRole.lineOfDefense,
    })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, id),
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  return Response.json({ data: { ...found, roles } });
});
