import { db, featureGate } from "@grc/db";
import { updateFeatureGateSchema } from "@grc/shared";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/feature-gates/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(featureGate)
    .where(eq(featureGate.id, id));

  if (!row) {
    return Response.json({ error: "Feature gate not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PATCH /api/v1/feature-gates/:id
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const body = updateFeatureGateSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [updated] = await db
    .update(featureGate)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(featureGate.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: "Feature gate not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/feature-gates/:id
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [updated] = await db
    .update(featureGate)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(featureGate.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: "Feature gate not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}
