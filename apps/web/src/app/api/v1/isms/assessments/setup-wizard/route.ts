// POST /api/v1/isms/assessments/setup-wizard
//
// Sprint 1.1 Endpoint fuer das 3-Step-Setup-Wizard-UI. Bindet die
// state-machine-Pre-Conditions an und speichert den initialen Run.
//
// Semantik:
//   - Legt einen `assessment_run` mit status='planning' an
//   - Berechnet sofort die Gate-G1-Checklist (fuer UI-Feedback)
//   - Speichert `framework` als comma-separated string wenn mehrere
//     Frameworks gewaehlt wurden (DB-Feld ist varchar(100))
//   - Gibt den erzeugten Run + Checklist + hint-naechster-Schritt zurueck

import { db, assessmentRun } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  assessmentSetupWizardSchema,
  buildSetupChecklist,
  type AssessmentSnapshot,
} from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = assessmentSetupWizardSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }
  const data = parsed.data;

  // Frameworks als comma-separated speichern. Beim spaeteren
  // Read-Path kann der Client wieder splitten. DB-Spalte bleibt
  // varchar(100) -- wir limitieren Liste auf 10 Eintraege in Zod.
  const frameworkStr = data.frameworks.join(",");
  if (frameworkStr.length > 100) {
    return Response.json(
      {
        error: "Frameworks list too long",
        hint: "Die Summe der Framework-Codes darf 100 Zeichen nicht ueberschreiten. Verwende Kurz-Codes (iso27001, nist_csf, etc.).",
      },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(assessmentRun)
      .values({
        orgId: ctx.orgId,
        name: data.name,
        description: data.description,
        scopeType: data.scopeType,
        scopeFilter: data.scopeFilter ?? null,
        framework: frameworkStr,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        leadAssessorId: data.leadAssessorId,
        status: "planning",
        completionPercentage: 0,
        totalEvaluations: 0,
        completedEvaluations: 0,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  // Sofort Gate-G1-Checklist berechnen, damit die UI dem User
  // zeigen kann, was noch fehlt (z. B. wenn description < 200 chars)
  const snapshot: AssessmentSnapshot = {
    status: result.status,
    completionPercentage: result.completionPercentage,
    name: result.name,
    description: result.description,
    scopeType: result.scopeType,
    scopeFilter: result.scopeFilter as Record<string, unknown> | null,
    framework: result.framework,
    periodStart: result.periodStart,
    periodEnd: result.periodEnd,
    leadAssessorId: result.leadAssessorId,
    totalEvaluations: result.totalEvaluations,
    completedEvaluations: result.completedEvaluations,
  };

  return Response.json(
    {
      data: result,
      setupChecklist: buildSetupChecklist(snapshot),
      frameworks: data.frameworks,
      nextSteps: [
        {
          step: "initialize-soa",
          label: "Statement of Applicability aus gewaehlten Frameworks aufbauen",
          endpoint: `/api/v1/isms/assessments/${result.id}/initialize-soa`,
          ready: snapshot.description !== null && snapshot.description.length >= 200,
        },
      ],
    },
    { status: 201 },
  );
}
