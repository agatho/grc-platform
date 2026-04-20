import { db, crisisTeamMember, crisisScenario, user } from "@grc/db";
import { addCrisisTeamMemberSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// POST /api/v1/bcms/crisis/[id]/team — Add team member
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: crisisId } = await params;

  const body = addCrisisTeamMemberSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify crisis exists
  const [crisis] = await db
    .select({ id: crisisScenario.id })
    .from(crisisScenario)
    .where(
      and(eq(crisisScenario.id, crisisId), eq(crisisScenario.orgId, ctx.orgId)),
    );

  if (!crisis) {
    return Response.json(
      { error: "Crisis scenario not found" },
      { status: 404 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(crisisTeamMember)
      .values({
        crisisScenarioId: crisisId,
        orgId: ctx.orgId,
        userId: body.data.userId,
        role: body.data.role,
        isPrimary: body.data.isPrimary,
        deputyUserId: body.data.deputyUserId,
        phoneNumber: body.data.phoneNumber,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/bcms/crisis/[id]/team — List team members
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: crisisId } = await params;
  const { page, limit, offset } = paginate(req);

  const where = and(
    eq(crisisTeamMember.crisisScenarioId, crisisId),
    eq(crisisTeamMember.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: crisisTeamMember.id,
        crisisScenarioId: crisisTeamMember.crisisScenarioId,
        orgId: crisisTeamMember.orgId,
        userId: crisisTeamMember.userId,
        userName: user.name,
        userEmail: user.email,
        role: crisisTeamMember.role,
        isPrimary: crisisTeamMember.isPrimary,
        deputyUserId: crisisTeamMember.deputyUserId,
        phoneNumber: crisisTeamMember.phoneNumber,
        createdAt: crisisTeamMember.createdAt,
      })
      .from(crisisTeamMember)
      .leftJoin(user, eq(crisisTeamMember.userId, user.id))
      .where(where)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(crisisTeamMember).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
