// PUT /api/v1/processes/:id/step-raci/:stepId — die RACI-Zuordnungen EINES
// Schritts vollständig ersetzen.
//
// [ARCTOS-FULL-2026-08-31 · OP-001]
//
// Ersetzend statt additiv, und das ist die eigentliche Entscheidung dieser
// Route: „Rolle X ist hier **nicht mehr** zu konsultieren" ist eine Aussage,
// die eine Pflegemaske treffen können muss. Eine rein additive Schnittstelle
// (wie `rehydrateFromBpmnXml`, das ausdrücklich nie löscht) hätte für das
// Entfernen keine Operation — der Benutzer könnte eine falsche Zuordnung
// eintragen und nie wieder loswerden.
//
// Alles in EINER Transaktion mit Audit-Rahmen: `process_step_raci` hängt am
// `audit_trigger` (0447). Löschen und Neuanlegen ausserhalb einer Transaktion
// hinterliesse zwischendurch einen Zustand ohne Verantwortlichen.

import { db, process, processStep, processStepRaci, customRole } from "@grc/db";
import { putStepRaciSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { and, eq, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "compliance_officer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;
  const parsed = putStepRaciSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [proc] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const [step] = await db
    .select({ id: processStep.id })
    .from(processStep)
    .where(
      and(
        eq(processStep.id, stepId),
        eq(processStep.processId, id),
        eq(processStep.orgId, ctx.orgId),
        isNull(processStep.deletedAt),
      ),
    );
  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  const known = new Set(
    (
      await db
        .select({ id: customRole.id })
        .from(customRole)
        .where(eq(customRole.orgId, ctx.orgId))
    ).map((r) => r.id),
  );
  for (const entry of parsed.data.entries) {
    if (!known.has(entry.roleId)) {
      return Response.json({ error: "Unknown role" }, { status: 422 });
    }
  }

  // Doppelte (Rolle, Buchstabe) fangen wir hier ab statt am Unique-Index:
  // die Datenbank antwortete sonst mit 500, und der Benutzer hätte nicht
  // erfahren, welche Zeile doppelt war.
  const seen = new Set<string>();
  for (const entry of parsed.data.entries) {
    const key = `${entry.roleId}:${entry.raciRole}`;
    if (seen.has(key)) {
      return Response.json(
        { error: "Duplicate role/letter pair" },
        { status: 422 },
      );
    }
    seen.add(key);
  }

  const rows = await withAuditContext(
    ctx,
    async (tx) => {
      await tx
        .delete(processStepRaci)
        .where(
          and(
            eq(processStepRaci.orgId, ctx.orgId),
            eq(processStepRaci.processStepId, stepId),
          ),
        );
      if (parsed.data.entries.length === 0) return [];
      return tx
        .insert(processStepRaci)
        .values(
          parsed.data.entries.map((e) => ({
            orgId: ctx.orgId,
            processStepId: stepId,
            roleId: e.roleId,
            raciRole: e.raciRole,
            source: "manual" as const,
            note: e.note ?? null,
            createdBy: ctx.userId,
          })),
        )
        .returning();
    },
    { actionDetail: `RACI assignments replaced for step ${stepId}` },
  );

  return Response.json({ data: rows });
});
