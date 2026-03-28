import { db, threatFeedSource } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createThreatFeedSourceSchema } from "@grc/shared";

// GET /api/v1/isms/threats/feeds — List feed sources
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const rows = await db
    .select()
    .from(threatFeedSource)
    .where(eq(threatFeedSource.orgId, ctx.orgId))
    .orderBy(desc(threatFeedSource.createdAt));

  return Response.json({ data: rows });
}

// POST /api/v1/isms/threats/feeds — Add feed source
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createThreatFeedSourceSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(threatFeedSource)
      .values({
        orgId: ctx.orgId,
        name: body.name,
        feedUrl: body.feedUrl,
        feedType: body.feedType,
        isActive: body.isActive,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
