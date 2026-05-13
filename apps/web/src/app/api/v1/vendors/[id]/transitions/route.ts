import { db, vendor } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

// GET /api/v1/vendors/[id]/transitions
//
// Discovery for the vendor lifecycle. Same shape as the other
// /transitions endpoints (Wave 8 #WAVE6-STATE-01) — UI consumes
// this to render status-change buttons without hardcoding the matrix.
//
// Vendor status (vendor_status enum):
//   prospect → onboarding → active ⇄ under_review → suspended → terminated
//
// allowedNext below is intentionally permissive — vendor lifecycle
// in TPRM is rarely strictly linear (a vendor under_review may go
// back to active or be suspended; a terminated vendor stays
// terminated). The PUT /vendors/[id] route validates the value
// against the enum; there is no separate state-machine validator
// today, so allowedNext == knownStatuses minus self.

const VENDOR_STATUSES = [
  "prospect",
  "onboarding",
  "active",
  "under_review",
  "suspended",
  "terminated",
] as const;

const VENDOR_ALLOWED: Record<
  (typeof VENDOR_STATUSES)[number],
  (typeof VENDOR_STATUSES)[number][]
> = {
  prospect: ["onboarding", "terminated"],
  onboarding: ["active", "under_review", "terminated"],
  active: ["under_review", "suspended", "terminated"],
  under_review: ["active", "suspended", "terminated"],
  suspended: ["active", "under_review", "terminated"],
  terminated: [], // terminal — re-onboarding requires creating a new vendor record
};

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
    .where(
      and(
        eq(vendor.id, id),
        eq(vendor.orgId, ctx.orgId),
        isNull(vendor.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Vendor not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      current: row.status,
      knownStatuses: VENDOR_STATUSES,
      allowedNext: VENDOR_ALLOWED[row.status] ?? [],
      endpoint: `/api/v1/vendors/${id}`,
      method: "PUT",
      bodyShape: {
        status: `<one of: ${VENDOR_STATUSES.join(" | ")}>`,
      },
      note: "Vendor lifecycle is operational, not regulatory. The TPRM scoring engine recomputes the risk score after every status change.",
    },
  });
});
