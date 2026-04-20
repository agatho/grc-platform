import { db, businessCapability } from "@grc/db";
import { updateBusinessCapabilitySchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/eam/capabilities/:id — Update (reorder, reparent)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = updateBusinessCapabilitySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updateData: Record<string, unknown> = { ...body.data };

    // Recalculate level if reparenting
    if (body.data.parentId !== undefined) {
      if (body.data.parentId === null) {
        updateData.level = 1;
      } else {
        const [parent] = await tx
          .select({ level: businessCapability.level })
          .from(businessCapability)
          .where(eq(businessCapability.id, body.data.parentId));
        if (!parent) return null;
        const newLevel = parent.level + 1;
        if (newLevel > 4) return "depth_exceeded";
        updateData.level = newLevel;
      }
    }

    const [updated] = await tx
      .update(businessCapability)
      .set(updateData)
      .where(
        and(
          eq(businessCapability.id, id),
          eq(businessCapability.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });

  if (result === "depth_exceeded") {
    return Response.json(
      { error: "Maximum capability depth is 4 levels" },
      { status: 400 },
    );
  }
  if (!result) {
    return Response.json({ error: "Capability not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}
