import { db, academyEnrollment } from "@grc/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createAcademyEnrollmentSchema, listEnrollmentsQuerySchema } from "@grc/shared";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listEnrollmentsQuerySchema.parse(Object.fromEntries(url.searchParams));
  const conditions: ReturnType<typeof eq>[] = [eq(academyEnrollment.orgId, ctx.orgId)];
  if (query.courseId) conditions.push(eq(academyEnrollment.courseId, query.courseId));
  if (query.userId) conditions.push(eq(academyEnrollment.userId, query.userId));
  if (query.status) conditions.push(eq(academyEnrollment.status, query.status));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(academyEnrollment).where(and(...conditions))
      .orderBy(desc(academyEnrollment.createdAt)).limit(query.limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(academyEnrollment).where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createAcademyEnrollmentSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(academyEnrollment).values({
      orgId: ctx.orgId, ...body, assignedBy: ctx.userId,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
