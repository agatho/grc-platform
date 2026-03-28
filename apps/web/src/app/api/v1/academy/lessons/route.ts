import { db, academyLesson } from "@grc/db";
import { eq, and, asc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createAcademyLessonSchema } from "@grc/shared";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return Response.json({ error: "courseId is required" }, { status: 400 });

  const rows = await db.select().from(academyLesson)
    .where(and(eq(academyLesson.courseId, courseId), eq(academyLesson.orgId, ctx.orgId)))
    .orderBy(asc(academyLesson.sortOrder));

  return Response.json({ data: rows });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createAcademyLessonSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(academyLesson).values({ orgId: ctx.orgId, ...body }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
