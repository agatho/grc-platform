import { db, maturityRoadmapAction, controlMaturity, control } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { triggerMaturityRoadmapSchema } from "@grc/shared";
import {
  aiCompleteGoverned,
  buildMaturityRoadmapPrompt,
  maturityRoadmapArraySchema,
  parseJsonArray,
} from "@grc/ai";
import { aiErrorResponse, aiRateLimit } from "../../../ai/_shared/ai-route";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/isms/maturity/ai-roadmap — Generate AI maturity roadmap
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const limited = await aiRateLimit(ctx.userId, {
    bucket: "isms-roadmap",
    capacity: 3,
    windowSeconds: 300,
  });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = triggerMaturityRoadmapSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Rate limit: 1 generation per org per 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const [recent] = await db
    .select({ id: maturityRoadmapAction.id })
    .from(maturityRoadmapAction)
    .where(
      and(
        eq(maturityRoadmapAction.orgId, ctx.orgId),
        sql`${maturityRoadmapAction.createdAt} > ${fiveMinutesAgo}`,
      ),
    )
    .limit(1);

  if (recent) {
    return Response.json(
      { error: "Rate limited. Please wait 5 minutes between generations." },
      { status: 429 },
    );
  }

  // Gather current maturity data grouped by domain/category
  const maturityRows = await db
    .select({
      controlId: controlMaturity.controlId,
      currentMaturity: controlMaturity.currentMaturity,
      targetMaturity: controlMaturity.targetMaturity,
      controlTitle: control.title,
      controlDepartment: control.department,
    })
    .from(controlMaturity)
    .leftJoin(control, eq(controlMaturity.controlId, control.id))
    .where(eq(controlMaturity.orgId, ctx.orgId));

  if (maturityRows.length === 0) {
    return Response.json(
      {
        error:
          "No maturity data found. Please complete a maturity assessment first.",
      },
      { status: 400 },
    );
  }

  // Aggregate by domain
  const domainMap = new Map<
    string,
    { total: number; sumCurrent: number; sumTarget: number; count: number }
  >();
  for (const row of maturityRows) {
    const domain = row.controlDepartment ?? "General";
    const existing = domainMap.get(domain) ?? {
      total: 0,
      sumCurrent: 0,
      sumTarget: 0,
      count: 0,
    };
    existing.total++;
    existing.sumCurrent += row.currentMaturity;
    existing.sumTarget += row.targetMaturity;
    existing.count++;
    domainMap.set(domain, existing);
  }

  const maturityData = Array.from(domainMap.entries()).map(
    ([domain, data]) => ({
      domain,
      currentLevel: Math.round(data.sumCurrent / data.count),
      targetLevel: Math.max(
        Math.round(data.sumTarget / data.count),
        parsed.data.targetMaturity,
      ),
      controlCount: data.count,
    }),
  );

  // Build prompt and call AI
  const prompt = buildMaturityRoadmapPrompt({
    maturityData,
    targetMaturity: parsed.data.targetMaturity,
  });

  // [WP6 · S05-01/-03] wie in isms/soa/ai-gap-analysis: der hartkodierte
  // `provider: "claude_api"` ist entfallen, die Richtlinie entscheidet.
  let aiResult;
  try {
    aiResult = await aiCompleteGoverned({
      feature: "isms.maturity_roadmap",
      orgId: ctx.orgId,
      userId: ctx.userId,
      messages: prompt,
      maxTokens: 4096,
      temperature: 0.4,
      parse: parseJsonArray,
      outputSchema: maturityRoadmapArraySchema,
    });
  } catch (err) {
    return aiErrorResponse(err);
  }

  const actions = aiResult.data;

  if (actions.length === 0) {
    return Response.json({
      data: {
        roadmapRunId: null,
        totalActions: 0,
        quickWins: 0,
        actions: [],
        generatedAt: new Date().toISOString(),
      },
    });
  }

  // Persist actions
  const roadmapRunId = crypto.randomUUID();

  const result = await withAuditContext(ctx, async (tx) => {
    const inserted = [];
    for (const action of actions) {
      const [row] = await tx
        .insert(maturityRoadmapAction)
        .values({
          orgId: ctx.orgId,
          roadmapRunId,
          domain: action.domain,
          currentLevel: action.currentLevel,
          targetLevel: action.targetLevel,
          title: action.title,
          description: action.description,
          effort: action.effort,
          effortFteMonths: String(action.effortFteMonths),
          priority: action.priority,
          quarter: action.quarter,
          isQuickWin: action.isQuickWin,
          status: "proposed",
        })
        .returning();
      inserted.push(row);
    }

    // [WP6 · S05-11] Provenienz, siehe isms/soa/ai-gap-analysis.
    await tx.execute(sql`
      UPDATE maturity_roadmap_action
         SET ai_provider = ${aiResult.provider},
             ai_model = ${aiResult.model},
             prompt_sha256 = ${aiResult.promptSha256},
             egress_log_id = ${aiResult.egressLogId}::uuid
       WHERE roadmap_run_id = ${roadmapRunId}::uuid
         AND org_id = ${ctx.orgId}::uuid
    `);

    return inserted;
  });

  return Response.json({
    data: {
      roadmapRunId,
      totalActions: result.length,
      quickWins: result.filter((a) => a.isQuickWin).length,
      actions: result,
      generatedAt: new Date().toISOString(),
      aiDisclosure: aiResult.disclosure,
    },
  });
});
