import { db, academyCourse } from "@grc/db";
import { eq, and, sql, desc, ilike } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createAcademyCourseSchema,
  listAcademyCoursesQuerySchema,
} from "@grc/shared";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listAcademyCoursesQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions: ReturnType<typeof eq>[] = [
    eq(academyCourse.orgId, ctx.orgId),
  ];
  if (query.courseType)
    conditions.push(eq(academyCourse.courseType, query.courseType));
  if (query.isMandatory !== undefined)
    conditions.push(eq(academyCourse.isMandatory, query.isMandatory));
  if (query.isActive !== undefined)
    conditions.push(eq(academyCourse.isActive, query.isActive));
  if (query.search)
    conditions.push(ilike(academyCourse.title, `%${query.search}%`));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(academyCourse)
      .where(and(...conditions))
      .orderBy(desc(academyCourse.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(academyCourse)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createAcademyCourseSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(academyCourse)
      .values({
        orgId: ctx.orgId,
        ...body,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
