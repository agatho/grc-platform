import { db, academyEnrollment } from "@grc/db";
import { withAuth, withAuditContext } from "@/lib/api";
import { bulkEnrollSchema } from "@grc/shared";

// POST /api/v1/academy/enrollments/bulk
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = bulkEnrollSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const values = body.userIds.map((userId) => ({
      orgId: ctx.orgId,
      userId,
      courseId: body.courseId,
      assignedBy: ctx.userId,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    }));

    const created = await tx
      .insert(academyEnrollment)
      .values(values)
      .onConflictDoNothing()
      .returning();
    return created;
  });

  return Response.json({ data: result, count: result.length }, { status: 201 });
}
