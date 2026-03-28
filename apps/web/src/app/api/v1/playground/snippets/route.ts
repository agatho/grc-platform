import { db, apiPlaygroundSnippet } from "@grc/db";
import { createPlaygroundSnippetSchema } from "@grc/shared";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// POST /api/v1/playground/snippets
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createPlaygroundSnippetSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [created] = await db
    .insert(apiPlaygroundSnippet)
    .values({
      orgId: ctx.orgId,
      ...body.data,
      createdBy: ctx.userId,
    })
    .returning();

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/playground/snippets
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const rows = await db
    .select()
    .from(apiPlaygroundSnippet)
    .where(
      and(
        eq(apiPlaygroundSnippet.orgId, ctx.orgId),
        or(
          eq(apiPlaygroundSnippet.createdBy, ctx.userId),
          eq(apiPlaygroundSnippet.isPublic, true),
        ),
      ),
    )
    .orderBy(desc(apiPlaygroundSnippet.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(apiPlaygroundSnippet)
    .where(eq(apiPlaygroundSnippet.orgId, ctx.orgId));

  return Response.json(paginatedResponse(rows, Number(count), page, limit));
}
