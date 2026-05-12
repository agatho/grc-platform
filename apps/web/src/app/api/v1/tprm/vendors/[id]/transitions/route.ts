import { db, vendor } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";
import { buildTransitionsResponse } from "@/lib/generic-transitions";

const VENDOR_STATUSES = [
  "pending_assessment",
  "under_review",
  "active",
  "suspended",
  "terminated",
] as const;

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  requireUuidParam(id);

  const [row] = await db
    .select({ status: vendor.status })
    .from(vendor)
    .where(and(eq(vendor.id, id), eq(vendor.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "Vendor not found" }, { status: 404 });
  }

  return Response.json({
    data: buildTransitionsResponse({
      current: row.status,
      knownStatuses: VENDOR_STATUSES,
      module: "tprm/vendors",
      entityId: id,
    }),
  });
});
