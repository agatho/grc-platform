import { db, crisisTeamMember } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/bcms/crisis/[id]/team/[memberId] — Remove team member
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: crisisId, memberId } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .delete(crisisTeamMember)
      .where(
        and(
          eq(crisisTeamMember.id, memberId),
          eq(crisisTeamMember.crisisScenarioId, crisisId),
          eq(crisisTeamMember.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Team member not found" }, { status: 404 });
  }

  return Response.json({ data: { id: deleted.id, deleted: true } });
}
