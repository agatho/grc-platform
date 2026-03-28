import { db, incidentCorrelation, securityIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import { runCorrelationSchema } from "@grc/shared";
import { eq, and, gte, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

const TEMPORAL_WINDOW_HOURS = 48;
const MIN_INCIDENTS_FOR_CORRELATION = 10;

// POST /api/v1/isms/incidents/correlate — Run correlation analysis
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = runCorrelationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { windowDays, minConfidence } = parsed.data;
  const windowStart = new Date(Date.now() - windowDays * 86400000);

  // Fetch incidents in the analysis window
  const incidents = await db
    .select()
    .from(securityIncident)
    .where(
      and(
        eq(securityIncident.orgId, ctx.orgId),
        isNull(securityIncident.deletedAt),
        gte(securityIncident.detectedAt, windowStart),
      ),
    );

  if (incidents.length < MIN_INCIDENTS_FOR_CORRELATION) {
    return Response.json({
      data: [],
      meta: {
        message: "Nicht genug Daten fuer Korrelationsanalyse",
        incidentCount: incidents.length,
        minimumRequired: MIN_INCIDENTS_FOR_CORRELATION,
      },
    });
  }

  const correlations: Array<{
    correlationType: string;
    incidentIds: string[];
    campaignName: string | null;
    confidence: number;
    reasoning: string;
    sharedFactorsJson: Array<{ factor: string; description: string }>;
  }> = [];

  // Temporal correlation: incidents within 48h with same category
  const sorted = [...incidents].sort(
    (a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime(),
  );

  for (let i = 0; i < sorted.length; i++) {
    const cluster: typeof sorted = [sorted[i]];
    for (let j = i + 1; j < sorted.length; j++) {
      const timeDiff =
        (new Date(sorted[j].detectedAt).getTime() - new Date(sorted[i].detectedAt).getTime()) /
        (1000 * 3600);
      if (timeDiff <= TEMPORAL_WINDOW_HOURS && sorted[j].incidentType === sorted[i].incidentType) {
        cluster.push(sorted[j]);
      }
    }

    if (cluster.length >= 2) {
      const confidence = Math.min(95, 50 + cluster.length * 15);
      if (confidence >= minConfidence) {
        correlations.push({
          correlationType: "temporal",
          incidentIds: cluster.map((inc) => inc.id),
          campaignName: `${sorted[i].incidentType ?? "Unknown"} campaign`,
          confidence,
          reasoning: `${cluster.length} incidents of type '${sorted[i].incidentType}' detected within ${TEMPORAL_WINDOW_HOURS}h window`,
          sharedFactorsJson: [
            { factor: "temporal_proximity", description: `Within ${TEMPORAL_WINDOW_HOURS}h` },
            { factor: "same_type", description: `Type: ${sorted[i].incidentType}` },
          ],
        });
      }
    }
  }

  // Persist correlations
  const saved = await withAuditContext(ctx, async (tx) => {
    const rows = [];
    for (const corr of correlations) {
      const [row] = await tx
        .insert(incidentCorrelation)
        .values({
          orgId: ctx.orgId,
          correlationType: corr.correlationType,
          incidentIds: corr.incidentIds,
          campaignName: corr.campaignName,
          confidence: corr.confidence,
          reasoning: corr.reasoning,
          sharedFactorsJson: corr.sharedFactorsJson,
        })
        .returning();
      rows.push(row);
    }
    return rows;
  });

  return Response.json({
    data: saved,
    meta: {
      incidentsAnalyzed: incidents.length,
      correlationsFound: saved.length,
    },
  }, { status: 201 });
}
