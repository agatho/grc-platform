import { db, apiScope } from "@grc/db";
import { withAuth } from "@/lib/api";

// GET /api/v1/api-keys/scopes — List available API scopes
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const rows = await db.select().from(apiScope);

  return Response.json({ data: rows });
}
