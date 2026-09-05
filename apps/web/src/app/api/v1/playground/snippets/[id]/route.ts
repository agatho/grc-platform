import { db, apiPlaygroundSnippet } from "@grc/db";
import { updatePlaygroundSnippetSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/playground/snippets/:id
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(apiPlaygroundSnippet)
    .where(
      and(
        eq(apiPlaygroundSnippet.id, id),
        eq(apiPlaygroundSnippet.orgId, ctx.orgId),
      ),
    );

  if (!row) {
    return Response.json({ error: "Snippet not found" }, { status: 404 });
  }

  return Response.json({ data: row });
});
// PATCH /api/v1/playground/snippets/:id
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const body = updatePlaygroundSnippetSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [updated] = await db
    .update(apiPlaygroundSnippet)
    .set({ ...body.data, updatedAt: new Date() })
    .where(
      and(
        eq(apiPlaygroundSnippet.id, id),
        eq(apiPlaygroundSnippet.orgId, ctx.orgId),
        eq(apiPlaygroundSnippet.createdBy, ctx.userId),
      ),
    )
    .returning();

  if (!updated) {
    return Response.json(
      { error: "Snippet not found or no permission" },
      { status: 404 },
    );
  }

  return Response.json({ data: updated });
});
// DELETE /api/v1/playground/snippets/:id
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [deleted] = await db
    .delete(apiPlaygroundSnippet)
    .where(
      and(
        eq(apiPlaygroundSnippet.id, id),
        eq(apiPlaygroundSnippet.orgId, ctx.orgId),
        eq(apiPlaygroundSnippet.createdBy, ctx.userId),
      ),
    )
    .returning();

  if (!deleted) {
    return Response.json(
      { error: "Snippet not found or no permission" },
      { status: 404 },
    );
  }

  return Response.json({ data: { id } });
});
