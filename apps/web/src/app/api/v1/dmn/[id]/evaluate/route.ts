import { db, dmnDecision } from "@grc/db";
import { dmnEvaluateSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/dmn/:id/evaluate — Evaluate DMN decision
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = dmnEvaluateSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const [decision] = await db
    .select()
    .from(dmnDecision)
    .where(and(eq(dmnDecision.id, id), eq(dmnDecision.orgId, ctx.orgId)));

  if (!decision) {
    return Response.json({ error: "DMN decision not found" }, { status: 404 });
  }

  // Parse DMN XML and evaluate rules
  const result = evaluateDmnRules(decision, body.data.inputs as Record<string, unknown>);

  return Response.json({ data: result });
}

function evaluateDmnRules(
  decision: typeof dmnDecision.$inferSelect,
  inputs: Record<string, unknown>,
) {
  // Parse input/output schema
  const inputSchema = (decision.inputSchema as { id: string; name: string; type: string }[]) ?? [];
  const outputSchema = (decision.outputSchema as { id: string; name: string; type: string }[]) ?? [];
  const hitPolicy = decision.hitPolicy ?? "UNIQUE";

  // Extract rules from DMN XML (simplified parser for decision tables)
  const rules = extractRulesFromXml(decision.dmnXml);
  const matchedRules: number[] = [];
  const outputs: Record<string, unknown>[] = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;
    const match = rule.inputs.every((condition, colIdx) => {
      if (!condition || condition === "-" || condition === "") return true;
      const inputCol = inputSchema[colIdx];
      if (!inputCol) return true;
      const inputVal = inputs[inputCol.id] ?? inputs[inputCol.name];
      return matchesCondition(String(inputVal), condition);
    });

    if (match) {
      matchedRules.push(i);
      const output: Record<string, unknown> = {};
      rule.outputs.forEach((val, colIdx) => {
        const outputCol = outputSchema[colIdx];
        if (outputCol) {
          output[outputCol.id] = val;
        }
      });
      outputs.push(output);

      // Apply hit policy
      if (hitPolicy === "UNIQUE" || hitPolicy === "FIRST") {
        break;
      }
    }
  }

  return {
    matchedRules,
    outputs,
    hitPolicy,
    inputsUsed: inputs,
    totalRules: rules.length,
  };
}

function extractRulesFromXml(xml: string): { inputs: string[]; outputs: string[] }[] {
  // Simplified XML parsing for DMN decision tables
  const rules: { inputs: string[]; outputs: string[] }[] = [];
  const ruleMatches = xml.match(/<rule[^>]*>[\s\S]*?<\/rule>/gi) ?? [];

  for (const ruleXml of ruleMatches) {
    const inputEntries = ruleXml.match(/<inputEntry[^>]*>[\s\S]*?<\/inputEntry>/gi) ?? [];
    const outputEntries = ruleXml.match(/<outputEntry[^>]*>[\s\S]*?<\/outputEntry>/gi) ?? [];

    const inputs = inputEntries.map((entry) => {
      const textMatch = entry.match(/<text>([\s\S]*?)<\/text>/i);
      return textMatch?.[1]?.trim() ?? "";
    });

    const outputs = outputEntries.map((entry) => {
      const textMatch = entry.match(/<text>([\s\S]*?)<\/text>/i);
      return textMatch?.[1]?.trim() ?? "";
    });

    rules.push({ inputs, outputs });
  }

  return rules;
}

function matchesCondition(value: string, condition: string): boolean {
  if (condition.startsWith('"') && condition.endsWith('"')) {
    return value === condition.slice(1, -1);
  }
  if (condition.startsWith(">=")) return Number(value) >= Number(condition.slice(2));
  if (condition.startsWith("<=")) return Number(value) <= Number(condition.slice(2));
  if (condition.startsWith(">")) return Number(value) > Number(condition.slice(1));
  if (condition.startsWith("<")) return Number(value) < Number(condition.slice(1));
  if (condition.includes(",")) {
    return condition.split(",").map((s) => s.trim().replace(/"/g, "")).includes(value);
  }
  return value === condition;
}
