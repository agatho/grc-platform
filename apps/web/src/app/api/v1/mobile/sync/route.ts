import { db, offlineSyncState } from "@grc/db";
import { syncRequestSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/mobile/sync — Submit offline changes and get updates
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const body = syncRequestSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Get or create sync state
  const [existing] = await db
    .select()
    .from(offlineSyncState)
    .where(
      and(
        eq(offlineSyncState.deviceId, body.data.deviceId),
        eq(offlineSyncState.entityType, body.data.entityType),
      ),
    );

  const newVersion = (existing?.syncVersion ?? 0) + 1;

  const [syncState] = await db
    .insert(offlineSyncState)
    .values({
      orgId: ctx.orgId,
      userId: ctx.userId,
      deviceId: body.data.deviceId,
      entityType: body.data.entityType,
      lastSyncedAt: new Date(),
      syncVersion: newVersion,
      pendingChanges: body.data.pendingChanges,
      status: body.data.pendingChanges.length > 0 ? "pending" : "synced",
    })
    .onConflictDoUpdate({
      target: [offlineSyncState.deviceId, offlineSyncState.entityType],
      set: {
        lastSyncedAt: new Date(),
        syncVersion: newVersion,
        pendingChanges: body.data.pendingChanges,
        status: body.data.pendingChanges.length > 0 ? "pending" : "synced",
        updatedAt: new Date(),
      },
    })
    .returning();

  return Response.json({
    data: {
      syncState,
      serverVersion: newVersion,
      conflicts: [],
    },
  });
});
// GET /api/v1/mobile/sync — Get sync status for all entity types
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");
  if (!deviceId) {
    return Response.json({ error: "deviceId required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(offlineSyncState)
    .where(
      and(
        eq(offlineSyncState.orgId, ctx.orgId),
        eq(offlineSyncState.userId, ctx.userId),
        eq(offlineSyncState.deviceId, deviceId),
      ),
    );

  return Response.json({ data: rows });
});
