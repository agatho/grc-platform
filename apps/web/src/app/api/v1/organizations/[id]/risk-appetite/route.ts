import { db, riskAppetite, organization } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { z } from "zod";
import { withAuth, withAuditContext } from "@/lib/api";

const updateRiskAppetiteSchema = z.object({
  appetiteThreshold: z.number().int().min(1).max(25),
  toleranceUpper: z.number().optional(),
  toleranceLower: z.number().optional(),
  description: z.string().optional(),
  effectiveDate: z.string().optional(),
});

// GET /api/v1/organizations/:id/risk-appetite — Get risk appetite for org
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Verify org matches current context
  if (id !== ctx.orgId) {
    return Response.json(
      { error: "Forbidden: organization mismatch" },
      { status: 403 },
    );
  }

  const [row] = await db
    .select()
    .from(riskAppetite)
    .where(
      and(
        eq(riskAppetite.orgId, id),
        isNull(riskAppetite.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({
      data: null,
      message: "No risk appetite configured for this organization",
    });
  }

  return Response.json({ data: row });
}

// PUT /api/v1/organizations/:id/risk-appetite — Set risk appetite
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Verify org matches current context
  if (id !== ctx.orgId) {
    return Response.json(
      { error: "Forbidden: organization mismatch" },
      { status: 403 },
    );
  }

  // Verify org exists
  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(
      and(
        eq(organization.id, id),
        isNull(organization.deletedAt),
      ),
    );

  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const body = updateRiskAppetiteSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Check if appetite already exists
    const [existing] = await tx
      .select({ id: riskAppetite.id })
      .from(riskAppetite)
      .where(
        and(
          eq(riskAppetite.orgId, id),
          isNull(riskAppetite.deletedAt),
        ),
      );

    if (existing) {
      // Update existing
      const [row] = await tx
        .update(riskAppetite)
        .set({
          appetiteThreshold: body.data.appetiteThreshold,
          toleranceUpper: body.data.toleranceUpper?.toString(),
          toleranceLower: body.data.toleranceLower?.toString(),
          description: body.data.description,
          effectiveDate: body.data.effectiveDate ?? new Date().toISOString().split("T")[0],
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(riskAppetite.id, existing.id))
        .returning();

      return row;
    }

    // Create new
    const [row] = await tx
      .insert(riskAppetite)
      .values({
        orgId: id,
        appetiteThreshold: body.data.appetiteThreshold,
        toleranceUpper: body.data.toleranceUpper?.toString(),
        toleranceLower: body.data.toleranceLower?.toString(),
        description: body.data.description,
        effectiveDate: body.data.effectiveDate ?? new Date().toISOString().split("T")[0],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: result });
}
