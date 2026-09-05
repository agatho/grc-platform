import { db, academyCertificate } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const querySchema = z.object({
  userId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
});

// GET /api/v1/academy/certificates
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));
  const conditions: ReturnType<typeof eq>[] = [
    eq(academyCertificate.orgId, ctx.orgId),
  ];
  if (query.userId)
    conditions.push(eq(academyCertificate.userId, query.userId));
  if (query.courseId)
    conditions.push(eq(academyCertificate.courseId, query.courseId));

  const rows = await db
    .select()
    .from(academyCertificate)
    .where(and(...conditions))
    .orderBy(desc(academyCertificate.issuedAt));

  return Response.json({ data: rows });
});
