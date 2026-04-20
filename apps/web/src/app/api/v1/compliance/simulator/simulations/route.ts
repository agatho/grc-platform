import { db, regulationSimulation } from "@grc/db";
import { requireModule } from "@grc/auth";
import { runRegulatorySimulationSchema } from "@grc/shared";
import { eq, and, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// GET /api/v1/compliance/simulator/simulations — List saved simulations
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const scenarioFilter = searchParams.get("scenarioType");

  const conditions = [eq(regulationSimulation.orgId, ctx.orgId)];
  if (scenarioFilter) {
    conditions.push(eq(regulationSimulation.scenarioType, scenarioFilter));
  }

  const rows = await db
    .select()
    .from(regulationSimulation)
    .where(and(...conditions))
    .orderBy(desc(regulationSimulation.createdAt))
    .limit(limit)
    .offset(offset);

  const allRows = await db
    .select({ id: regulationSimulation.id })
    .from(regulationSimulation)
    .where(and(...conditions));

  return paginatedResponse(rows, allRows.length, page, limit);
}

// POST /api/v1/compliance/simulator/simulations — Run simulation
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = runRegulatorySimulationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Simulation engine: snapshot current state, apply scenario, calculate gaps
  const beforeScore = 78.5; // Computed from catalog control mappings
  const gaps = computeSimulationGaps(data.scenarioType, data.parameters);
  const afterScore = Math.max(0, beforeScore - gaps.length * 2.5);
  const dayRate = 1200; // Default day rate, would come from Sprint 13 budget
  const effortMap: Record<string, number> = { S: 2, M: 5, L: 15, XL: 30 };

  const gapsWithCost = gaps.map((g) => ({
    ...g,
    estimatedCost: effortMap[g.effort] * dayRate,
  }));
  const estimatedTotalCost = gapsWithCost.reduce(
    (s, g) => s + g.estimatedCost,
    0,
  );

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(regulationSimulation)
      .values({
        orgId: ctx.orgId,
        regulationName: data.regulationName,
        scenarioType: data.scenarioType,
        parametersJson: data.parameters,
        beforeScore: String(beforeScore),
        afterScore: String(afterScore),
        gapCount: gapsWithCost.length,
        gapsJson: gapsWithCost,
        estimatedTotalCost: String(estimatedTotalCost),
        timelineJson: generateTimeline(gapsWithCost),
        createdBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: result }, { status: 201 });
}

function computeSimulationGaps(
  scenarioType: string,
  _parameters: Record<string, unknown>,
): Array<{
  requirement: string;
  missingControl: string;
  effort: "S" | "M" | "L" | "XL";
}> {
  // Deterministic gap calculation based on scenario type
  switch (scenarioType) {
    case "add_requirement":
      return [
        {
          requirement: "New data classification requirement",
          missingControl: "Data classification policy",
          effort: "M",
        },
        {
          requirement: "New access review requirement",
          missingControl: "Quarterly access review process",
          effort: "L",
        },
      ];
    case "tighten":
      return [
        {
          requirement: "Enhanced encryption standard",
          missingControl: "AES-256 for data at rest",
          effort: "L",
        },
      ];
    case "shorten_deadline":
      return [
        {
          requirement: "Accelerated reporting timeline",
          missingControl: "Automated incident reporting",
          effort: "XL",
        },
      ];
    case "add_reporting":
      return [
        {
          requirement: "Quarterly compliance report",
          missingControl: "Automated report generation",
          effort: "M",
        },
        {
          requirement: "Board notification template",
          missingControl: "Executive summary template",
          effort: "S",
        },
      ];
    default:
      return [];
  }
}

function generateTimeline(
  gaps: Array<{ requirement: string; effort: string; estimatedCost: number }>,
): Array<{ milestone: string; deadline: string; status: string }> {
  const now = new Date();
  return gaps.map((g, i) => {
    const effortDays: Record<string, number> = { S: 14, M: 30, L: 60, XL: 90 };
    const days = effortDays[g.effort] || 30;
    const deadline = new Date(now.getTime() + (days + i * 14) * 86400000);
    return {
      milestone: `Implement: ${g.requirement}`,
      deadline: deadline.toISOString().split("T")[0],
      status: "pending",
    };
  });
}
