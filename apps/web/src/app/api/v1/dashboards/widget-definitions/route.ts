import { db, widgetDefinition } from "@grc/db";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/dashboards/widget-definitions — List available widget types
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const definitions = await db
    .select()
    .from(widgetDefinition)
    .where(eq(widgetDefinition.isActive, true))
    .orderBy(widgetDefinition.type, widgetDefinition.key);

  return Response.json({ data: definitions, total: definitions.length });
}
