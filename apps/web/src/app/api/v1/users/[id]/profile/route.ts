import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withAuth, withAuditContext } from "@/lib/api";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  language: z.enum(["de", "en"]).optional(),
  avatarUrl: z.string().url().max(1000).nullable().optional(),
});

// PUT /api/v1/users/:id/profile — Edit own profile (self only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  if (id !== ctx.userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = updateProfileSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const d = body.data;
  const updated = await withAuditContext(ctx, async (tx) => {
    const rows = await tx.execute(sql`
      UPDATE "user" SET
        ${d.name ? sql`name = ${d.name},` : sql``}
        ${d.language ? sql`language = ${d.language},` : sql``}
        ${d.avatarUrl !== undefined ? sql`avatar_url = ${d.avatarUrl},` : sql``}
        updated_by = ${ctx.userId}
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING id, email, name, language, avatar_url
    `);
    return rows[0];
  });

  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: updated });
}
