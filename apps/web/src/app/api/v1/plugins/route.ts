import { db, plugin } from "@grc/db";
import { createPluginSchema } from "@grc/shared";
import { eq, desc, sql, ilike } from "drizzle-orm";
import {
  withAuth,
  paginate,
  paginatedResponse,
  requirePlatformAdmin,
} from "@/lib/api";

// POST /api/v1/plugins — Register a new plugin
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  // #WP3-S02-03 (Critical) — diese Tabelle hat KEIN `org_id`, keine RLS und
  // keine Policy; eine Änderung wirkt auf ALLE Mandanten. Der bisherige Guard
  // `withAuth("admin")` (bei framework-mappings sogar `risk_manager`) ist eine
  // PRO-ORGANISATION vergebene Rolle — jeder Mandanten-Admin konnte damit
  // Feature-, Abrechnungs- und Data-Sovereignty-Konfiguration aller Mandanten
  // verändern. Schreibzugriff verlangt jetzt einen Plattform-Admin
  // (Tabelle `platform_admin`, Migration 0411; nicht über die API vergebbar).
  const platformCheck = await requirePlatformAdmin(ctx);
  if (platformCheck) return platformCheck;

  const body = createPluginSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [created] = await db.insert(plugin).values(body.data).returning();

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/plugins — List available plugins
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const { page, limit, offset } = paginate(req);

  const conditions = [];
  if (category) conditions.push(eq(plugin.category, category));
  if (search) conditions.push(ilike(plugin.name, `%${search}%`));

  const whereClause =
    conditions.length > 0
      ? sql`${sql.join(conditions, sql` AND `)}`
      : undefined;

  const rows = await db
    .select()
    .from(plugin)
    .where(whereClause)
    .orderBy(desc(plugin.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(plugin)
    .where(whereClause);

  return Response.json(paginatedResponse(rows, Number(count), page, limit));
}
