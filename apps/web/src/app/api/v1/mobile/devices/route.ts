import { db, deviceRegistration } from "@grc/db";
import { registerDeviceSchema } from "@grc/shared";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/mobile/devices — Register device
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const body = registerDeviceSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Upsert by device token
  const [created] = await db
    .insert(deviceRegistration)
    .values({
      orgId: ctx.orgId,
      userId: ctx.userId,
      ...body.data,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [deviceRegistration.deviceToken],
      set: {
        userId: ctx.userId,
        platform: body.data.platform,
        deviceModel: body.data.deviceModel,
        osVersion: body.data.osVersion,
        appVersion: body.data.appVersion,
        biometricEnabled: body.data.biometricEnabled,
        isActive: true,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return Response.json({ data: created }, { status: 201 });
});
// GET /api/v1/mobile/devices — List user's devices
export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const rows = await db
    .select()
    .from(deviceRegistration)
    .where(
      and(
        eq(deviceRegistration.orgId, ctx.orgId),
        eq(deviceRegistration.userId, ctx.userId),
      ),
    )
    .orderBy(desc(deviceRegistration.lastSeenAt));

  return Response.json({ data: rows });
});
