// POST /api/v1/isms/assessments/{id}/transition
//
// Sprint 1.1 State-Transition-Endpoint mit Gate-Validierung.
//
// Body: { targetStatus: "in_progress" | "review" | "completed" | "cancelled" }
//
// Rueckgabe bei Erfolg: { data: updatedRun, blockers: warnings[] }
// Rueckgabe bei Block:  { blocked: true, blockers: errors[] }
//
// Gate-Logik in packages/shared/src/state-machines/isms-assessment.ts.

import { db, assessmentRun } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateTransition,
  type AssessmentSnapshot,
  type AssessmentStatus,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const transitionSchema = z.object({
  targetStatus: z.enum([
    "planning",
    "in_progress",
    "review",
    "completed",
    "cancelled",
  ]),
  reason: z.string().max(2000).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { targetStatus, reason } = parsed.data;

  // Aktuellen Run laden (mit Tenant-Filter -- RLS backup)
  const [existing] = await db
    .select()
    .from(assessmentRun)
    .where(and(eq(assessmentRun.id, id), eq(assessmentRun.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Assessment not found" }, { status: 404 });
  }

  const snapshot: AssessmentSnapshot = {
    status: existing.status,
    completionPercentage: existing.completionPercentage,
    name: existing.name,
    description: existing.description,
    scopeType: existing.scopeType,
    scopeFilter: existing.scopeFilter as Record<string, unknown> | null,
    framework: existing.framework,
    periodStart: existing.periodStart,
    periodEnd: existing.periodEnd,
    leadAssessorId: existing.leadAssessorId,
    totalEvaluations: existing.totalEvaluations,
    completedEvaluations: existing.completedEvaluations,
  };

  const validation = validateTransition({
    currentStatus: existing.status as AssessmentStatus,
    targetStatus,
    snapshot,
  });

  if (!validation.allowed) {
    return Response.json(
      {
        blocked: true,
        currentStatus: existing.status,
        targetStatus,
        blockers: validation.blockers,
      },
      { status: 422 },
    );
  }

  // Transition erlaubt -- durchfuehren
  const result = await withAuditContext(ctx, async (tx) => {
    const updates: Record<string, unknown> = {
      status: targetStatus,
      updatedAt: new Date(),
    };
    if (targetStatus === "completed") {
      updates.completedAt = new Date();
      updates.completionPercentage = 100;
    }

    const [updated] = await tx
      .update(assessmentRun)
      .set(updates)
      .where(and(eq(assessmentRun.id, id), eq(assessmentRun.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  // Reason falls vorhanden -- wird in audit_log ueber audit_trigger bereits erfasst,
  // weil die changes-Spalte den Field-Delta enthaelt. reason koennen wir als
  // Metadata ergaenzen, wenn die audit-Funktion das unterstuetzt (optional).
  return Response.json({
    data: result,
    previousStatus: existing.status,
    blockers: validation.blockers, // Warnings
    reason: reason ?? null,
  });
}
