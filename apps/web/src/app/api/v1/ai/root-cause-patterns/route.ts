// POST /api/v1/ai/root-cause-patterns — AI pattern detection across findings
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05-11, S05-12]

import { db, finding } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { requireModule } from "@grc/auth";
import { aiRootCausePatternsSchema } from "@grc/shared";
import {
  aiCompleteGoverned,
  buildRootCausePatternPrompt,
  rootCausePatternsSchema,
  safeJsonParse,
} from "@grc/ai";
import { aiRateLimit, aiErrorResponse, aiJson } from "../_shared/ai-route";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  const body = aiRootCausePatternsSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const months =
    body.data.period === "3m" ? 3 : body.data.period === "6m" ? 6 : 12;
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const findings = await db
    .select({
      id: finding.id,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      source: finding.source,
      status: finding.status,
      createdAt: finding.createdAt,
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        sql`${finding.createdAt} >= ${since.toISOString()}`,
      ),
    )
    .limit(200);

  if (findings.length < 3) {
    return Response.json({
      data: {
        patterns: [],
        message:
          "Not enough findings for pattern analysis (minimum 3 required)",
        findingsAnalyzed: findings.length,
      },
    });
  }

  try {
    const result = await aiCompleteGoverned({
      feature: "ai.root_cause_patterns",
      orgId: ctx.orgId,
      userId: ctx.userId,
      messages: buildRootCausePatternPrompt({
        months,
        findings: findings.map((f) => ({
          title: f.title,
          description: f.description,
          severity: f.severity,
          source: f.source,
        })),
      }),
      maxTokens: 3000,
      temperature: 0.2,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: rootCausePatternsSchema,
    });

    return aiJson(
      {
        period: body.data.period,
        findingsAnalyzed: findings.length,
        patterns: result.data.patterns,
        model: result.model,
        provider: result.provider,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
