import {
  db,
  policyDistribution,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/policies/distributions/:id/close — Close distribution
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [dist] = await db
    .select()
    .from(policyDistribution)
    .where(
      and(
        eq(policyDistribution.id, id),
        eq(policyDistribution.orgId, ctx.orgId),
      ),
    );

  if (!dist) {
    return Response.json({ error: "Distribution not found" }, { status: 404 });
  }

  if (dist.status !== "active") {
    return Response.json(
      { error: "Only active distributions can be closed" },
      { status: 409 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(policyDistribution)
      .set({
        status: "closed",
        updatedAt: new Date(),
      })
      .where(eq(policyDistribution.id, id))
      .returning();

    return row;
  });

  return Response.json({ data: updated });
}
