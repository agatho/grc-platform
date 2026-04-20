// POST /api/v1/isms/assessments/[id]/generate-evaluations
//
// Sprint 1.4: Bulk-Generation von assessment_control_eval aus SoA-
// Eintraegen. Pro soa_entry mit applicability='applicable' wird ein
// control_eval-Stub erzeugt (result='not_evaluated').
//
// Option: nur fuer bestimmte controlIds (partial run fuer Nach-
// Erfassung).
//
// Dedup: pro (run, controlId, assetId) UNIQUE -- bestehende Evals
// werden nicht ueberschrieben.

import {
  db,
  assessmentRun,
  assessmentControlEval,
  soaEntry,
  control,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, inArray, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  /** Einschraenkung auf bestimmte controlIds */
  controlIds: z.array(z.string().uuid()).optional(),
  /** Nur Controls mit applicability='applicable' einbeziehen (default true) */
  applicableOnly: z.boolean().default(true),
});

const MAX_EVALS_PER_CALL = 5_000;

export async function POST(req: Request, { params }: RouteParams) {
  const { id: runId } = await params;

  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Body (tolerant)
  let bodyData: z.infer<typeof bodySchema>;
  try {
    const raw = await req.text();
    const parsed = bodySchema.safeParse(
      raw && raw.trim().length > 0 ? JSON.parse(raw) : {},
    );
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 },
      );
    }
    bodyData = parsed.data;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Run validieren
  const [run] = await db
    .select()
    .from(assessmentRun)
    .where(
      and(eq(assessmentRun.id, runId), eq(assessmentRun.orgId, ctx.orgId)),
    );
  if (!run) {
    return Response.json(
      { error: "Assessment run not found" },
      { status: 404 },
    );
  }
  if (run.status !== "in_progress" && run.status !== "planning") {
    return Response.json(
      {
        error: `Run status '${run.status}' -- Generate-Evaluations nur fuer planning/in_progress`,
      },
      { status: 422 },
    );
  }

  // SoA-basierte Controls finden: jedes soa_entry, das einen controlId
  // hat (applicability via soaEntry.applicability). Wenn kein controlId
  // verknuepft, wird der Eintrag uebersprungen (noch nicht auf konkrete
  // Org-Control gemappt).

  const soaConditions = [
    eq(soaEntry.orgId, ctx.orgId),
    sql`${soaEntry.controlId} IS NOT NULL`,
  ];
  if (bodyData.applicableOnly) {
    soaConditions.push(eq(soaEntry.applicability, "applicable"));
  }

  const soaControls = await db
    .select({ controlId: soaEntry.controlId })
    .from(soaEntry)
    .where(and(...soaConditions));

  let controlIds = soaControls
    .map((s) => s.controlId)
    .filter((id): id is string => id !== null);

  // Wenn User explicit controlIds waehlt, darueber filtern
  if (bodyData.controlIds && bodyData.controlIds.length > 0) {
    const set = new Set(bodyData.controlIds);
    controlIds = controlIds.filter((id) => set.has(id));
  }

  // Deduplizieren
  controlIds = Array.from(new Set(controlIds));

  if (controlIds.length === 0) {
    // Fallback: alle Controls der Org wenn SoA noch kein controlId
    // gemappt hat
    const orgControls = await db
      .select({ id: control.id })
      .from(control)
      .where(eq(control.orgId, ctx.orgId));
    controlIds = orgControls.map((c) => c.id);
    if (bodyData.controlIds && bodyData.controlIds.length > 0) {
      const set = new Set(bodyData.controlIds);
      controlIds = controlIds.filter((id) => set.has(id));
    }
    if (controlIds.length === 0) {
      return Response.json(
        {
          error: "No controls available",
          hint: "Lege zuerst Controls an und/oder mappe SoA-Entries auf Controls.",
        },
        { status: 400 },
      );
    }
  }

  if (controlIds.length > MAX_EVALS_PER_CALL) {
    return Response.json(
      {
        error: `Too many controls (${controlIds.length}). Max ${MAX_EVALS_PER_CALL}.`,
        hint: "Engere Filter via controlIds.",
      },
      { status: 413 },
    );
  }

  // Existierende control-Evals im Run laden
  const existing = await db
    .select({ controlId: assessmentControlEval.controlId })
    .from(assessmentControlEval)
    .where(
      and(
        eq(assessmentControlEval.assessmentRunId, runId),
        eq(assessmentControlEval.orgId, ctx.orgId),
        inArray(assessmentControlEval.controlId, controlIds),
      ),
    );
  const existingSet = new Set(existing.map((e) => e.controlId));

  const toInsert = controlIds.filter((id) => !existingSet.has(id));

  let created = 0;
  if (toInsert.length > 0) {
    await withAuditContext(ctx, async (tx) => {
      const CHUNK = 100;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        await tx.insert(assessmentControlEval).values(
          chunk.map((controlId) => ({
            orgId: ctx.orgId,
            assessmentRunId: runId,
            controlId,
            result: "not_evaluated" as const,
          })),
        );
        created += chunk.length;
      }
    });
  }

  // Run-Stats aktualisieren: totalEvaluations hochzaehlen
  if (created > 0) {
    await withAuditContext(ctx, async (tx) => {
      await tx
        .update(assessmentRun)
        .set({
          totalEvaluations: sql`${assessmentRun.totalEvaluations} + ${created}`,
          updatedAt: new Date(),
        })
        .where(
          and(eq(assessmentRun.id, runId), eq(assessmentRun.orgId, ctx.orgId)),
        );
    });
  }

  return Response.json({
    data: {
      assessmentRunId: runId,
      totalControls: controlIds.length,
      created,
      skipped: controlIds.length - toInsert.length,
    },
  });
}
