import { db, templatePack, templatePackItem } from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/template-packs — List available template packs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");

  const conditions = category ? eq(templatePack.category, category) : undefined;

  const rows = await db
    .select()
    .from(templatePack)
    .where(conditions)
    .orderBy(templatePack.name);

  return Response.json({ data: rows });
}
