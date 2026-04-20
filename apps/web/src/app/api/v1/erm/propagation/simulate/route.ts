import { db, orgEntityRelationship, riskPropagationResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { propagationSimulateSchema } from "@grc/shared";
import { eq, and, or } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { randomUUID } from "crypto";

const DECAY_FACTOR = 0.7;
const MAX_DEPTH = 5;
const MIN_THRESHOLD = 0.05; // 5% minimum propagation probability

// POST /api/v1/erm/propagation/simulate — Simulate risk propagation
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = propagationSimulateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { riskId, simulatedLikelihood } = parsed.data;

  // Fetch all relationships involving the current org
  const relationships = await db
    .select()
    .from(orgEntityRelationship)
    .where(
      or(
        eq(orgEntityRelationship.sourceOrgId, ctx.orgId),
        eq(orgEntityRelationship.targetOrgId, ctx.orgId),
      ),
    );

  // BFS propagation with decay
  const results = computePropagation(
    ctx.orgId,
    riskId,
    simulatedLikelihood,
    relationships,
  );
  const batchId = randomUUID();

  // Persist results (read-only projection)
  const saved = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(riskPropagationResult)
      .values({
        orgId: ctx.orgId,
        sourceRiskId: riskId,
        batchId,
        resultsJson: results,
        totalAffectedEntities: results.length,
        maxDepth: Math.max(0, ...results.map((r) => r.level)),
      })
      .returning();

    return row;
  });

  return Response.json({ data: saved }, { status: 201 });
}

interface PropagationEntry {
  riskId: string;
  orgId: string;
  level: number;
  propagatedScore: number;
  delta: number;
  via: string;
}

function computePropagation(
  sourceOrgId: string,
  riskId: string,
  likelihood: number,
  relationships: Array<{
    id: string;
    sourceOrgId: string;
    targetOrgId: string;
    relationshipType: string;
    strength: number;
  }>,
): PropagationEntry[] {
  const results: PropagationEntry[] = [];
  const visited = new Set<string>([sourceOrgId]);
  const queue: Array<{ orgId: string; probability: number; depth: number }> = [
    { orgId: sourceOrgId, probability: 1.0, depth: 0 },
  ];

  const riskScore = likelihood * 5; // simplified score

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= MAX_DEPTH) continue;

    // Find connections from current org
    const connections = relationships.filter(
      (r) => r.sourceOrgId === current.orgId || r.targetOrgId === current.orgId,
    );

    for (const conn of connections) {
      const targetOrg =
        conn.sourceOrgId === current.orgId
          ? conn.targetOrgId
          : conn.sourceOrgId;

      if (visited.has(targetOrg)) continue;
      visited.add(targetOrg);

      const propagationProb =
        current.probability * (conn.strength / 100) * DECAY_FACTOR;

      if (propagationProb < MIN_THRESHOLD) continue;

      const propagatedScore = riskScore * propagationProb;
      results.push({
        riskId,
        orgId: targetOrg,
        level: current.depth + 1,
        propagatedScore,
        delta: propagatedScore,
        via: conn.relationshipType,
      });

      queue.push({
        orgId: targetOrg,
        probability: propagationProb,
        depth: current.depth + 1,
      });
    }
  }

  return results.sort((a, b) => b.propagatedScore - a.propagatedScore);
}
