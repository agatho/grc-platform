import { db, importJob } from "@grc/db";
import { createImportJobSchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// POST /api/v1/import-jobs — Create import job
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createImportJobSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [created] = await db
    .insert(importJob)
    .values({
      orgId: ctx.orgId,
      source: body.data.source,
      sourceFile: body.data.sourceFile,
      templatePackId: body.data.templatePackId,
      mapping: body.data.mapping,
      createdBy: ctx.userId,
    })
    .returning();

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/import-jobs — List import jobs
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const rows = await db
    .select()
    .from(importJob)
    .where(eq(importJob.orgId, ctx.orgId))
    .orderBy(desc(importJob.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(importJob)
    .where(eq(importJob.orgId, ctx.orgId));

  return Response.json(paginatedResponse(rows, Number(count), page, limit));
}
