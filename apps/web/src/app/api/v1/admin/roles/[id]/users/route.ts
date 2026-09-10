import { db, customRole, userCustomRole, user } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const assignUserSchema = z.object({ userId: z.string().uuid() });

// GET /api/v1/admin/roles/[id]/users — Users with this role
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const users = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      assignedAt: userCustomRole.createdAt,
    })
    .from(userCustomRole)
    .innerJoin(user, eq(userCustomRole.userId, user.id))
    .where(
      and(
        eq(userCustomRole.customRoleId, id),
        eq(userCustomRole.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: users });
});
// POST /api/v1/admin/roles/[id]/users — Assign user to role
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const parsed = assignUserSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Verify role exists in this org
  const [role] = await db
    .select()
    .from(customRole)
    .where(and(eq(customRole.id, id), eq(customRole.orgId, ctx.orgId)));
  if (!role) return Response.json({ error: "Role not found" }, { status: 404 });

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(userCustomRole)
      .values({
        userId: parsed.data.userId,
        orgId: ctx.orgId,
        customRoleId: id,
        createdBy: ctx.userId,
      })
      .onConflictDoNothing()
      .returning();
    return created;
  });

  if (!result)
    return Response.json(
      { error: "User already has this role" },
      { status: 409 },
    );
  return Response.json({ data: result }, { status: 201 });
});
