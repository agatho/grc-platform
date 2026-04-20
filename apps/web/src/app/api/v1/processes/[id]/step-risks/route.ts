import { db, process, processStep, processStepRisk, risk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/:id/step-risks — Get all step-level risks for overlay data
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Get all step risks with step and risk details
  const stepRisks = await db
    .select({
      stepId: processStep.id,
      bpmnElementId: processStep.bpmnElementId,
      stepName: processStep.name,
      riskId: risk.id,
      riskTitle: risk.title,
      riskCategory: risk.riskCategory,
      riskStatus: risk.status,
      riskScoreResidual: risk.riskScoreResidual,
    })
    .from(processStepRisk)
    .innerJoin(processStep, eq(processStepRisk.processStepId, processStep.id))
    .innerJoin(risk, eq(processStepRisk.riskId, risk.id))
    .where(
      and(
        eq(processStep.processId, id),
        isNull(processStep.deletedAt),
        isNull(risk.deletedAt),
      ),
    );

  // Group by step
  const grouped = new Map<
    string,
    {
      bpmnElementId: string;
      stepName: string | null;
      riskCount: number;
      highestScore: number | null;
      risks: Array<{
        riskId: string;
        title: string;
        category: string;
        status: string;
        scoreResidual: number | null;
      }>;
    }
  >();

  for (const row of stepRisks) {
    const key = row.bpmnElementId;
    if (!grouped.has(key)) {
      grouped.set(key, {
        bpmnElementId: row.bpmnElementId,
        stepName: row.stepName,
        riskCount: 0,
        highestScore: null,
        risks: [],
      });
    }

    const group = grouped.get(key)!;
    group.riskCount++;
    group.risks.push({
      riskId: row.riskId,
      title: row.riskTitle,
      category: row.riskCategory,
      status: row.riskStatus,
      scoreResidual: row.riskScoreResidual,
    });

    if (
      row.riskScoreResidual !== null &&
      (group.highestScore === null ||
        row.riskScoreResidual > group.highestScore)
    ) {
      group.highestScore = row.riskScoreResidual;
    }
  }

  return Response.json({ data: Array.from(grouped.values()) });
}
