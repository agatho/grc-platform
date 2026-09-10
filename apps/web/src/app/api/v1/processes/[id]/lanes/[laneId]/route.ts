// PATCH /api/v1/processes/:id/lanes/:laneId — den Träger einer Lane pflegen.
//
// [ARCTOS-FULL-2026-08-31 · OP-001] Die Schreibseite der ersten Pflegemaske.
// Gepflegt wird ausschliesslich, was NICHT im BPMN-XML steht: Rolle,
// Organisationseinheit, Dienstleister, `is_external`, Drittland. Name, Art und
// Reihenfolge kommen aus dem Modell und werden von `syncProcessLanes`
// gehalten — würde die Maske sie schreiben, überschriebe der nächste
// Versionsspeichervorgang sie wieder.
//
// `withAuditContext`, weil `process_lane` seit 0444 am `audit_trigger` hängt:
// „wer eine Lane von der eigenen Einheit auf einen Dienstleister im Drittland
// umschreibt, ändert eine Datenschutzaussage über den ganzen Prozess"
// (STUFE2-E §1.1). Ohne den Transaktionsrahmen stünde die Änderung ohne
// Urheber in einer hashverketteten Tabelle.

import {
  db,
  process,
  processLane,
  customRole,
  eamOrgUnit,
  vendor,
} from "@grc/db";
import { updateProcessLaneSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { lanePatchFrom } from "../../../_lib/grc-maintenance";

export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; laneId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "compliance_officer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, laneId } = await params;

  const parsed = updateProcessLaneSchema.safeParse(await req.json());
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

  const [lane] = await db
    .select({ id: processLane.id })
    .from(processLane)
    .where(
      and(
        eq(processLane.id, laneId),
        eq(processLane.processId, id),
        eq(processLane.orgId, ctx.orgId),
      ),
    );
  if (!lane) {
    return Response.json({ error: "Lane not found" }, { status: 404 });
  }

  // Fremdschlüssel gegen den eigenen Mandanten prüfen, bevor die Datenbank es
  // tut: der FK allein liesse eine fremde Kennung mit einem 500 auflaufen,
  // und ein 500 sagt dem Benutzer nichts über die Ursache.
  const v = parsed.data;
  if (v.customRoleId) {
    const [row] = await db
      .select({ id: customRole.id })
      .from(customRole)
      .where(
        and(eq(customRole.id, v.customRoleId), eq(customRole.orgId, ctx.orgId)),
      );
    if (!row) {
      return Response.json({ error: "Unknown role" }, { status: 422 });
    }
  }
  if (v.orgUnitId) {
    const [row] = await db
      .select({ id: eamOrgUnit.id })
      .from(eamOrgUnit)
      .where(
        and(eq(eamOrgUnit.id, v.orgUnitId), eq(eamOrgUnit.orgId, ctx.orgId)),
      );
    if (!row) {
      return Response.json({ error: "Unknown org unit" }, { status: 422 });
    }
  }
  if (v.vendorId) {
    const [row] = await db
      .select({ id: vendor.id })
      .from(vendor)
      .where(
        and(
          eq(vendor.id, v.vendorId),
          eq(vendor.orgId, ctx.orgId),
          isNull(vendor.deletedAt),
        ),
      );
    if (!row) {
      return Response.json({ error: "Unknown vendor" }, { status: 422 });
    }
  }

  // `lanePatchFrom` haelt den Unterschied zwischen „nicht im Aufruf" und
  // „ausdruecklich null" — siehe `_lib/grc-maintenance.ts`.
  const patch = lanePatchFrom(v, { userId: ctx.userId, now: new Date() });

  const updated = await withAuditContext(
    ctx,
    async (tx) => {
      const [row] = await tx
        .update(processLane)
        .set(patch)
        .where(
          and(eq(processLane.id, laneId), eq(processLane.orgId, ctx.orgId)),
        )
        .returning();
      return row;
    },
    { actionDetail: `Lane carrier updated (${laneId})` },
  );

  return Response.json({ data: updated });
});

// DELETE /api/v1/processes/:id/lanes/:laneId — eine verwaiste Lane entfernen.
//
// Nur für Lanes, die im aktuellen Diagramm nicht mehr vorkommen: der Weg,
// den `syncProcessLanes` bewusst offen lässt, statt eine Zeile mit Träger
// still zu löschen. Eine Lane, die im Diagramm steht, wird hier NICHT
// gelöscht — sie käme beim nächsten Speichern ohnehin zurück, und die
// Löschung hätte nur ihren Träger vernichtet.
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; laneId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, laneId } = await params;

  const [lane] = await db
    .select({
      id: processLane.id,
      bpmnElementId: processLane.bpmnElementId,
    })
    .from(processLane)
    .where(
      and(
        eq(processLane.id, laneId),
        eq(processLane.processId, id),
        eq(processLane.orgId, ctx.orgId),
      ),
    );
  if (!lane) {
    return Response.json({ error: "Lane not found" }, { status: 404 });
  }

  const [stillReferenced] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(processLane)
    .where(
      and(
        eq(processLane.orgId, ctx.orgId),
        eq(processLane.parentLaneId, laneId),
      ),
    );
  if (Number(stillReferenced?.n ?? 0) > 0) {
    return Response.json(
      { error: "Lane still has child lanes" },
      { status: 409 },
    );
  }

  await withAuditContext(
    ctx,
    async (tx) => {
      await tx
        .delete(processLane)
        .where(
          and(eq(processLane.id, laneId), eq(processLane.orgId, ctx.orgId)),
        );
    },
    { actionDetail: `Orphaned lane deleted (${lane.bpmnElementId})` },
  );

  return Response.json({ data: { id: laneId } });
});
