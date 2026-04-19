// GET  /api/v1/control-testing/test-plan-templates                — list available templates
// GET  /api/v1/control-testing/test-plan-templates?framework=...   — filter by framework
// GET  /api/v1/control-testing/test-plan-templates/:framework/:ref — get one template
//
// Pre-built, peer-reviewed test plans for high-stakes attestations (PCI DSS QSA,
// SOC 2 Type II, ISAE 3402). Auditors use these as starting points instead of
// invoking the AI agent for repeatable, defensible procedures.
//
// Source data lives in @grc/shared/lib/framework-test-plans (curated, versioned
// in the codebase rather than the DB so it's reviewed via PRs).

import { withAuth } from "@/lib/api";
import { listTestPlanTemplates, FRAMEWORK_TEST_PLAN_TEMPLATES } from "@grc/shared";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "control_owner", "viewer");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const framework = url.searchParams.get("framework") ?? undefined;
  const controlRef = url.searchParams.get("controlRef") ?? undefined;

  if (framework && controlRef) {
    const template = FRAMEWORK_TEST_PLAN_TEMPLATES[`${framework}::${controlRef}`];
    if (!template) {
      return Response.json({ error: "Template not found" }, { status: 404 });
    }
    return Response.json({ data: template });
  }

  const templates = listTestPlanTemplates(framework ?? undefined);

  // Group by framework for the picker UI
  const byFramework = templates.reduce<Record<string, { count: number; controlRefs: string[] }>>((acc, t) => {
    if (!acc[t.framework]) acc[t.framework] = { count: 0, controlRefs: [] };
    acc[t.framework].count++;
    acc[t.framework].controlRefs.push(t.controlRef);
    return acc;
  }, {});

  return Response.json({
    data: {
      templates: templates.map((t) => ({
        controlRef: t.controlRef,
        framework: t.framework,
        title: t.title,
        objective: t.objective,
        frequency: t.frequency,
        estimatedHours: t.estimatedHours,
        stepCount: t.steps.length,
      })),
      byFramework,
      totalTemplates: templates.length,
    },
  });
}
