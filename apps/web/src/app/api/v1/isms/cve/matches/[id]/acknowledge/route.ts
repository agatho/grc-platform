import { db, cveAssetMatch } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { acknowledgeCveMatchSchema, isValidCveMatchTransition } from "@grc/shared";

// PUT /api/v1/isms/cve/matches/:id/acknowledge — Acknowledge/update match status
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();
  const parsed = acknowledgeCveMatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(cveAssetMatch)
    .where(and(eq(cveAssetMatch.id, id), eq(cveAssetMatch.orgId, ctx.orgId)))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  if (!isValidCveMatchTransition(existing.status, parsed.data.status)) {
    return Response.json(
      { error: `Invalid status transition from '${existing.status}' to '${parsed.data.status}'` },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(cveAssetMatch)
      .set({
        status: parsed.data.status,
        acknowledgedBy: ctx.userId,
        acknowledgedAt: new Date(),
      })
      .where(and(eq(cveAssetMatch.id, id), eq(cveAssetMatch.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  return Response.json({ data: result });
}
