import { db, process, processComment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// PUT /api/v1/processes/:id/comments/:commentId/resolve — Resolve comment
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  // [ARCTOS-FULL-2026-08-31 · OP-099] Die Rollenpruefung stand hier als
  // handgeschriebene Einzelabfrage: `const [role] = await db.select(...)` ohne
  // ORDER BY und ohne Filter auf den gesuchten Rollenwert. Sie nahm damit
  // IRGENDEINE der Mitgliedschaften des Nutzers in dieser Org und verwarf die
  // uebrigen. Welche das ist, entscheidet der Ausfuehrungsplan: heute ein
  // Index-Only-Scan ueber `uor_user_org_role_active_uniq (user_id, org_id,
  // role)`, also die DEKLARATIONSREIHENFOLGE des Enums `user_role` — nicht die
  // Rechtestaerke. Ein Nutzer mit `process_owner` UND `auditor` bekam so
  // `auditor` zurueck (auditor steht an Position 4, process_owner an 6) und
  // damit eine 403 auf eine Aktion, zu der er berechtigt ist. Bei einer
  // anderen Statistik waere es ein Seq Scan und damit die Heap-Reihenfolge.
  //
  // `withAuth(...)` prueft gegen ALLE Rollen des Nutzers in der aktuellen Org
  // (requireRole -> roles.some), liest sie frisch aus der Datenbank und ist
  // die Stelle, an der jede andere Route dieselbe Frage stellt. Damit
  // verschwindet zugleich der zweite Mangel der Einzelabfrage: sie lief VOR
  // dem zentralen Rollenboden und konnte nicht von den Custom-Rollen (S02-02)
  // profitieren.
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, commentId } = await params;

  // Verify process exists
  const [proc] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Fetch comment
  const [existing] = await db
    .select({
      id: processComment.id,
      isResolved: processComment.isResolved,
    })
    .from(processComment)
    .where(
      and(
        eq(processComment.id, commentId),
        eq(processComment.processId, id),
        eq(processComment.orgId, ctx.orgId),
        isNull(processComment.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  if (existing.isResolved) {
    return Response.json(
      { error: "Comment is already resolved" },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(processComment)
      .set({
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(processComment.id, commentId),
          eq(processComment.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });

  return Response.json({ data: updated });
});
