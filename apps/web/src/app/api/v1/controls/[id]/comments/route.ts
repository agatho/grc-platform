import { db, entityComment, user } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { z } from "zod";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

// #NIGHT-035: per-control comments thread (mirror of /risks/{id}/comments).

const createCommentSchema = z.object({
  body: z.string().min(1).max(10_000),
  parentCommentId: z.string().uuid().optional(),
});

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;

  const rows = await db
    .select({
      id: entityComment.id,
      body: entityComment.body,
      parentCommentId: entityComment.parentCommentId,
      editCount: entityComment.editCount,
      editedAt: entityComment.editedAt,
      authorId: entityComment.createdBy,
      authorName: user.name,
      authorEmail: user.email,
      createdAt: entityComment.createdAt,
    })
    .from(entityComment)
    .leftJoin(user, eq(entityComment.createdBy, user.id))
    .where(
      and(
        eq(entityComment.orgId, ctx.orgId),
        eq(entityComment.entityType, "control"),
        eq(entityComment.entityId, id),
        isNull(entityComment.deletedAt),
      ),
    )
    .orderBy(desc(entityComment.createdAt));

  return Response.json({ data: rows, total: rows.length });
});

export const POST = withErrorHandler<IdCtx>(async function POST(
  req,
  { params },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const body = createCommentSchema.parse(await req.json());

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(entityComment)
      .values({
        orgId: ctx.orgId,
        entityType: "control",
        entityId: id,
        body: body.body,
        parentCommentId: body.parentCommentId,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
