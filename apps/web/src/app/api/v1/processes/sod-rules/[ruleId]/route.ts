// PATCH / DELETE /api/v1/processes/sod-rules/:ruleId
//
// [ARCTOS-FULL-2026-08-31 · OP-001] Siehe `../route.ts`.
//
// Die Rollenpaarung selbst ist **nicht** änderbar: eine Regel, die von
// (A,B) auf (C,D) umgeschrieben wird, ist eine andere Regel, und ihre
// Prüfungsspur gehörte dann zur falschen. Ändern lassen sich Einstufung,
// Begründung, Rahmenwerksbezug und der Aktivzustand; wer die Paarung ändern
// will, löscht und legt neu an.

import { db, sodRule } from "@grc/db";
import { updateSodRuleSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const ctx = await withAuth("admin", "compliance_officer", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { ruleId } = await params;
  const parsed = updateSodRuleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select({ id: sodRule.id })
    .from(sodRule)
    .where(and(eq(sodRule.id, ruleId), eq(sodRule.orgId, ctx.orgId)));
  if (!existing) {
    return Response.json({ error: "Rule not found" }, { status: 404 });
  }

  const v = parsed.data;
  const patch: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };
  if ("severity" in v) patch.severity = v.severity;
  if ("rationale" in v) patch.rationale = v.rationale ?? null;
  if ("frameworkRef" in v) patch.frameworkRef = v.frameworkRef ?? null;
  if ("isActive" in v) patch.isActive = v.isActive;

  const updated = await withAuditContext(
    ctx,
    async (tx) => {
      const [row] = await tx
        .update(sodRule)
        .set(patch)
        .where(and(eq(sodRule.id, ruleId), eq(sodRule.orgId, ctx.orgId)))
        .returning();
      return row;
    },
    // Die Deaktivierung ist die folgenreichste Änderung an dieser Tabelle:
    // sie lässt einen Konflikt aus dem Diagramm verschwinden (STUFE2-E §1.2).
    {
      actionDetail:
        v.isActive === false
          ? `SoD rule deactivated (${ruleId})`
          : `SoD rule updated (${ruleId})`,
    },
  );

  return Response.json({ data: updated });
});

export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const ctx = await withAuth("admin", "compliance_officer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { ruleId } = await params;
  const [existing] = await db
    .select({ id: sodRule.id })
    .from(sodRule)
    .where(and(eq(sodRule.id, ruleId), eq(sodRule.orgId, ctx.orgId)));
  if (!existing) {
    return Response.json({ error: "Rule not found" }, { status: 404 });
  }

  await withAuditContext(
    ctx,
    async (tx) => {
      await tx
        .delete(sodRule)
        .where(and(eq(sodRule.id, ruleId), eq(sodRule.orgId, ctx.orgId)));
    },
    { actionDetail: `SoD rule deleted (${ruleId})` },
  );

  return Response.json({ data: { id: ruleId } });
});
