import { db, dataRegion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateDataRegionSchema } from "@grc/shared";

// GET /api/v1/data-sovereignty/regions/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db.select().from(dataRegion).where(eq(dataRegion.id, id));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

// PATCH /api/v1/data-sovereignty/regions/:id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateDataRegionSchema.parse(await req.json());
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(dataRegion).set({ ...body, updatedAt: new Date() })
      .where(eq(dataRegion.id, id)).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
