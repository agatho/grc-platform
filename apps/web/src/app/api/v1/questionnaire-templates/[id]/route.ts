import {
  db,
  questionnaireTemplate,
  questionnaireSection,
  questionnaireQuestion,
} from "@grc/db";
import { updateTemplateSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, asc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/questionnaire-templates/:id — Get template with sections + questions
export async function GET(req: Request, { params }: RouteParams) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const template = await db.query.questionnaireTemplate.findFirst({
    where: and(
      eq(questionnaireTemplate.id, id),
      eq(questionnaireTemplate.orgId, ctx.orgId),
      isNull(questionnaireTemplate.deletedAt),
    ),
  });

  if (!template) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const sections = await db.query.questionnaireSection.findMany({
    where: eq(questionnaireSection.templateId, id),
    orderBy: asc(questionnaireSection.sortOrder),
  });

  const sectionIds = sections.map((s) => s.id);
  let questions: Array<typeof questionnaireQuestion.$inferSelect> = [];
  if (sectionIds.length > 0) {
    questions = await db
      .select()
      .from(questionnaireQuestion)
      .where(eq(questionnaireQuestion.sectionId, sectionIds[0]))
      .orderBy(asc(questionnaireQuestion.sortOrder));

    // Fetch all questions for all sections
    if (sectionIds.length > 1) {
      for (const sId of sectionIds.slice(1)) {
        const sectionQuestions = await db
          .select()
          .from(questionnaireQuestion)
          .where(eq(questionnaireQuestion.sectionId, sId))
          .orderBy(asc(questionnaireQuestion.sortOrder));
        questions = [...questions, ...sectionQuestions];
      }
    }
  }

  return Response.json({
    data: {
      ...template,
      sections: sections.map((s) => ({
        ...s,
        questions: questions.filter((q) => q.sectionId === s.id),
      })),
    },
  });
}

// PUT /api/v1/questionnaire-templates/:id — Update template (draft only)
export async function PUT(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = updateTemplateSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const existing = await db.query.questionnaireTemplate.findFirst({
    where: and(
      eq(questionnaireTemplate.id, id),
      eq(questionnaireTemplate.orgId, ctx.orgId),
      isNull(questionnaireTemplate.deletedAt),
    ),
  });

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.status !== "draft") {
    return Response.json(
      { error: "Only draft templates can be edited" },
      { status: 400 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(questionnaireTemplate)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(questionnaireTemplate.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}

// DELETE /api/v1/questionnaire-templates/:id — Soft delete
export async function DELETE(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const existing = await db.query.questionnaireTemplate.findFirst({
    where: and(
      eq(questionnaireTemplate.id, id),
      eq(questionnaireTemplate.orgId, ctx.orgId),
      isNull(questionnaireTemplate.deletedAt),
    ),
  });

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(questionnaireTemplate)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(questionnaireTemplate.id, id));
  });

  return Response.json({ message: "Deleted" });
}
