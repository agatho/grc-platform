import { db, userOrganizationRole } from "@grc/db";
import { assignRoleSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/users/:id/roles — Assign role (admin)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id: userId } = await params;
  const body = assignRoleSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(userOrganizationRole)
      .values({
        userId,
        orgId: ctx.orgId,
        role: body.data.role,
        lineOfDefense: body.data.lineOfDefense,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
