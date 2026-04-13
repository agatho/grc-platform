/**
 * GET  /api/v1/tags — List tag definitions for the current org
 * POST /api/v1/tags — Create a new tag definition
 *
 * Query params:
 *   category — filter by category
 *   search   — substring match on name
 *   limit    — max results (default 100)
 */
import { withAuth, withAuditContext } from "@/lib/api";
import { db } from "@grc/db";
import { sql } from "drizzle-orm";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);

  let query = `
    SELECT id, name, color, category, description, usage_count, created_at
    FROM tag_definition
    WHERE org_id = '${ctx.orgId}'
  `;

  if (category) query += ` AND category = '${category}'`;
  if (search) query += ` AND name ILIKE '%${search.replace(/'/g, "''")}%'`;
  query += ` ORDER BY usage_count DESC, name ASC LIMIT ${limit}`;

  const result = await db.execute(sql.raw(query));

  // Also fetch distinct categories
  const catResult = await db.execute(
    sql.raw(`SELECT DISTINCT category FROM tag_definition WHERE org_id = '${ctx.orgId}' AND category IS NOT NULL ORDER BY category`)
  );

  return Response.json({
    data: result,
    categories: (catResult as any[]).map((r: any) => r.category),
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "auditor", "dpo", "process_owner");
  if (ctx instanceof Response) return ctx;

  const body = await req.json();
  const { name, color, category, description } = body;

  if (!name?.trim()) {
    return Response.json({ error: "Name is required" }, { status: 422 });
  }

  try {
    const result = await db.execute(
      sql.raw(`
        INSERT INTO tag_definition (org_id, name, color, category, description, created_by)
        VALUES ('${ctx.orgId}', '${name.trim().replace(/'/g, "''")}', '${color ?? "#6B7280"}', ${category ? `'${category.replace(/'/g, "''")}'` : "NULL"}, ${description ? `'${description.replace(/'/g, "''")}'` : "NULL"}, '${ctx.userId}')
        ON CONFLICT (org_id, name) DO UPDATE SET
          color = EXCLUDED.color,
          category = COALESCE(EXCLUDED.category, tag_definition.category),
          description = COALESCE(EXCLUDED.description, tag_definition.description)
        RETURNING id, name, color, category, description, usage_count
      `)
    );

    return Response.json({ data: (result as any[])[0] }, { status: 201 });
  } catch (err) {
    return Response.json({ error: "Failed to create tag" }, { status: 500 });
  }
}
