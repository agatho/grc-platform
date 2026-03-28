import { db, importJob } from "@grc/db";
import { updateImportJobSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/import-jobs/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(importJob)
    .where(and(eq(importJob.id, id), eq(importJob.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "Import job not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PATCH /api/v1/import-jobs/:id
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const body = updateImportJobSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [updated] = await db
    .update(importJob)
    .set({ ...body.data, updatedAt: new Date() })
    .where(and(eq(importJob.id, id), eq(importJob.orgId, ctx.orgId)))
    .returning();

  if (!updated) {
    return Response.json({ error: "Import job not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}
