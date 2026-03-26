import {
  db,
  dpia,
  workItem,
  user,
} from "@grc/db";
import { createDpiaSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  count,
  desc,
  asc,
  inArray,
  ilike,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/dpms/dpia — Create DPIA
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createDpiaSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [wi] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: "dpia",
        name: body.data.title,
        status: "draft",
        grcPerspective: ["dpms"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    const [row] = await tx
      .insert(dpia)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        title: body.data.title,
        processingDescription: body.data.processingDescription,
        legalBasis: body.data.legalBasis,
        necessityAssessment: body.data.necessityAssessment,
        dpoConsultationRequired: body.data.dpoConsultationRequired,
        createdBy: ctx.userId,
      })
      .returning();

    return { ...row, elementId: wi.elementId };
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/dpms/dpia — List DPIAs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(dpia.orgId, ctx.orgId),
    isNull(dpia.deletedAt),
  ];

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "draft" | "in_progress" | "completed" | "pending_dpo_review" | "approved" | "rejected"
    >;
    conditions.push(inArray(dpia.status, statuses));
  }

  const search = searchParams.get("search");
  if (search) {
    conditions.push(ilike(dpia.title, `%${search}%`));
  }

  const where = and(...conditions);

  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  const sortParam = searchParams.get("sort");
  let orderBy;
  switch (sortParam) {
    case "title":
      orderBy = sortDir(dpia.title);
      break;
    case "status":
      orderBy = sortDir(dpia.status);
      break;
    default:
      orderBy = desc(dpia.updatedAt);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: dpia.id,
        orgId: dpia.orgId,
        workItemId: dpia.workItemId,
        title: dpia.title,
        status: dpia.status,
        legalBasis: dpia.legalBasis,
        dpoConsultationRequired: dpia.dpoConsultationRequired,
        residualRiskSignOffId: dpia.residualRiskSignOffId,
        createdAt: dpia.createdAt,
        updatedAt: dpia.updatedAt,
      })
      .from(dpia)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(dpia).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
