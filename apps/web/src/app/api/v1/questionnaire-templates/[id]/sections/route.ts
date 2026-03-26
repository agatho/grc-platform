import {
  db,
  questionnaireTemplate,
  questionnaireSection,
} from "@grc/db";
import { createSectionSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, asc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/questionnaire-templates/:id/sections — Create section
export async function POST(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

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

  const body = createSectionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(questionnaireSection)
      .values({
        templateId: id,
        titleDe: body.data.titleDe,
        titleEn: body.data.titleEn,
        descriptionDe: body.data.descriptionDe,
        descriptionEn: body.data.descriptionEn,
        sortOrder: body.data.sortOrder,
        weight: body.data.weight.toString(),
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/questionnaire-templates/:id/sections — List sections
export async function GET(req: Request, { params }: RouteParams) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

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

  const sections = await db
    .select()
    .from(questionnaireSection)
    .where(eq(questionnaireSection.templateId, id))
    .orderBy(asc(questionnaireSection.sortOrder));

  return Response.json({ data: sections });
}
