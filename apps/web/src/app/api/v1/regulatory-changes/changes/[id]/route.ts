import { db, regulatoryChange } from "@grc/db";
import { updateRegulatoryChangeSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/regulatory-changes/changes/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "dpo",
    "risk_manager",
    "auditor",
    "control_owner",
  );
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const [change] = await db
    .select()
    .from(regulatoryChange)
    .where(
      and(eq(regulatoryChange.id, id), eq(regulatoryChange.orgId, ctx.orgId)),
    );

  if (!change) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: change });
}

// PATCH /api/v1/regulatory-changes/changes/:id — Update status
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = updateRegulatoryChangeSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(regulatoryChange)
      .set({
        status: body.data.status,
        reviewedBy: ctx.userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(regulatoryChange.id, id), eq(regulatoryChange.orgId, ctx.orgId)),
      )
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
