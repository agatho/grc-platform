import {
  db,
  questionnaireTemplate,
  questionnaireSection,
  questionnaireQuestion,
} from "@grc/db";
import { createQuestionSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, asc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string; sectionId: string }>;
}

// POST /api/v1/questionnaire-templates/:id/sections/:sectionId/questions — Create question
export async function POST(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, sectionId } = await params;

  // Verify template belongs to org and is draft
  const template = await db.query.questionnaireTemplate.findFirst({
    where: and(
      eq(questionnaireTemplate.id, id),
      eq(questionnaireTemplate.orgId, ctx.orgId),
      isNull(questionnaireTemplate.deletedAt),
    ),
  });

  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  if (template.status !== "draft") {
    return Response.json(
      { error: "Only draft templates can be modified" },
      { status: 400 },
    );
  }

  // Verify section belongs to template
  const section = await db.query.questionnaireSection.findFirst({
    where: and(
      eq(questionnaireSection.id, sectionId),
      eq(questionnaireSection.templateId, id),
    ),
  });

  if (!section) {
    return Response.json({ error: "Section not found" }, { status: 404 });
  }

  const body = createQuestionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(questionnaireQuestion)
      .values({
        sectionId,
        questionType: body.data.questionType,
        questionDe: body.data.questionDe,
        questionEn: body.data.questionEn,
        helpTextDe: body.data.helpTextDe,
        helpTextEn: body.data.helpTextEn,
        options: body.data.options ?? [],
        isRequired: body.data.isRequired,
        isEvidenceRequired: body.data.isEvidenceRequired,
        conditionalOn: body.data.conditionalOn ?? null,
        weight: body.data.weight.toString(),
        maxScore: body.data.maxScore,
        sortOrder: body.data.sortOrder,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/questionnaire-templates/:id/sections/:sectionId/questions — List questions
export async function GET(req: Request, { params }: RouteParams) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, sectionId } = await params;

  // Verify template belongs to org
  const template = await db.query.questionnaireTemplate.findFirst({
    where: and(
      eq(questionnaireTemplate.id, id),
      eq(questionnaireTemplate.orgId, ctx.orgId),
      isNull(questionnaireTemplate.deletedAt),
    ),
  });

  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  // Verify section belongs to template
  const section = await db.query.questionnaireSection.findFirst({
    where: and(
      eq(questionnaireSection.id, sectionId),
      eq(questionnaireSection.templateId, id),
    ),
  });

  if (!section) {
    return Response.json({ error: "Section not found" }, { status: 404 });
  }

  const questions = await db
    .select()
    .from(questionnaireQuestion)
    .where(eq(questionnaireQuestion.sectionId, sectionId))
    .orderBy(asc(questionnaireQuestion.sortOrder));

  return Response.json({ data: questions });
}
