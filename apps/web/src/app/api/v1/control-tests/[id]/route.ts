import { db, controlTest, control, user, evidence, finding } from "@grc/db";
import { executeTestSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const updateTestSchema = z.object({
  testType: z
    .enum(["design_effectiveness", "operating_effectiveness"])
    .optional(),
  todResult: z
    .enum(["effective", "ineffective", "partially_effective", "not_tested"])
    .optional(),
  toeResult: z
    .enum(["effective", "ineffective", "partially_effective", "not_tested"])
    .optional(),
  testDate: z.string().optional(),
  sampleSize: z.number().int().positive().optional(),
  sampleDescription: z.string().optional(),
  conclusion: z.string().optional(),
  testerId: z.string().uuid().nullable().optional(),
});

// GET /api/v1/control-tests/:id — Test detail with evidence + findings
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
      id: controlTest.id,
      orgId: controlTest.orgId,
      controlId: controlTest.controlId,
      controlTitle: control.title,
      controlStatus: control.status,
      campaignId: controlTest.campaignId,
      taskId: controlTest.taskId,
      testType: controlTest.testType,
      status: controlTest.status,
      todResult: controlTest.todResult,
      toeResult: controlTest.toeResult,
      testerId: controlTest.testerId,
      testerName: user.name,
      testerEmail: user.email,
      testDate: controlTest.testDate,
      sampleSize: controlTest.sampleSize,
      sampleDescription: controlTest.sampleDescription,
      conclusion: controlTest.conclusion,
      createdAt: controlTest.createdAt,
      updatedAt: controlTest.updatedAt,
      createdBy: controlTest.createdBy,
      updatedBy: controlTest.updatedBy,
    })
    .from(controlTest)
    .innerJoin(control, eq(controlTest.controlId, control.id))
    .leftJoin(user, eq(controlTest.testerId, user.id))
    .where(
      and(
        eq(controlTest.id, id),
        eq(controlTest.orgId, ctx.orgId),
        isNull(controlTest.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch evidence for this test
  const evidenceItems = await db
    .select()
    .from(evidence)
    .where(
      and(
        eq(evidence.entityType, "control_test"),
        eq(evidence.entityId, id),
        eq(evidence.orgId, ctx.orgId),
        isNull(evidence.deletedAt),
      ),
    );

  // Fetch findings from this test
  const findings = await db
    .select()
    .from(finding)
    .where(
      and(
        eq(finding.controlTestId, id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    );

  return Response.json({ data: { ...row, evidence: evidenceItems, findings } });
}

// PUT /api/v1/control-tests/:id — Execute/update test (todResult, toeResult, notes)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "auditor",
    "control_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(controlTest)
    .where(
      and(
        eq(controlTest.id, id),
        eq(controlTest.orgId, ctx.orgId),
        isNull(controlTest.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateTestSchema.safeParse(await req.json());
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

    if (body.data.testType !== undefined)
      updateValues.testType = body.data.testType;
    if (body.data.todResult !== undefined)
      updateValues.todResult = body.data.todResult;
    if (body.data.toeResult !== undefined)
      updateValues.toeResult = body.data.toeResult;
    if (body.data.testDate !== undefined)
      updateValues.testDate = body.data.testDate;
    if (body.data.sampleSize !== undefined)
      updateValues.sampleSize = body.data.sampleSize;
    if (body.data.sampleDescription !== undefined)
      updateValues.sampleDescription = body.data.sampleDescription;
    if (body.data.conclusion !== undefined)
      updateValues.conclusion = body.data.conclusion;
    if (body.data.testerId !== undefined)
      updateValues.testerId = body.data.testerId;

    // Auto-set status based on results
    if (body.data.todResult || body.data.toeResult) {
      if (existing.status === "planned") {
        updateValues.status = "in_progress";
      }
      // If both results are provided, mark as completed
      const finalTod = body.data.todResult ?? existing.todResult;
      const finalToe = body.data.toeResult ?? existing.toeResult;
      if (finalTod && finalToe) {
        updateValues.status = "completed";
      }
    }

    const [row] = await tx
      .update(controlTest)
      .set(updateValues)
      .where(
        and(
          eq(controlTest.id, id),
          eq(controlTest.orgId, ctx.orgId),
          isNull(controlTest.deletedAt),
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
