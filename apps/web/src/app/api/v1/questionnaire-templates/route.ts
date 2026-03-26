import {
  db,
  questionnaireTemplate,
} from "@grc/db";
import { createTemplateSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  count,
  desc,
  asc,
  ilike,
  inArray,
  or,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/questionnaire-templates — Create template
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createTemplateSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(questionnaireTemplate)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        description: body.data.description,
        targetTier: body.data.targetTier,
        targetTopics: body.data.targetTopics,
        estimatedMinutes: body.data.estimatedMinutes,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/questionnaire-templates — List templates
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(questionnaireTemplate.orgId, ctx.orgId),
    isNull(questionnaireTemplate.deletedAt),
  ];

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "draft" | "published" | "archived"
    >;
    conditions.push(inArray(questionnaireTemplate.status, statuses));
  }

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(questionnaireTemplate.name, pattern),
        ilike(questionnaireTemplate.description, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  const sortParam = searchParams.get("sort");
  let orderBy;
  switch (sortParam) {
    case "name":
      orderBy = sortDir(questionnaireTemplate.name);
      break;
    case "status":
      orderBy = sortDir(questionnaireTemplate.status);
      break;
    case "version":
      orderBy = sortDir(questionnaireTemplate.version);
      break;
    default:
      orderBy = desc(questionnaireTemplate.updatedAt);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(questionnaireTemplate)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(questionnaireTemplate)
      .where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
