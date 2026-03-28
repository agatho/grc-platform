import { db, abacPolicy, abacAccessLog } from "@grc/db";
import { abacTestSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/admin/abac/test — Test ABAC policy against user + entity
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = abacTestSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const startTime = Date.now();

  // Load active policies for entity type, sorted by priority
  const policies = await db
    .select()
    .from(abacPolicy)
    .where(
      and(
        eq(abacPolicy.orgId, ctx.orgId),
        eq(abacPolicy.entityType, body.data.entityType),
        eq(abacPolicy.isActive, true),
      ),
    )
    .orderBy(abacPolicy.priority);

  // Evaluate policies - lower priority number wins
  let matchedPolicy = null;
  let decision: "granted" | "denied" = "granted";
  let accessLevel = body.data.accessLevel;

  for (const policy of policies) {
    const subjectMatch = evaluateCondition(
      policy.subjectCondition as Record<string, unknown>,
      {},
    );
    const objectMatch = evaluateCondition(
      policy.objectCondition as Record<string, unknown>,
      {},
    );

    if (subjectMatch && objectMatch) {
      matchedPolicy = policy;
      const policyAccess = policy.accessLevel as string;

      if (policyAccess === "none") {
        decision = "denied";
      } else if (policyAccess === "read" && accessLevel === "write") {
        decision = "denied";
      } else {
        decision = "granted";
      }
      break;
    }
  }

  const durationMs = Date.now() - startTime;

  // Log access decision
  await db.insert(abacAccessLog).values({
    orgId: ctx.orgId,
    userId: body.data.userId,
    entityType: body.data.entityType,
    entityId: body.data.entityId,
    accessLevel,
    decision,
    matchedPolicyId: matchedPolicy?.id,
    evaluationDurationMs: durationMs,
  });

  return Response.json({
    data: {
      decision,
      accessLevel: matchedPolicy?.accessLevel ?? accessLevel,
      matchedPolicy: matchedPolicy
        ? { id: matchedPolicy.id, name: matchedPolicy.name, priority: matchedPolicy.priority }
        : null,
      evaluatedPolicies: policies.length,
      durationMs,
    },
  });
}

function evaluateCondition(
  condition: Record<string, unknown>,
  attributes: Record<string, unknown>,
): boolean {
  const { attribute, operator, value } = condition as {
    attribute: string;
    operator: string;
    value: unknown;
  };

  const attrValue = attributes[attribute];

  switch (operator) {
    case "=":
      return attrValue === value;
    case "!=":
      return attrValue !== value;
    case "contains":
      return Array.isArray(attrValue)
        ? attrValue.includes(value)
        : String(attrValue).includes(String(value));
    case "in":
      return Array.isArray(value) ? (value as unknown[]).includes(attrValue) : false;
    default:
      return true;
  }
}
