// TPRM Overhaul: flag a vendor as DORA-critical-ICT or LkSG-tier-1.

import { db, vendor } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const schema = z.object({
  doraCriticalIct: z.boolean().optional(),
  lksgTier1: z.boolean().optional(),
  rationale: z.string().min(20).max(2000),
});

export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "vendor_manager",
    "compliance_officer",
    "ciso",
  );
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("tprm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [v] = await db
    .select({ id: vendor.id })
    .from(vendor)
    .where(
      and(
        eq(vendor.id, id),
        eq(vendor.orgId, ctx.orgId),
        isNull(vendor.deletedAt),
      ),
    );
  if (!v) return Response.json({ error: "Vendor not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  if (
    parsed.data.doraCriticalIct === undefined &&
    parsed.data.lksgTier1 === undefined
  ) {
    return Response.json(
      { error: "At least one designation flag must be provided" },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(
    ctx,
    async (tx) => {
      const update: Record<string, unknown> = {
        designationRationale: parsed.data.rationale,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      };
      if (parsed.data.doraCriticalIct !== undefined)
        update.doraCriticalIct = parsed.data.doraCriticalIct;
      if (parsed.data.lksgTier1 !== undefined)
        update.lksgTier1 = parsed.data.lksgTier1;
      const [row] = await tx
        .update(vendor)
        .set(update)
        .where(eq(vendor.id, id))
        .returning();
      return row;
    },
    {
      actionDetail: `Designation update: DORA=${parsed.data.doraCriticalIct} LkSG-T1=${parsed.data.lksgTier1}`,
    },
  );

  return Response.json({ data: updated });
});
