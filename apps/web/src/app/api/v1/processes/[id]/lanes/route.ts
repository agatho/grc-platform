// GET /api/v1/processes/:id/lanes — Lanes eines Prozesses samt Träger.
//
// [ARCTOS-FULL-2026-08-31 · OP-001] `process_lane` war bis hierher nur per SQL
// pflegbar. Diese Route ist die Leseseite der ersten Pflegemaske; geschrieben
// wird über `lanes/[laneId]` (PATCH).
//
// Die Antwort trägt drei Dinge, die die Maske sonst nicht wissen könnte:
//
//  1. **Aufgelöste Namen** statt blosser Kennungen — eine Maske, die
//     `vendor_id` als UUID zeigt, ist keine Pflegeoberfläche.
//  2. **`inDiagram`** — ob die Lane im aktuellen BPMN-Stand noch vorkommt.
//     `syncProcessLanes` löscht eine verschwundene Lane bewusst NICHT, wenn
//     sie einen Träger führt (der Träger ist ein Compliance-Befund, siehe
//     `_lib/sync-process-lanes.ts`). Ohne diese Kennzeichnung sähe eine
//     solche Zeile wie eine gültige Lane aus.
//  3. **Die Auswahllisten** für Rolle, Organisationseinheit und
//     Dienstleister. Bewusst hier und nicht über `/admin/roles`,
//     `/eam/org-units` und `/vendors`: die drei hängen an den Modulen `eam`
//     bzw. `tprm` und an Rollen, die ein `process_owner` nicht hat — die
//     Maske zeigte dann drei leere Auswahllisten und behauptete damit, es
//     gäbe keine Dienstleister.

import {
  db,
  process,
  processStep,
  processVersion,
  processLane,
  customRole,
  eamOrgUnit,
  vendor,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, asc, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { parseBpmnLanes } from "../../_lib/bpmn-lanes";

/**
 * Obergrenze der Dienstleisterliste. Wird sie erreicht, sagt die Antwort das
 * ausdrücklich (`vendorsTruncated`) — eine stillschweigend gekappte
 * Auswahlliste ist derselbe Defekt wie ein stiller Leerzustand (OP-050).
 */
const VENDOR_LIMIT = 200;

export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "process_owner",
    "risk_manager",
    "control_owner",
    "compliance_officer",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [proc] = await db
    .select({ id: process.id, name: process.name })
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

  const rows = await db
    .select({
      id: processLane.id,
      bpmnElementId: processLane.bpmnElementId,
      name: processLane.name,
      kind: processLane.kind,
      sequenceOrder: processLane.sequenceOrder,
      parentLaneId: processLane.parentLaneId,
      orgUnitId: processLane.orgUnitId,
      orgUnitName: eamOrgUnit.name,
      customRoleId: processLane.customRoleId,
      customRoleName: customRole.name,
      vendorId: processLane.vendorId,
      vendorName: vendor.name,
      isExternal: processLane.isExternal,
      thirdCountry: processLane.thirdCountry,
      updatedAt: processLane.updatedAt,
    })
    .from(processLane)
    .leftJoin(
      eamOrgUnit,
      and(
        eq(processLane.orgUnitId, eamOrgUnit.id),
        eq(eamOrgUnit.orgId, ctx.orgId),
      ),
    )
    .leftJoin(
      customRole,
      and(
        eq(processLane.customRoleId, customRole.id),
        eq(customRole.orgId, ctx.orgId),
      ),
    )
    .leftJoin(
      vendor,
      and(
        eq(processLane.vendorId, vendor.id),
        eq(vendor.orgId, ctx.orgId),
        isNull(vendor.deletedAt),
      ),
    )
    .where(and(eq(processLane.orgId, ctx.orgId), eq(processLane.processId, id)))
    .orderBy(asc(processLane.sequenceOrder), asc(processLane.bpmnElementId));

  // Wie viele Schritte hängen an jeder Lane? Die Zahl ist die Probe darauf,
  // ob die Zuordnung aus OP-002 tatsächlich angekommen ist.
  const counts = await db
    .select({
      laneStepId: processStep.laneStepId,
      n: sql<number>`count(*)::int`,
    })
    .from(processStep)
    .where(
      and(
        eq(processStep.processId, id),
        eq(processStep.orgId, ctx.orgId),
        isNull(processStep.deletedAt),
      ),
    )
    .groupBy(processStep.laneStepId);
  const stepCountByLane = new Map<string, number>(
    counts
      .filter((c): c is { laneStepId: string; n: number } =>
        Boolean(c.laneStepId),
      )
      .map((c) => [c.laneStepId, Number(c.n)]),
  );
  const unassignedSteps = Number(
    counts.find((c) => c.laneStepId === null)?.n ?? 0,
  );

  // Welche Lanes stehen noch im aktuellen BPMN-Stand?
  const [current] = await db
    .select({ bpmnXml: processVersion.bpmnXml })
    .from(processVersion)
    .where(
      and(eq(processVersion.processId, id), eq(processVersion.isCurrent, true)),
    )
    .orderBy(desc(processVersion.versionNumber))
    .limit(1);
  let inDiagram: Set<string> | null = null;
  if (current?.bpmnXml) {
    try {
      inDiagram = new Set(
        parseBpmnLanes(current.bpmnXml).lanes.map((l) => l.bpmnElementId),
      );
    } catch {
      // Unlesbares XML: dann wird nichts behauptet. `inDiagram: null` heisst
      // „unbekannt", nicht „nicht im Diagramm" — der Unterschied ist genau
      // der zwischen einem Hinweis und einer Falschaussage.
      inDiagram = null;
    }
  }

  const url = new URL(req.url);
  const vendorQuery = (url.searchParams.get("vendorQuery") ?? "").trim();

  const [roleOptions, orgUnitOptions, vendorRows] = await Promise.all([
    db
      .select({ id: customRole.id, name: customRole.name })
      .from(customRole)
      .where(eq(customRole.orgId, ctx.orgId))
      .orderBy(asc(customRole.name)),
    db
      .select({ id: eamOrgUnit.id, name: eamOrgUnit.name })
      .from(eamOrgUnit)
      .where(eq(eamOrgUnit.orgId, ctx.orgId))
      .orderBy(asc(eamOrgUnit.name)),
    db
      .select({ id: vendor.id, name: vendor.name })
      .from(vendor)
      .where(
        vendorQuery
          ? and(
              eq(vendor.orgId, ctx.orgId),
              isNull(vendor.deletedAt),
              ilike(vendor.name, `%${vendorQuery}%`),
            )
          : and(eq(vendor.orgId, ctx.orgId), isNull(vendor.deletedAt)),
      )
      .orderBy(asc(vendor.name))
      .limit(VENDOR_LIMIT + 1),
  ]);

  return Response.json({
    data: rows.map((r) => ({
      ...r,
      assignedStepCount: stepCountByLane.get(r.id) ?? 0,
      inDiagram: inDiagram === null ? null : inDiagram.has(r.bpmnElementId),
    })),
    meta: {
      processId: proc.id,
      processName: proc.name,
      unassignedSteps,
      diagramKnown: inDiagram !== null,
    },
    options: {
      roles: roleOptions,
      orgUnits: orgUnitOptions,
      vendors: vendorRows.slice(0, VENDOR_LIMIT),
      vendorsTruncated: vendorRows.length > VENDOR_LIMIT,
      vendorLimit: VENDOR_LIMIT,
    },
  });
});
