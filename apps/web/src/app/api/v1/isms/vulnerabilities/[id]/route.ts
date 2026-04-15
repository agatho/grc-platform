import { db, vulnerability } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const updateVulnerabilitySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  cveReference: z.string().max(50).optional(),
  affectedAssetId: z.string().uuid().optional(),
  severity: z.string().max(20).optional(),
  status: z.string().max(20).optional(),
  mitigationControlId: z.string().uuid().optional(),
});

// GET /api/v1/isms/vulnerabilities/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const rows = await db
    .select()
    .from(vulnerability)
    .where(
      and(
        eq(vulnerability.id, id),
        eq(vulnerability.orgId, ctx.orgId),
        isNull(vulnerability.deletedAt),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Vulnerability not found" }, { status: 404 });
  }

  return Response.json({ data: rows[0] });
}

// PUT /api/v1/isms/vulnerabilities/[id]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const parsed = updateVulnerabilitySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(vulnerability)
      .set(parsed.data)
      .where(
        and(
          eq(vulnerability.id, id),
          eq(vulnerability.orgId, ctx.orgId),
          isNull(vulnerability.deletedAt),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json({ error: "Vulnerability not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}

// DELETE /api/v1/isms/vulnerabilities/[id] (soft delete)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(vulnerability)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(vulnerability.id, id),
          eq(vulnerability.orgId, ctx.orgId),
          isNull(vulnerability.deletedAt),
        ),
      );
  });

  return Response.json({ success: true });
}
