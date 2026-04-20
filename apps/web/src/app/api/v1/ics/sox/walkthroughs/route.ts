import { db, soxWalkthrough } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { createSoxWalkthroughSchema } from "@grc/shared";

// GET /api/v1/ics/sox/walkthroughs — List SOX walkthroughs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const conditions = [eq(soxWalkthrough.orgId, ctx.orgId)];
  const year = searchParams.get("year");
  if (year) conditions.push(eq(soxWalkthrough.fiscalYear, parseInt(year)));

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(soxWalkthrough)
      .where(where)
      .orderBy(desc(soxWalkthrough.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(soxWalkthrough).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}

// POST /api/v1/ics/sox/walkthroughs — Create SOX walkthrough
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createSoxWalkthroughSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [item] = await tx
      .insert(soxWalkthrough)
      .values({
        orgId: ctx.orgId,
        performedBy: ctx.userId,
        performedAt: new Date(),
        ...body.data,
      })
      .returning();
    return item;
  });

  return Response.json({ data: created }, { status: 201 });
}
