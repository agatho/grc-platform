import { db, tia, workItem, user } from "@grc/db";
import { createTiaSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, desc, asc, inArray, ilike } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/dpms/tia — Create TIA
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createTiaSchema.safeParse(await req.json());
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
        typeKey: "tia",
        name: body.data.title,
        status: "open",
        responsibleId: body.data.responsibleId,
        grcPerspective: ["dpms"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    const [row] = await tx
      .insert(tia)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        title: body.data.title,
        transferCountry: body.data.transferCountry,
        legalBasis: body.data.legalBasis,
        schremsIiAssessment: body.data.schremsIiAssessment,
        riskRating: body.data.riskRating,
        supportingDocuments: body.data.supportingDocuments,
        responsibleId: body.data.responsibleId,
        assessmentDate: body.data.assessmentDate,
        nextReviewDate: body.data.nextReviewDate,
        createdBy: ctx.userId,
      })
      .returning();

    return { ...row, elementId: wi.elementId };
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/dpms/tia — List TIAs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(tia.orgId, ctx.orgId), isNull(tia.deletedAt)];

  const riskRatingParam = searchParams.get("riskRating");
  if (riskRatingParam) {
    const ratings = riskRatingParam.split(",") as Array<
      "low" | "medium" | "high"
    >;
    conditions.push(inArray(tia.riskRating, ratings));
  }

  const countryParam = searchParams.get("transferCountry");
  if (countryParam) {
    conditions.push(eq(tia.transferCountry, countryParam));
  }

  const legalBasisParam = searchParams.get("legalBasis");
  if (legalBasisParam) {
    const bases = legalBasisParam.split(",") as Array<
      "adequacy" | "sccs" | "bcrs" | "derogation"
    >;
    conditions.push(inArray(tia.legalBasis, bases));
  }

  const search = searchParams.get("search");
  if (search) {
    conditions.push(ilike(tia.title, `%${search}%`));
  }

  const where = and(...conditions);

  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  const sortParam = searchParams.get("sort");
  let orderBy;
  switch (sortParam) {
    case "title":
      orderBy = sortDir(tia.title);
      break;
    case "riskRating":
      orderBy = sortDir(tia.riskRating);
      break;
    case "transferCountry":
      orderBy = sortDir(tia.transferCountry);
      break;
    default:
      orderBy = desc(tia.updatedAt);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: tia.id,
        orgId: tia.orgId,
        workItemId: tia.workItemId,
        title: tia.title,
        transferCountry: tia.transferCountry,
        legalBasis: tia.legalBasis,
        riskRating: tia.riskRating,
        responsibleId: tia.responsibleId,
        responsibleName: user.name,
        assessmentDate: tia.assessmentDate,
        nextReviewDate: tia.nextReviewDate,
        createdAt: tia.createdAt,
        updatedAt: tia.updatedAt,
      })
      .from(tia)
      .leftJoin(user, eq(tia.responsibleId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(tia).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
