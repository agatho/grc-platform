/**
 * GET  /api/v1/tags — List tag definitions for the current org
 * POST /api/v1/tags — Create a new tag definition
 */
import { withAuth } from "@/lib/api";
import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

const createTagSchema = z.object({
  name: z.string().min(1).max(200),
  color: z.string().max(20).default("#6B7280"),
  category: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
});

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);

  let query = sql`SELECT id, name, color, category, description, usage_count, created_at FROM tag_definition WHERE org_id = ${ctx.orgId}`;
  if (category) query = sql`${query} AND category = ${category}`;
  if (search) query = sql`${query} AND name ILIKE ${"%" + search + "%"}`;
  query = sql`${query} ORDER BY usage_count DESC, name ASC LIMIT ${limit}`;

  const result = await db.execute(query);

  const catResult = await db.execute(
    sql`SELECT DISTINCT category FROM tag_definition WHERE org_id = ${ctx.orgId} AND category IS NOT NULL ORDER BY category`
  );

  return Response.json({
    data: result.rows,
    categories: (catResult.rows as Record<string, string>[]).map((r) => r.category),
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "auditor", "dpo", "process_owner");
  if (ctx instanceof Response) return ctx;

  const parsed = createTagSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }
  const { name, color, category, description } = parsed.data;

  const result = await db.execute(sql`
    INSERT INTO tag_definition (org_id, name, color, category, description, created_by)
    VALUES (${ctx.orgId}, ${name.trim()}, ${color}, ${category ?? null}, ${description ?? null}, ${ctx.userId})
    ON CONFLICT (org_id, name) DO UPDATE SET
      color = EXCLUDED.color,
      category = COALESCE(EXCLUDED.category, tag_definition.category),
      description = COALESCE(EXCLUDED.description, tag_definition.description)
    RETURNING id, name, color, category, description, usage_count
  `);

  return Response.json({ data: result.rows[0] }, { status: 201 });
}
