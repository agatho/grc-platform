import {
  db,
  vendor,
  workItem,
  user,
} from "@grc/db";
import { createVendorSchema } from "@grc/shared";
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
  sql,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/vendors — Create vendor
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createVendorSchema.safeParse(await req.json());
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
        typeKey: "vendor",
        name: body.data.name,
        status: "draft",
        responsibleId: body.data.ownerId,
        grcPerspective: ["tprm"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    const [row] = await tx
      .insert(vendor)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        name: body.data.name,
        legalName: body.data.legalName,
        description: body.data.description,
        category: body.data.category,
        tier: body.data.tier,
        country: body.data.country,
        address: body.data.address,
        website: body.data.website,
        taxId: body.data.taxId,
        isLksgRelevant: body.data.isLksgRelevant,
        lksgTier: body.data.lksgTier,
        ownerId: body.data.ownerId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    return { ...row, elementId: wi.elementId };
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/vendors — List vendors with filters
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(vendor.orgId, ctx.orgId),
    isNull(vendor.deletedAt),
  ];

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "prospect" | "onboarding" | "active" | "under_review" | "suspended" | "terminated"
    >;
    conditions.push(inArray(vendor.status, statuses));
  }

  const tierParam = searchParams.get("tier");
  if (tierParam) {
    const tiers = tierParam.split(",") as Array<
      "critical" | "important" | "standard" | "low_risk"
    >;
    conditions.push(inArray(vendor.tier, tiers));
  }

  const categoryParam = searchParams.get("category");
  if (categoryParam) {
    const categories = categoryParam.split(",") as Array<
      "it_services" | "cloud_provider" | "consulting" | "facility" | "logistics" | "raw_materials" | "financial" | "hr_services" | "other"
    >;
    conditions.push(inArray(vendor.category, categories));
  }

  const countryParam = searchParams.get("country");
  if (countryParam) {
    conditions.push(eq(vendor.country, countryParam));
  }

  const lksgParam = searchParams.get("isLksgRelevant");
  if (lksgParam === "true") {
    conditions.push(eq(vendor.isLksgRelevant, true));
  } else if (lksgParam === "false") {
    conditions.push(eq(vendor.isLksgRelevant, false));
  }

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(vendor.name, pattern),
        ilike(vendor.legalName, pattern),
        ilike(vendor.description, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const sortParam = searchParams.get("sort");
  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  let orderBy;
  switch (sortParam) {
    case "name":
      orderBy = sortDir(vendor.name);
      break;
    case "tier":
      orderBy = sortDir(vendor.tier);
      break;
    case "status":
      orderBy = sortDir(vendor.status);
      break;
    case "category":
      orderBy = sortDir(vendor.category);
      break;
    case "createdAt":
      orderBy = sortDir(vendor.createdAt);
      break;
    default:
      orderBy = desc(vendor.createdAt);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: vendor.id,
        orgId: vendor.orgId,
        workItemId: vendor.workItemId,
        elementId: workItem.elementId,
        name: vendor.name,
        legalName: vendor.legalName,
        description: vendor.description,
        category: vendor.category,
        tier: vendor.tier,
        status: vendor.status,
        country: vendor.country,
        inherentRiskScore: vendor.inherentRiskScore,
        residualRiskScore: vendor.residualRiskScore,
        lastAssessmentDate: vendor.lastAssessmentDate,
        nextAssessmentDate: vendor.nextAssessmentDate,
        isLksgRelevant: vendor.isLksgRelevant,
        ownerId: vendor.ownerId,
        ownerName: user.name,
        createdAt: vendor.createdAt,
        updatedAt: vendor.updatedAt,
      })
      .from(vendor)
      .leftJoin(workItem, eq(vendor.workItemId, workItem.id))
      .leftJoin(user, eq(vendor.ownerId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(vendor).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
