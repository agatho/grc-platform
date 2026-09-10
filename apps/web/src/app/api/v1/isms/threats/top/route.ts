import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { getTopThreats } from "@grc/reporting";
import { z } from "zod";
import { parseQueryParams, intQueryParam } from "@/lib/query-schema";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
// against a schema instead of being read as `string | null` and cast
// with `as <enum>`. An unknown filter value used to reach Postgres and
// surface as a 500 (`invalid input value for enum …`); it is a 422 now,
// and free-text search terms are length-bounded.
const topThreatsQuerySchema = z.object({
  // Was `parseInt(... || "10", 10)` — "abc" yielded NaN, which reached the
  // query builder as the LIMIT.
  limit: intQueryParam(1, 50, 10),
});

// GET /api/v1/isms/threats/top — Top-10 threats by impact
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const q = parseQueryParams(topThreatsQuerySchema, url.searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const limit = q.data.limit;

  const threats = await getTopThreats(ctx.orgId, limit);
  return Response.json({ data: { threats } });
});
