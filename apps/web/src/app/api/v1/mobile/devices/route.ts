import { db, deviceRegistration } from "@grc/db";
import { registerDeviceSchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// POST /api/v1/mobile/devices — Register device
export async function POST(req: Request) {
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
}

// GET /api/v1/mobile/devices — List user's devices
export async function GET(req: Request) {
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
}
