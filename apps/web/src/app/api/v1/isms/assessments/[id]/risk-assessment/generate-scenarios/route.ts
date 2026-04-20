// POST /api/v1/isms/assessments/[id]/risk-assessment/generate-scenarios
//
// Sprint 1.3: ISO 27005 Risk-Scenario-Bulk-Generation.
// Fuer jede (Threat x Vulnerability x Asset)-Kombination im Scope:
//   - Wenn bereits ein risk_scenario existiert: skip
//   - Sonst: neuen risk_scenario anlegen
//   - Fuer jedes neue scenario: assessment_risk_eval-Stub mit decision='pending'
//
// Body (alle optional):
//   - assetIds: uuid[] -- auf diese Assets einschraenken
//   - threatIds: uuid[] -- auf diese Threats einschraenken
//   - includeCatalogThreats: boolean (default true) -- system-threats aus Katalog
//   - minVulnSeverity: 'low'|'medium'|'high'|'critical' -- Filter
//
// Matching-Regel:
//   - Wenn Vulnerability.affectedAssetId gesetzt: Asset-Link automatisch
//   - Threats werden jedem Asset zugeordnet (M:N) -- bei grossen Orgs
//     per scope_filter eingrenzen
//
// Safeguards:
//   - Max 10.000 Scenarios pro Call (DB-Schutz)
//   - withAuditContext wrap

import {
  db,
  assessmentRun,
  threat,
  vulnerability,
  asset,
  riskScenario,
  assessmentRiskEval,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  assetIds: z.array(z.string().uuid()).optional(),
  threatIds: z.array(z.string().uuid()).optional(),
  includeCatalogThreats: z.boolean().default(true),
  minVulnSeverity: z.enum(["low", "medium", "high", "critical"]).default("low"),
});

const SEVERITY_ORDER: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};
const MAX_SCENARIOS_PER_CALL = 10_000;

export async function POST(req: Request, { params }: RouteParams) {
  const { id: runId } = await params;

  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Body (tolerant)
  let bodyData: z.infer<typeof bodySchema>;
  try {
    const raw = await req.text();
    const parsed = bodySchema.safeParse(
      raw && raw.trim().length > 0 ? JSON.parse(raw) : {},
    );
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 },
      );
    }
    bodyData = parsed.data;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Run validieren
  const [run] = await db
    .select()
    .from(assessmentRun)
    .where(
      and(eq(assessmentRun.id, runId), eq(assessmentRun.orgId, ctx.orgId)),
    );
  if (!run) {
    return Response.json(
      { error: "Assessment run not found" },
      { status: 404 },
    );
  }

  if (run.status !== "in_progress" && run.status !== "planning") {
    return Response.json(
      {
        error: `Run status '${run.status}' -- Scenario-Generation nur fuer planning/in_progress`,
      },
      { status: 422 },
    );
  }

  // Threats laden
  let threats = await db
    .select({ id: threat.id, title: threat.title, isSystem: threat.isSystem })
    .from(threat)
    .where(eq(threat.orgId, ctx.orgId));

  if (!bodyData.includeCatalogThreats) {
    threats = threats.filter((t) => !t.isSystem);
  }
  if (bodyData.threatIds && bodyData.threatIds.length > 0) {
    const filter = new Set(bodyData.threatIds);
    threats = threats.filter((t) => filter.has(t.id));
  }

  if (threats.length === 0) {
    return Response.json(
      {
        error: "No threats available",
        hint: "Aktiviere ISO 27005 Threats-Katalog oder lege eigene Threats an.",
      },
      { status: 400 },
    );
  }

  // Vulnerabilities laden
  const minSev = SEVERITY_ORDER[bodyData.minVulnSeverity];
  const vulns = await db
    .select({
      id: vulnerability.id,
      title: vulnerability.title,
      affectedAssetId: vulnerability.affectedAssetId,
      severity: vulnerability.severity,
    })
    .from(vulnerability)
    .where(eq(vulnerability.orgId, ctx.orgId));

  const filteredVulns = vulns.filter(
    (v) => (SEVERITY_ORDER[v.severity] ?? 1) >= minSev,
  );

  if (filteredVulns.length === 0) {
    return Response.json(
      { error: "No vulnerabilities matching severity filter" },
      { status: 400 },
    );
  }

  // Assets laden (optional filter)
  let assets = await db
    .select({ id: asset.id, name: asset.name })
    .from(asset)
    .where(eq(asset.orgId, ctx.orgId));
  if (bodyData.assetIds && bodyData.assetIds.length > 0) {
    const filter = new Set(bodyData.assetIds);
    assets = assets.filter((a) => filter.has(a.id));
  }

  // Kombinationen bilden
  const combinations: Array<{
    threatId: string;
    vulnId: string;
    assetId: string | null;
  }> = [];

  for (const vuln of filteredVulns) {
    // Wenn Vuln an ein Asset gebunden ist: nur dieses Asset
    const vulnAssetIds = vuln.affectedAssetId
      ? assets.some((a) => a.id === vuln.affectedAssetId)
        ? [vuln.affectedAssetId]
        : [] // asset nicht in scope
      : assets.map((a) => a.id); // vuln generisch: alle Assets

    for (const assetId of vulnAssetIds) {
      for (const t of threats) {
        combinations.push({ threatId: t.id, vulnId: vuln.id, assetId });
      }
    }
  }

  if (combinations.length === 0) {
    return Response.json({
      data: {
        created: 0,
        skipped: 0,
        evalStubsCreated: 0,
        totalCombinations: 0,
      },
    });
  }

  if (combinations.length > MAX_SCENARIOS_PER_CALL) {
    return Response.json(
      {
        error: `Too many combinations (${combinations.length}). Max ${MAX_SCENARIOS_PER_CALL}.`,
        hint: "Engere scope_filter (assetIds, threatIds, minVulnSeverity).",
      },
      { status: 413 },
    );
  }

  // Existierende scenarios laden (Dedup pro org)
  const existing = await db
    .select({
      id: riskScenario.id,
      threatId: riskScenario.threatId,
      vulnerabilityId: riskScenario.vulnerabilityId,
      assetId: riskScenario.assetId,
    })
    .from(riskScenario)
    .where(eq(riskScenario.orgId, ctx.orgId));

  const existingSet = new Set(
    existing.map((e) => `${e.threatId}::${e.vulnerabilityId}::${e.assetId}`),
  );

  const toCreate = combinations.filter(
    (c) => !existingSet.has(`${c.threatId}::${c.vulnId}::${c.assetId}`),
  );

  // Bulk-Insert in 100er-Chunks
  let createdScenarios = 0;
  const newScenarioIds: string[] = [];

  if (toCreate.length > 0) {
    await withAuditContext(ctx, async (tx) => {
      const CHUNK = 100;
      for (let i = 0; i < toCreate.length; i += CHUNK) {
        const chunk = toCreate.slice(i, i + CHUNK);
        const inserted = await tx
          .insert(riskScenario)
          .values(
            chunk.map((c) => ({
              orgId: ctx.orgId,
              threatId: c.threatId,
              vulnerabilityId: c.vulnId,
              assetId: c.assetId,
            })),
          )
          .returning({ id: riskScenario.id });
        createdScenarios += inserted.length;
        newScenarioIds.push(...inserted.map((row: { id: string }) => row.id));
      }
    });
  }

  // Pro (neues + alle vorhandenen) Scenarios: assessment_risk_eval-Stub anlegen
  // wenn noch keiner fuer diesen Run existiert
  const allScenarioIds = [...newScenarioIds, ...existing.map((e) => e.id)];

  const existingEvals = await db
    .select({ scenarioId: assessmentRiskEval.riskScenarioId })
    .from(assessmentRiskEval)
    .where(
      and(
        eq(assessmentRiskEval.assessmentRunId, runId),
        inArray(assessmentRiskEval.riskScenarioId, allScenarioIds),
      ),
    );
  const existingEvalSet = new Set(existingEvals.map((e) => e.scenarioId));

  const missingEvalScenarioIds = allScenarioIds.filter(
    (id) => !existingEvalSet.has(id),
  );

  let evalStubsCreated = 0;
  if (missingEvalScenarioIds.length > 0) {
    await withAuditContext(ctx, async (tx) => {
      const CHUNK = 100;
      for (let i = 0; i < missingEvalScenarioIds.length; i += CHUNK) {
        const chunk = missingEvalScenarioIds.slice(i, i + CHUNK);
        await tx.insert(assessmentRiskEval).values(
          chunk.map((scenarioId) => ({
            orgId: ctx.orgId,
            assessmentRunId: runId,
            riskScenarioId: scenarioId,
            decision: "pending" as const,
          })),
        );
        evalStubsCreated += chunk.length;
      }
    });
  }

  return Response.json({
    data: {
      totalCombinations: combinations.length,
      skipped: combinations.length - toCreate.length,
      created: createdScenarios,
      evalStubsCreated,
      hint:
        missingEvalScenarioIds.length > 0
          ? "Bearbeite jetzt die assessment_risk_evals -- setze per Scenario eine Decision (accept|mitigate|transfer|avoid)."
          : "Alle Scenarios haben bereits Evals.",
    },
  });
}
