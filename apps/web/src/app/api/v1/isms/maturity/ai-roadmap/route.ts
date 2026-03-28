import { db, maturityRoadmapAction, controlMaturity, control } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { triggerMaturityRoadmapSchema } from "@grc/shared";
import { aiComplete } from "@grc/ai";
import { buildMaturityRoadmapPrompt, parseMaturityRoadmapResponse } from "@grc/ai";

// POST /api/v1/isms/maturity/ai-roadmap — Generate AI maturity roadmap
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = triggerMaturityRoadmapSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
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
      { error: "No maturity data found. Please complete a maturity assessment first." },
      { status: 400 },
    );
  }

  // Aggregate by domain
  const domainMap = new Map<string, { total: number; sumCurrent: number; sumTarget: number; count: number }>();
  for (const row of maturityRows) {
    const domain = row.controlDepartment ?? "General";
    const existing = domainMap.get(domain) ?? { total: 0, sumCurrent: 0, sumTarget: 0, count: 0 };
    existing.total++;
    existing.sumCurrent += row.currentMaturity;
    existing.sumTarget += row.targetMaturity;
    existing.count++;
    domainMap.set(domain, existing);
  }

  const maturityData = Array.from(domainMap.entries()).map(([domain, data]) => ({
    domain,
    currentLevel: Math.round(data.sumCurrent / data.count),
    targetLevel: Math.max(Math.round(data.sumTarget / data.count), parsed.data.targetMaturity),
    controlCount: data.count,
  }));

  // Build prompt and call AI
  const prompt = buildMaturityRoadmapPrompt({
    maturityData,
    targetMaturity: parsed.data.targetMaturity,
  });

  const aiResponse = await aiComplete({
    messages: [
      { role: "system", content: "You are an ISMS maturity consultant. Respond only with valid JSON." },
      { role: "user", content: prompt },
    ],
    model: "claude-sonnet-4-20250514",
    maxTokens: 4096,
    temperature: 0.4,
    provider: "claude_api",
  });

  // Parse response
  const actions = parseMaturityRoadmapResponse(aiResponse.text);

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
    return inserted;
  });

  return Response.json({
    data: {
      roadmapRunId,
      totalActions: result.length,
      quickWins: result.filter(a => a.isQuickWin).length,
      actions: result,
      generatedAt: new Date().toISOString(),
    },
  });
}
