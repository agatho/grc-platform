import { db, automationRule } from "@grc/db";
import { automationDryRunSchema } from "@grc/shared";
import { AutomationEngine } from "@grc/automation";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02 · C-10] `withErrorHandler` is what opens the
// `requestDbStorage.run(...)` frame that `withAuth` mutates with the
// org-pinned connection (apps/web/src/lib/api-wrapper.ts). Without it the
// handler's queries run on the context-less base pool and RLS filters every
// row — the C-01 shape of the first triage round, which this file and 14 other
// route files were missed by.
import { withErrorHandler } from "@/lib/api-wrapper";

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
export const POST = withErrorHandler(async function POST(
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
    // #SEC-LEAK-FIX: previously returned err.message in the response —
    // CodeQL js/stack-trace-exposure. Now logs full detail server-side
    // and returns only a generic body. requestId in the response would
    // require withErrorHandler; for this manual catch we surface a
    // static message and rely on Docker logs for diagnosis.
    console.error("[automation/rules/[id]/test] dry-run failed", err);
    return Response.json({ error: "Dry-run failed" }, { status: 500 });
  }
});
