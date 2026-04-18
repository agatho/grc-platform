// GET /api/v1/bcms/plans/[id]/gate-check
//
// Sprint 2.2: Liefert aktuellen Gate-Status fuer BCP (B3, B5, B6).

import {
  db,
  bcp,
  bcpProcedure,
  bcpResource,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateBcpGate3Review,
  validateBcpGate5Approval,
  validateBcpGate6Publish,
  type BcpSnapshot,
} from "@grc/shared";
import { and, eq, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [plan] = await db
    .select()
    .from(bcp)
    .where(and(eq(bcp.id, id), eq(bcp.orgId, ctx.orgId)));
  if (!plan) {
    return Response.json({ error: "BCP not found" }, { status: 404 });
  }

  const [{ procCount }] = await db
    .select({ procCount: sql<number>`count(*)::int` })
    .from(bcpProcedure)
    .where(eq(bcpProcedure.bcpId, id));

  const [{ resCount }] = await db
    .select({ resCount: sql<number>`count(*)::int` })
    .from(bcpResource)
    .where(eq(bcpResource.bcpId, id));

  const snapshot: BcpSnapshot = {
    status: plan.status,
    title: plan.title,
    scope: plan.scope,
    activationCriteria: plan.activationCriteria,
    bcManagerId: plan.bcManagerId,
    processIds: plan.processIds as string[] | null,
    procedureCount: procCount ?? 0,
    resourceCount: resCount ?? 0,
    approvedBy: plan.approvedBy,
    approvedAt: plan.approvedAt,
    publishedAt: plan.publishedAt,
  };

  const b3Blockers = validateBcpGate3Review(snapshot);
  const b5Blockers = validateBcpGate5Approval(snapshot, ctx.userId);
  const b6Blockers = validateBcpGate6Publish(snapshot, {
    reportDocumentId: plan.reportDocumentId,
    physicalStorageLocation: null, // nicht im BCP-Schema, muss bei Transition uebergeben werden
  });

  return Response.json({
    data: {
      bcpId: plan.id,
      status: plan.status,
      snapshot,
      b3: {
        passed: b3Blockers.filter((b) => b.severity === "error").length === 0,
        blockers: b3Blockers,
      },
      b5: {
        passed: b5Blockers.filter((b) => b.severity === "error").length === 0,
        blockers: b5Blockers,
      },
      b6: {
        passed: b6Blockers.filter((b) => b.severity === "error").length === 0,
        blockers: b6Blockers,
      },
    },
  });
}
