import {
  db,
  questionnaireTemplate,
  questionnaireSection,
  questionnaireQuestion,
} from "@grc/db";
import { publishTemplateSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/questionnaire-templates/:id/publish — Publish template
export async function POST(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = publishTemplateSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

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

  if (template.status !== "draft") {
    return Response.json(
      { error: "Only draft templates can be published" },
      { status: 400 },
    );
  }

  // Verify template has at least one section with at least one question
  const sections = await db
    .select()
    .from(questionnaireSection)
    .where(eq(questionnaireSection.templateId, id));

  if (sections.length === 0) {
    return Response.json(
      { error: "Template must have at least one section" },
      { status: 400 },
    );
  }

  // Compute total max score from all questions
  const scoreResult = (await db.execute(sql`
    SELECT COALESCE(SUM(q.max_score), 0)::int as total
    FROM questionnaire_question q
    INNER JOIN questionnaire_section s ON q.section_id = s.id
    WHERE s.template_id = ${id}
  `)) as unknown as Array<Record<string, unknown>>;
  const totalMaxScore = (scoreResult[0]?.total as number) ?? 0;

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(questionnaireTemplate)
      .set({
        status: "published",
        version: template.version + 1,
        totalMaxScore,
        updatedAt: new Date(),
      })
      .where(eq(questionnaireTemplate.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
