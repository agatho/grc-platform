import {
  db,
  architectureRuleViolation,
  architectureRule,
  architectureElement,
} from "@grc/db";
import { updateViolationStatusSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/violations — Current violations
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const severity = url.searchParams.get("severity");

  const violations = await db
    .select({
      violation: architectureRuleViolation,
      ruleName: architectureRule.name,
      ruleSeverity: architectureRule.severity,
      elementName: architectureElement.name,
    })
    .from(architectureRuleViolation)
    .innerJoin(
      architectureRule,
      eq(architectureRuleViolation.ruleId, architectureRule.id),
    )
    .innerJoin(
      architectureElement,
      eq(architectureRuleViolation.elementId, architectureElement.id),
    )
    .where(eq(architectureRuleViolation.orgId, ctx.orgId))
    .orderBy(desc(architectureRuleViolation.detectedAt));

  let filtered = violations;
  if (status) filtered = filtered.filter((v) => v.violation.status === status);
  if (severity) filtered = filtered.filter((v) => v.ruleSeverity === severity);

  return Response.json({ data: filtered });
}
