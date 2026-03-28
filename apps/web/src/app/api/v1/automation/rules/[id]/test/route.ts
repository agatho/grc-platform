import { db, automationRule } from "@grc/db";
import { automationDryRunSchema } from "@grc/shared";
import { AutomationEngine } from "@grc/automation";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// Stub services for dry-run — no real actions executed
const dryRunServices = {
  createTask: async () => ({ id: "dry-run" }),
  sendNotification: async () => {},
  sendEmail: async () => {},
  changeStatus: async () => {},
  escalate: async () => {},
  triggerWebhook: async () => {},
};

// POST /api/v1/automation/rules/:id/test — Dry-run test (admin only)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Optional body for entity override
  let bodyData: { entityType?: string; entityId?: string } = {};
  try {
    const rawBody = await req.json();
    const parsed = automationDryRunSchema.safeParse(rawBody);
    if (parsed.success) {
      bodyData = parsed.data;
    }
  } catch {
    // Empty body is fine for dry-run
  }

  // Verify rule exists
  const [rule] = await db
    .select()
    .from(automationRule)
    .where(and(eq(automationRule.id, id), eq(automationRule.orgId, ctx.orgId)));

  if (!rule) {
    return Response.json({ error: "Rule not found" }, { status: 404 });
  }

  const engine = new AutomationEngine({ services: dryRunServices });

  try {
    const result = await engine.dryRun(
      id,
      ctx.orgId,
      bodyData.entityType && bodyData.entityId
        ? {
            entityType: bodyData.entityType,
            entityId: bodyData.entityId,
            entity: {}, // In production, would load actual entity
          }
        : undefined,
    );

    return Response.json({
      data: {
        conditionsMatched: result.conditionsMatched,
        trace: result.trace,
        wouldExecute: result.wouldExecute,
        status: "dry_run",
      },
    });
  } catch (err) {
    return Response.json(
      {
        error: "Dry-run failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
