import { db, templatePack, templatePackItem, importJob } from "@grc/db";
import { applyTemplatePackSchema } from "@grc/shared";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/template-packs/:id/apply — Apply template pack to org
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const body = applyTemplatePackSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [pack] = await db.select().from(templatePack).where(eq(templatePack.id, id));
  if (!pack) {
    return Response.json({ error: "Template pack not found" }, { status: 404 });
  }

  const items = await db
    .select()
    .from(templatePackItem)
    .where(eq(templatePackItem.packId, id));

  // Create import job for async processing
  const [job] = await db
    .insert(importJob)
    .values({
      orgId: ctx.orgId,
      source: "template_pack",
      templatePackId: id,
      totalItems: items.length,
      mapping: body.data.options as Record<string, unknown>,
      status: "pending",
      createdBy: ctx.userId,
    })
    .returning();

  return Response.json({ data: job }, { status: 202 });
}
