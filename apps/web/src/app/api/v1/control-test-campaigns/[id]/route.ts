import {
  db,
  controlTestCampaign,
  controlTest,
  user,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  responsibleId: z.string().uuid().nullable().optional(),
});

// GET /api/v1/control-test-campaigns/:id — Campaign detail with test stats
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select({
      id: controlTestCampaign.id,
      orgId: controlTestCampaign.orgId,
      name: controlTestCampaign.name,
      description: controlTestCampaign.description,
      status: controlTestCampaign.status,
      periodStart: controlTestCampaign.periodStart,
      periodEnd: controlTestCampaign.periodEnd,
      responsibleId: controlTestCampaign.responsibleId,
      responsibleName: user.name,
      responsibleEmail: user.email,
      createdAt: controlTestCampaign.createdAt,
      updatedAt: controlTestCampaign.updatedAt,
      createdBy: controlTestCampaign.createdBy,
      updatedBy: controlTestCampaign.updatedBy,
    })
    .from(controlTestCampaign)
    .leftJoin(user, eq(controlTestCampaign.responsibleId, user.id))
    .where(
      and(
        eq(controlTestCampaign.id, id),
        eq(controlTestCampaign.orgId, ctx.orgId),
        isNull(controlTestCampaign.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch test stats
  const tests = await db
    .select({
      id: controlTest.id,
      controlId: controlTest.controlId,
      status: controlTest.status,
      todResult: controlTest.todResult,
      toeResult: controlTest.toeResult,
    })
    .from(controlTest)
    .where(
      and(
        eq(controlTest.campaignId, id),
        eq(controlTest.orgId, ctx.orgId),
        isNull(controlTest.deletedAt),
      ),
    );

  const testStats = {
    total: tests.length,
    planned: tests.filter((t) => t.status === "planned").length,
    inProgress: tests.filter((t) => t.status === "in_progress").length,
    completed: tests.filter((t) => t.status === "completed").length,
    cancelled: tests.filter((t) => t.status === "cancelled").length,
  };

  return Response.json({ data: { ...row, testStats, tests } });
}

// PUT /api/v1/control-test-campaigns/:id — Update campaign
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(controlTestCampaign)
    .where(
      and(
        eq(controlTestCampaign.id, id),
        eq(controlTestCampaign.orgId, ctx.orgId),
        isNull(controlTestCampaign.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateCampaignSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateValues: Record<string, unknown> = {
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };

    if (body.data.name !== undefined) updateValues.name = body.data.name;
    if (body.data.description !== undefined) updateValues.description = body.data.description;
    if (body.data.periodStart !== undefined) updateValues.periodStart = body.data.periodStart;
    if (body.data.periodEnd !== undefined) updateValues.periodEnd = body.data.periodEnd;
    if (body.data.responsibleId !== undefined) updateValues.responsibleId = body.data.responsibleId;

    const [row] = await tx
      .update(controlTestCampaign)
      .set(updateValues)
      .where(
        and(
          eq(controlTestCampaign.id, id),
          eq(controlTestCampaign.orgId, ctx.orgId),
          isNull(controlTestCampaign.deletedAt),
        ),
      )
      .returning();

    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}
