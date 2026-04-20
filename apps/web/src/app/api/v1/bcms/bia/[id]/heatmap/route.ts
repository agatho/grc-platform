// GET /api/v1/bcms/bia/[id]/heatmap
//
// Sprint 2.1: Liefert aggregierte Daten fuer Heatmap-Visualisierung.
// Achsen: Priority-Ranking (1-5, X) x MTPD-Bucket (Y).
//
// MTPD-Buckets: < 4h | 4-24h | 1-3d | 3-7d | > 7d

import {
  db,
  biaAssessment,
  biaProcessImpact,
  process as processTable,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

function mtpdBucket(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "unknown";
  if (hours < 4) return "<4h";
  if (hours < 24) return "4-24h";
  if (hours < 72) return "1-3d";
  if (hours < 168) return "3-7d";
  return ">7d";
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [bia] = await db
    .select()
    .from(biaAssessment)
    .where(and(eq(biaAssessment.id, id), eq(biaAssessment.orgId, ctx.orgId)));
  if (!bia) {
    return Response.json({ error: "BIA not found" }, { status: 404 });
  }

  const impacts = await db
    .select({
      id: biaProcessImpact.id,
      processId: biaProcessImpact.processId,
      processName: processTable.name,
      mtpdHours: biaProcessImpact.mtpdHours,
      rtoHours: biaProcessImpact.rtoHours,
      rpoHours: biaProcessImpact.rpoHours,
      priorityRanking: biaProcessImpact.priorityRanking,
      isEssential: biaProcessImpact.isEssential,
      impactReputation: biaProcessImpact.impactReputation,
      impactLegal: biaProcessImpact.impactLegal,
      impactFinancial: biaProcessImpact.impactFinancial,
      impactOperational: biaProcessImpact.impactOperational,
      impactSafety: biaProcessImpact.impactSafety,
    })
    .from(biaProcessImpact)
    .leftJoin(processTable, eq(processTable.id, biaProcessImpact.processId))
    .where(eq(biaProcessImpact.biaAssessmentId, id));

  // 2D-Matrix: Priority x MTPD-Bucket
  const matrix: Record<number, Record<string, number>> = {};
  const processListByCell: Record<
    string,
    Array<{ id: string; name: string | null }>
  > = {};

  const buckets = ["<4h", "4-24h", "1-3d", "3-7d", ">7d", "unknown"];
  const priorities = [1, 2, 3, 4, 5, 0]; // 0 = unranked

  for (const p of priorities) {
    matrix[p] = {};
    for (const b of buckets) {
      matrix[p][b] = 0;
    }
  }

  for (const imp of impacts) {
    const p = imp.priorityRanking ?? 0;
    const b = mtpdBucket(imp.mtpdHours);
    if (!matrix[p]) matrix[p] = {};
    matrix[p][b] = (matrix[p][b] ?? 0) + 1;

    const cellKey = `${p}-${b}`;
    if (!processListByCell[cellKey]) processListByCell[cellKey] = [];
    processListByCell[cellKey].push({
      id: imp.processId,
      name: imp.processName,
    });
  }

  // Qualitative-Impact-Averages pro Prioritaet
  const qualitativeByPriority: Record<
    number,
    {
      count: number;
      avgReputation: number;
      avgLegal: number;
      avgFinancial: number;
      avgOperational: number;
      avgSafety: number;
    }
  > = {};

  for (const p of priorities) {
    const subset = impacts.filter((i) => (i.priorityRanking ?? 0) === p);
    if (subset.length === 0) {
      qualitativeByPriority[p] = {
        count: 0,
        avgReputation: 0,
        avgLegal: 0,
        avgFinancial: 0,
        avgOperational: 0,
        avgSafety: 0,
      };
      continue;
    }
    const avg = (key: keyof (typeof subset)[0]) => {
      const nums = subset
        .map((s) => s[key])
        .filter((n): n is number => typeof n === "number");
      return nums.length > 0
        ? nums.reduce((a, b) => a + b, 0) / nums.length
        : 0;
    };
    qualitativeByPriority[p] = {
      count: subset.length,
      avgReputation: avg("impactReputation"),
      avgLegal: avg("impactLegal"),
      avgFinancial: avg("impactFinancial"),
      avgOperational: avg("impactOperational"),
      avgSafety: avg("impactSafety"),
    };
  }

  return Response.json({
    data: {
      biaAssessmentId: bia.id,
      totalImpacts: impacts.length,
      essentialCount: impacts.filter((i) => i.isEssential).length,
      matrix,
      processListByCell,
      qualitativeByPriority,
      buckets,
      priorities,
    },
  });
}
