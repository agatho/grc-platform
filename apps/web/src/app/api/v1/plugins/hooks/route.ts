import { db, pluginHook } from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/plugins/hooks — List all available hook points
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const module = url.searchParams.get("module");

  const conditions = module ? eq(pluginHook.module, module) : undefined;

  const rows = await db
    .select()
    .from(pluginHook)
    .where(conditions)
    .orderBy(pluginHook.key);

  return Response.json({ data: rows });
}
