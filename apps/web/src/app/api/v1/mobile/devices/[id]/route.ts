import { db, deviceRegistration } from "@grc/db";
import { updateDeviceSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// PATCH /api/v1/mobile/devices/:id
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const body = updateDeviceSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [updated] = await db
    .update(deviceRegistration)
    .set({ ...body.data, updatedAt: new Date() })
    .where(
      and(
        eq(deviceRegistration.id, id),
        eq(deviceRegistration.userId, ctx.userId),
        eq(deviceRegistration.orgId, ctx.orgId),
      ),
    )
    .returning();

  if (!updated) {
    return Response.json({ error: "Device not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
});
// DELETE /api/v1/mobile/devices/:id — Deactivate device
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [updated] = await db
    .update(deviceRegistration)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(deviceRegistration.id, id),
        eq(deviceRegistration.userId, ctx.userId),
        eq(deviceRegistration.orgId, ctx.orgId),
      ),
    )
    .returning();

  if (!updated) {
    return Response.json({ error: "Device not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
});
