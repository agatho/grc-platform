import {
  db,
  finding,
  workItem,
  auditChecklistItem,
  auditChecklist,
  audit,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { checklistResultToFindingSeverity } from "@grc/shared";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/audit-mgmt/audits/[id]/bulk-create-findings
//
// Legt für jedes NC-Item ohne verknüpftes Finding automatisch ein Finding
// an. Severity wird aus result gemappt (checklistResultToFindingSeverity),
// Title aus criterionReference + Frage-Kurzform, Description aus Notes +
// Korrekturmaßnahmen-Vorschlag.
//
// Extrem zeitsparend, wenn ein Auditor am Ende der Field-Work-Phase
// 20 NC-Items in einem Rutsch zu Findings weiterleiten will, statt jedes
// einzeln über den create-finding-Dialog zu klicken.
//
// Der „ncWithoutFinding"-Count aus closure-readiness fällt danach auf 0.
//
// Duplicate-Prevention: existiert bereits ein Finding für das Audit mit
// exakt gleichem Title, wird ein NEUES Finding übersprungen (Item wird
// dennoch als „processed" gezählt).
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // 1. Audit + NC-Items holen
  const [auditRow] = await db
    .select({ id: audit.id })
    .from(audit)
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );
  if (!auditRow) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  const ncItems = await db
    .select({
      id: auditChecklistItem.id,
      question: auditChecklistItem.question,
      result: auditChecklistItem.result,
      notes: auditChecklistItem.notes,
      criterionReference: auditChecklistItem.criterionReference,
      correctiveActionSuggestion: auditChecklistItem.correctiveActionSuggestion,
      remediationDeadline: auditChecklistItem.remediationDeadline,
      controlId: auditChecklistItem.controlId,
    })
    .from(auditChecklistItem)
    .leftJoin(
      auditChecklist,
      eq(auditChecklistItem.checklistId, auditChecklist.id),
    )
    .where(
      and(
        eq(auditChecklist.auditId, id),
        eq(auditChecklistItem.orgId, ctx.orgId),
        inArray(auditChecklistItem.result, [
          "major_nonconformity",
          "minor_nonconformity",
          "nonconforming",
        ]),
      ),
    );

  if (ncItems.length === 0) {
    return Response.json({
      data: { created: 0, skipped: 0, total: 0 },
    });
  }

  // 2. Existierende Finding-Titles für dieses Audit — Duplicate-Prevention
  const existingFindings = await db
    .select({ title: finding.title })
    .from(finding)
    .where(
      and(
        eq(finding.auditId, id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    );
  const existingTitles = new Set(
    existingFindings.map((f) => f.title.toLowerCase()),
  );

  // 3. Bulk-Insert
  let created = 0;
  let skipped = 0;

  await withAuditContext(ctx, async (tx) => {
    for (const item of ncItems) {
      const severity =
        checklistResultToFindingSeverity(item.result) ?? "minor_nonconformity";
      const title = (
        item.criterionReference
          ? `${item.criterionReference} — ${item.question.slice(0, 120)}`
          : item.question.slice(0, 160)
      ).trim();

      // Duplicate?
      if (existingTitles.has(title.toLowerCase())) {
        skipped++;
        continue;
      }
      existingTitles.add(title.toLowerCase());

      const description = [
        item.notes ?? "",
        item.correctiveActionSuggestion
          ? `\nVorschlag Korrekturmaßnahme:\n${item.correctiveActionSuggestion}`
          : "",
      ]
        .join("")
        .trim() || undefined;

      // Work-Item anlegen (Pattern wie im create-finding-Endpoint)
      const [wi] = await tx
        .insert(workItem)
        .values({
          orgId: ctx.orgId,
          typeKey: "finding",
          name: title,
          status: "draft",
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning();

      await tx.insert(finding).values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        auditId: id,
        controlId: item.controlId,
        title,
        description,
        severity: severity as
          | "major_nonconformity"
          | "minor_nonconformity"
          | "opportunity_for_improvement"
          | "observation"
          | "recommendation"
          | "positive"
          | "conforming",
        status: "identified",
        remediationDueDate: item.remediationDeadline ?? undefined,
        remediationPlan: item.correctiveActionSuggestion ?? undefined,
      });

      created++;
    }

    // Audit finding_count nachziehen
    if (created > 0) {
      await tx
        .update(audit)
        .set({
          findingCount: sql`${audit.findingCount} + ${created}`,
        })
        .where(eq(audit.id, id));
    }
  });

  return Response.json({
    data: {
      created,
      skipped,
      total: ncItems.length,
    },
  });
}
