// POST /api/v1/dpms/ropa/[id]/transition
//
// Sprint 3.1: RoPA-Status-Transitions mit Gate G1 (DPO-Review +
// Pflichtfelder + DPIA-Linkage).

import {
  db,
  ropaEntry,
  ropaDataCategory,
  ropaDataSubject,
  ropaRecipient,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateRopaTransition,
  type RopaSnapshot,
  type RopaStatus,
} from "@grc/shared";
import { and, eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  targetStatus: z.enum(["draft", "active", "under_review", "archived"]),
  reason: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const [ropa] = await db
    .select()
    .from(ropaEntry)
    .where(and(eq(ropaEntry.id, id), eq(ropaEntry.orgId, ctx.orgId)));
  if (!ropa) {
    return Response.json({ error: "RoPA entry not found" }, { status: 404 });
  }

  // Counts
  const [{ catCount }] = await db
    .select({ catCount: sql<number>`count(*)::int` })
    .from(ropaDataCategory)
    .where(eq(ropaDataCategory.ropaEntryId, id));

  const [{ subjCount }] = await db
    .select({ subjCount: sql<number>`count(*)::int` })
    .from(ropaDataSubject)
    .where(eq(ropaDataSubject.ropaEntryId, id));

  const [{ recCount }] = await db
    .select({ recCount: sql<number>`count(*)::int` })
    .from(ropaRecipient)
    .where(eq(ropaRecipient.ropaEntryId, id));

  // TIA-Link-Check: transferSafeguard als Indiz (Schema hat keinen direkten
  // ropa_entry_id-FK in tia-Tabelle; Erweiterung fuer spaeter).
  // Vorlaeufiger Check: transferSafeguard ist gesetzt = SCC/BCR/etc. dokumentiert.
  const hasTiaLinked =
    ropa.internationalTransfer === true &&
    ropa.transferSafeguard !== null &&
    ropa.transferSafeguard.trim().length > 0;

  const snapshot: RopaSnapshot = {
    status: ropa.status,
    purposeTitle: ropa.title,
    purposeDescription: ropa.purpose,
    legalBasis: ropa.legalBasis,
    dataCategoryCount: catCount ?? 0,
    dataSubjectCount: subjCount ?? 0,
    recipientCount: recCount ?? 0,
    hasDpiaRequired: false, // Aus DPIA-Flags ableiten (in Sprint 3.2)
    dpiaId: null,
    hasCrossBorderTransfer: ropa.internationalTransfer ?? false,
    hasTiaLinked,
    reviewedBy: ropa.responsibleId,
    reviewedAt: ropa.lastReviewed,
  };

  const validation = validateRopaTransition({
    currentStatus: ropa.status as RopaStatus,
    targetStatus: parsed.data.targetStatus,
    snapshot,
  });

  if (!validation.allowed) {
    return Response.json(
      {
        blocked: true,
        currentStatus: ropa.status,
        targetStatus: parsed.data.targetStatus,
        blockers: validation.blockers,
      },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updates: Record<string, unknown> = {
      status: parsed.data.targetStatus,
      updatedAt: new Date(),
    };
    if (parsed.data.targetStatus === "active") {
      updates.lastReviewed = new Date();
    }
    const [updated] = await tx
      .update(ropaEntry)
      .set(updates)
      .where(and(eq(ropaEntry.id, id), eq(ropaEntry.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  return Response.json({
    data: result,
    previousStatus: ropa.status,
    blockers: validation.blockers,
  });
}
