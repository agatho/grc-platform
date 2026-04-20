import {
  db,
  soaAiSuggestion,
  soaEntry,
  catalogEntry,
  control,
  asset,
  risk,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { triggerSoaGapAnalysisSchema } from "@grc/shared";
import { aiComplete } from "@grc/ai";
import { buildSoaGapPrompt, parseSoaGapResponse } from "@grc/ai";

// POST /api/v1/isms/soa/ai-gap-analysis — Trigger AI gap analysis
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = triggerSoaGapAnalysisSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Rate limit: 1 analysis per org per 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const [recent] = await db
    .select({ id: soaAiSuggestion.id })
    .from(soaAiSuggestion)
    .where(
      and(
        eq(soaAiSuggestion.orgId, ctx.orgId),
        sql`${soaAiSuggestion.createdAt} > ${fiveMinutesAgo}`,
      ),
    )
    .limit(1);

  if (recent) {
    return Response.json(
      { error: "Rate limited. Please wait 5 minutes between analyses." },
      { status: 429 },
    );
  }

  // Gather SoA data
  const soaRows = await db
    .select({
      controlRef: catalogEntry.code,
      controlTitle: catalogEntry.name,
      applicability: soaEntry.applicability,
      implementation: soaEntry.implementation,
      controlId: soaEntry.controlId,
    })
    .from(soaEntry)
    .leftJoin(catalogEntry, eq(soaEntry.catalogEntryId, catalogEntry.id))
    .where(eq(soaEntry.orgId, ctx.orgId));

  if (soaRows.length === 0) {
    return Response.json(
      { error: "No SoA entries found. Please generate SoA first." },
      { status: 400 },
    );
  }

  // Gather linked control titles for display
  const controlIds = soaRows
    .filter((r) => r.controlId)
    .map((r) => r.controlId!);
  const controlTitles: Map<string, string> = new Map();
  if (controlIds.length > 0) {
    const controls = await db
      .select({ id: control.id, title: control.title })
      .from(control)
      .where(sql`${control.id} in ${controlIds}`);
    controls.forEach((c) => controlTitles.set(c.id, c.title));
  }

  // Gather summaries
  const assets = await db
    .select({ name: asset.name, tier: asset.assetTier })
    .from(asset)
    .where(eq(asset.orgId, ctx.orgId))
    .limit(50);
  const assetSummary =
    assets.map((a) => `${a.name} (${a.tier})`).join(", ") ||
    "No assets registered";

  const risks = await db
    .select({ title: risk.title, riskCategory: risk.riskCategory })
    .from(risk)
    .where(eq(risk.orgId, ctx.orgId))
    .limit(50);
  const riskSummary =
    risks
      .map((r) => `${r.title}${r.riskCategory ? ` [${r.riskCategory}]` : ""}`)
      .join(", ") || "No risks registered";

  // Build prompt
  const soaData = soaRows.map((r) => ({
    controlRef: r.controlRef ?? "Unknown",
    controlTitle: r.controlTitle ?? "Unknown",
    applicability: r.applicability,
    implementation: r.implementation,
    linkedControlTitle: r.controlId
      ? controlTitles.get(r.controlId)
      : undefined,
  }));

  const prompt = buildSoaGapPrompt({
    soaData,
    assetSummary,
    processSummary: "See asset inventory for process dependencies",
    riskSummary,
    framework: parsed.data.framework,
  });

  // Call AI
  const aiResponse = await aiComplete({
    messages: [
      {
        role: "system",
        content:
          "You are an ISO 27001 compliance auditor. Respond only with valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    model: "claude-sonnet-4-20250514",
    maxTokens: 4096,
    temperature: 0.3,
    provider: "claude_api",
  });

  // Parse response
  const gaps = parseSoaGapResponse(aiResponse.text);

  if (gaps.length === 0) {
    return Response.json({
      data: {
        analysisRunId: null,
        framework: parsed.data.framework,
        totalSuggestions: 0,
        gapsByType: { not_covered: 0, partial: 0, full: 0 },
        suggestions: [],
        analyzedAt: new Date().toISOString(),
      },
    });
  }

  // Persist suggestions
  const analysisRunId = crypto.randomUUID();

  const result = await withAuditContext(ctx, async (tx) => {
    const suggestions = [];
    for (const gap of gaps) {
      const [row] = await tx
        .insert(soaAiSuggestion)
        .values({
          orgId: ctx.orgId,
          analysisRunId,
          framework: parsed.data.framework,
          frameworkControlRef: gap.controlRef,
          frameworkControlTitle: gap.controlTitle,
          confidence: gap.confidence,
          gapType: gap.gapType,
          reasoning: gap.reasoning,
          priority: gap.priority,
          status: "pending",
        })
        .returning();
      suggestions.push(row);
    }
    return suggestions;
  });

  const gapsByType = {
    not_covered: result.filter((s) => s.gapType === "not_covered").length,
    partial: result.filter((s) => s.gapType === "partial").length,
    full: result.filter((s) => s.gapType === "full").length,
  };

  return Response.json({
    data: {
      analysisRunId,
      framework: parsed.data.framework,
      totalSuggestions: result.length,
      gapsByType,
      suggestions: result,
      analyzedAt: new Date().toISOString(),
    },
  });
}

// GET /api/v1/isms/soa/ai-gap-analysis — Get latest gap analysis results
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const framework = url.searchParams.get("framework");

  const conditions: ReturnType<typeof eq>[] = [
    eq(soaAiSuggestion.orgId, ctx.orgId),
  ];

  if (status) {
    conditions.push(eq(soaAiSuggestion.status, status));
  }
  if (framework) {
    conditions.push(eq(soaAiSuggestion.framework, framework));
  }

  // Get latest analysis run
  const [latestRun] = await db
    .select({ analysisRunId: soaAiSuggestion.analysisRunId })
    .from(soaAiSuggestion)
    .where(eq(soaAiSuggestion.orgId, ctx.orgId))
    .orderBy(desc(soaAiSuggestion.createdAt))
    .limit(1);

  if (!latestRun) {
    return Response.json({
      data: { analysisRunId: null, suggestions: [], totalSuggestions: 0 },
    });
  }

  conditions.push(eq(soaAiSuggestion.analysisRunId, latestRun.analysisRunId));

  const suggestions = await db
    .select()
    .from(soaAiSuggestion)
    .where(and(...conditions))
    .orderBy(
      sql`case ${soaAiSuggestion.priority} when 'critical' then 1 when 'high' then 2 when 'medium' then 3 when 'low' then 4 end`,
      desc(soaAiSuggestion.confidence),
    );

  const gapsByType = {
    not_covered: suggestions.filter((s) => s.gapType === "not_covered").length,
    partial: suggestions.filter((s) => s.gapType === "partial").length,
    full: suggestions.filter((s) => s.gapType === "full").length,
  };

  return Response.json({
    data: {
      analysisRunId: latestRun.analysisRunId,
      totalSuggestions: suggestions.length,
      gapsByType,
      suggestions,
    },
  });
}
