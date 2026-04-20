import { db, regulatoryDigest } from "@grc/db";
import { digestQuerySchema, generateDigestSchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/regulatory-changes/digests — Generate digest
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const body = generateDigestSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(regulatoryDigest)
      .values({
        orgId: ctx.orgId,
        periodStart: body.data.periodStart,
        periodEnd: body.data.periodEnd,
        digestType: body.data.digestType,
        summary: "Regulatory digest generation queued.",
        changeCount: 0,
        criticalCount: 0,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/regulatory-changes/digests — List digests
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "dpo", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = digestQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit, digestType } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(regulatoryDigest.orgId, ctx.orgId)];
  if (digestType) conditions.push(eq(regulatoryDigest.digestType, digestType));

  const digests = await db
    .select()
    .from(regulatoryDigest)
    .where(and(...conditions))
    .orderBy(desc(regulatoryDigest.periodStart))
    .limit(limit)
    .offset(offset);

  return Response.json({ data: digests });
}
