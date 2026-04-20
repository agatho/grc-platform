import { db, ropaEntry, workItem, user } from "@grc/db";
import { createRopaEntrySchema } from "@grc/shared";
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
  or,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/dpms/ropa — Create RoPA entry
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createRopaEntrySchema.safeParse(await req.json());
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
        typeKey: "ropa_entry",
        name: body.data.title,
        status: "draft",
        responsibleId: body.data.responsibleId,
        grcPerspective: ["dpms"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    const [row] = await tx
      .insert(ropaEntry)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        title: body.data.title,
        purpose: body.data.purpose,
        legalBasis: body.data.legalBasis,
        legalBasisDetail: body.data.legalBasisDetail,
        controllerOrgId: body.data.controllerOrgId,
        processorName: body.data.processorName,
        processingDescription: body.data.processingDescription,
        retentionPeriod: body.data.retentionPeriod,
        retentionJustification: body.data.retentionJustification,
        technicalMeasures: body.data.technicalMeasures,
        organizationalMeasures: body.data.organizationalMeasures,
        internationalTransfer: body.data.internationalTransfer,
        transferCountry: body.data.transferCountry,
        transferSafeguard: body.data.transferSafeguard,
        responsibleId: body.data.responsibleId,
        nextReviewDate: body.data.nextReviewDate,
        createdBy: ctx.userId,
      })
      .returning();

    return { ...row, elementId: wi.elementId };
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/dpms/ropa — List RoPA entries
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(ropaEntry.orgId, ctx.orgId),
    isNull(ropaEntry.deletedAt),
  ];

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "draft" | "active" | "under_review" | "archived"
    >;
    conditions.push(inArray(ropaEntry.status, statuses));
  }

  const legalBasisParam = searchParams.get("legalBasis");
  if (legalBasisParam) {
    const bases = legalBasisParam.split(",") as Array<
      | "consent"
      | "contract"
      | "legal_obligation"
      | "vital_interest"
      | "public_interest"
      | "legitimate_interest"
    >;
    conditions.push(inArray(ropaEntry.legalBasis, bases));
  }

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(ropaEntry.title, pattern), ilike(ropaEntry.purpose, pattern))!,
    );
  }

  const where = and(...conditions);

  const sortParam = searchParams.get("sort");
  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  let orderBy;
  switch (sortParam) {
    case "title":
      orderBy = sortDir(ropaEntry.title);
      break;
    case "status":
      orderBy = sortDir(ropaEntry.status);
      break;
    case "legalBasis":
      orderBy = sortDir(ropaEntry.legalBasis);
      break;
    default:
      orderBy = desc(ropaEntry.updatedAt);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: ropaEntry.id,
        orgId: ropaEntry.orgId,
        workItemId: ropaEntry.workItemId,
        title: ropaEntry.title,
        purpose: ropaEntry.purpose,
        legalBasis: ropaEntry.legalBasis,
        status: ropaEntry.status,
        internationalTransfer: ropaEntry.internationalTransfer,
        transferCountry: ropaEntry.transferCountry,
        nextReviewDate: ropaEntry.nextReviewDate,
        lastReviewed: ropaEntry.lastReviewed,
        responsibleId: ropaEntry.responsibleId,
        responsibleName: user.name,
        createdAt: ropaEntry.createdAt,
        updatedAt: ropaEntry.updatedAt,
      })
      .from(ropaEntry)
      .leftJoin(user, eq(ropaEntry.responsibleId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(ropaEntry).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
