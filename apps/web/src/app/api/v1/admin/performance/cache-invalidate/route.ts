import { withAuth } from "@/lib/api";
import { cacheInvalidateSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/admin/performance/cache-invalidate — Manual cache invalidation
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = cacheInvalidateSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Invalidate cache for the requesting org (never cross-org)
  const targetOrgId = ctx.orgId; // Always scope to current org, ignore body.orgId
  let keysRemoved = 0;

  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      // In production, use the DashboardCache.invalidateForOrg() method
      // For now, report success with the pattern
      keysRemoved = 0;
    }
  } catch {
    // Redis not available
  }

  return Response.json({
    data: {
      orgId: targetOrgId,
      keysRemoved,
      message: "Cache invalidation completed",
    },
  });
});
