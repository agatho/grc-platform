import { db, cveAssetMatch, cveFeedItem, asset } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, paginate } from "@/lib/api";
import { z } from "zod";
import { parseQueryParams } from "@/lib/query-schema";
// [E2E-TRIAGE-2026-09-02] `withErrorHandler` is what opens the
// `requestDbStorage.run(...)` frame that `withAuth` -> establishRequestScopedContext
// mutates with the org-pinned connection (apps/web/src/lib/api-wrapper.ts:113).
// Without it that helper falls back to `requestDbStorage.enterWith(...)`, which
// Next drops across the `await` in withAuth (api.ts:184-196), the handler's
// queries run on the context-less base pool, and RLS filters every row — the
// route answers 200 with an EMPTY list instead of the tenant's data.
import { withErrorHandler } from "@/lib/api-wrapper";

// #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
// against a schema instead of being read as `string | null` and cast
// with `as <enum>`. An unknown filter value used to reach Postgres and
// surface as a 500 (`invalid input value for enum …`); it is a 422 now,
// and free-text search terms are length-bounded.
const cveMatchQuerySchema = z.object({
  status: z.string().trim().min(1).max(40).optional(),
  severity: z.string().trim().min(1).max(40).optional(),
});

// GET /api/v1/isms/cve/matches — CVE-Asset matches for org
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const q = parseQueryParams(cveMatchQuerySchema, searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const status = q.data.status ?? null;
  const severity = q.data.severity ?? null;

  const conditions: ReturnType<typeof eq>[] = [
    eq(cveAssetMatch.orgId, ctx.orgId),
  ];

  if (status) {
    conditions.push(eq(cveAssetMatch.status, status));
  }

  const baseQuery = db
    .select({
      id: cveAssetMatch.id,
      cveId: cveAssetMatch.cveId,
      assetId: cveAssetMatch.assetId,
      orgId: cveAssetMatch.orgId,
      matchedCpe: cveAssetMatch.matchedCpe,
      status: cveAssetMatch.status,
      acknowledgedBy: cveAssetMatch.acknowledgedBy,
      acknowledgedAt: cveAssetMatch.acknowledgedAt,
      linkedVulnerabilityId: cveAssetMatch.linkedVulnerabilityId,
      matchedAt: cveAssetMatch.matchedAt,
      createdAt: cveAssetMatch.createdAt,
      updatedAt: cveAssetMatch.updatedAt,
      // Joined
      cveIdStr: cveFeedItem.cveId,
      cveTitle: cveFeedItem.title,
      cvssScore: cveFeedItem.cvssScore,
      cvssSeverity: cveFeedItem.cvssSeverity,
      cvePublishedAt: cveFeedItem.publishedAt,
      assetName: asset.name,
    })
    .from(cveAssetMatch)
    .leftJoin(cveFeedItem, eq(cveAssetMatch.cveId, cveFeedItem.id))
    .leftJoin(asset, eq(cveAssetMatch.assetId, asset.id));

  if (severity) {
    conditions.push(eq(cveFeedItem.cvssSeverity, severity));
  }

  const rows = await baseQuery
    .where(and(...conditions))
    .orderBy(desc(cveAssetMatch.matchedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(cveAssetMatch)
    .leftJoin(cveFeedItem, eq(cveAssetMatch.cveId, cveFeedItem.id))
    .where(and(...conditions));

  return Response.json({
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
