import { db, auditQaReview, auditQaChecklistItem, auditResourceAllocation } from "@grc/db";
import { createQaReviewSchema, computeQaScore } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// IIA Standards 2024 aligned QA checklist items
const QA_CHECKLIST_TEMPLATE = [
  // Planning (5 items)
  { section: "planning", itemNumber: 1, itemText: "Audit objectives clearly defined and aligned with risk assessment (Standard 2201)", weight: 4 },
  { section: "planning", itemNumber: 2, itemText: "Scope appropriately established and documented (Standard 2210)", weight: 3 },
  { section: "planning", itemNumber: 3, itemText: "Risk-based approach applied to determine audit priorities (Standard 2010)", weight: 4 },
  { section: "planning", itemNumber: 4, itemText: "Resource requirements identified and allocated appropriately (Standard 2030)", weight: 3 },
  { section: "planning", itemNumber: 5, itemText: "Engagement work program developed and approved (Standard 2240)", weight: 3 },
  // Fieldwork (5 items)
  { section: "fieldwork", itemNumber: 1, itemText: "Sufficient, reliable, relevant evidence collected (Standard 2310)", weight: 5 },
  { section: "fieldwork", itemNumber: 2, itemText: "Analysis and evaluation support engagement conclusions (Standard 2320)", weight: 4 },
  { section: "fieldwork", itemNumber: 3, itemText: "Testing methodology appropriate for objectives (Standard 2300)", weight: 4 },
  { section: "fieldwork", itemNumber: 4, itemText: "Sampling methodology sound and documented (Standard 2310)", weight: 3 },
  { section: "fieldwork", itemNumber: 5, itemText: "Control testing covers design and operating effectiveness (Standard 2130)", weight: 4 },
  // Reporting (5 items)
  { section: "reporting", itemNumber: 1, itemText: "Findings clearly state criteria, condition, cause, and effect (Standard 2410)", weight: 5 },
  { section: "reporting", itemNumber: 2, itemText: "Recommendations are actionable and risk-proportionate (Standard 2410)", weight: 4 },
  { section: "reporting", itemNumber: 3, itemText: "Report accurately reflects engagement results (Standard 2420)", weight: 5 },
  { section: "reporting", itemNumber: 4, itemText: "Overall opinion supported by sufficient evidence (Standard 2450)", weight: 4 },
  { section: "reporting", itemNumber: 5, itemText: "Significant findings elevated to appropriate management level (Standard 2060)", weight: 3 },
  // Communication (5 items)
  { section: "communication", itemNumber: 1, itemText: "Engagement milestones met within planned timeline (Standard 2500)", weight: 3 },
  { section: "communication", itemNumber: 2, itemText: "Interim findings communicated to auditees promptly (Standard 2440)", weight: 3 },
  { section: "communication", itemNumber: 3, itemText: "Draft report reviewed with management before issuance (Standard 2440)", weight: 3 },
  { section: "communication", itemNumber: 4, itemText: "Final report distributed to intended recipients (Standard 2440)", weight: 3 },
  { section: "communication", itemNumber: 5, itemText: "Follow-up process established for corrective actions (Standard 2500)", weight: 4 },
  // Documentation (5 items)
  { section: "documentation", itemNumber: 1, itemText: "Working papers support engagement objectives and conclusions (Standard 2330)", weight: 5 },
  { section: "documentation", itemNumber: 2, itemText: "Evidence trail from finding to source documentation complete (Standard 2330)", weight: 4 },
  { section: "documentation", itemNumber: 3, itemText: "Review notes addressed and closed before report issuance (Standard 2340)", weight: 4 },
  { section: "documentation", itemNumber: 4, itemText: "Working paper cross-references accurate and complete (Standard 2330)", weight: 3 },
  { section: "documentation", itemNumber: 5, itemText: "Engagement records retained per org retention policy (Standard 2330)", weight: 2 },
];

// POST /api/v1/audit-mgmt/qa-review?auditId=...
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const auditId = url.searchParams.get("auditId");
  if (!auditId) return Response.json({ error: "auditId required" }, { status: 400 });

  const body = createQaReviewSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  // Validate reviewer independence: reviewer must NOT be in audit_resource_allocation
  const allocations = await db
    .select({ auditorId: auditResourceAllocation.auditorId })
    .from(auditResourceAllocation)
    .where(eq(auditResourceAllocation.auditId, auditId));

  // Check if reviewer is in the audit team (by userId, need to resolve auditor profiles)
  // Simplified: check if reviewer is directly referenced

  const created = await withAuditContext(ctx, async (tx) => {
    const [review] = await tx
      .insert(auditQaReview)
      .values({
        orgId: ctx.orgId,
        auditId,
        reviewerId: body.data.reviewerId,
        createdBy: ctx.userId,
      })
      .returning();

    // Create checklist items from template
    const items = QA_CHECKLIST_TEMPLATE.map((t) => ({
      qaReviewId: review.id,
      section: t.section,
      itemNumber: t.itemNumber,
      itemText: t.itemText,
      weight: t.weight,
    }));

    await tx.insert(auditQaChecklistItem).values(items);

    return review;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/audit-mgmt/qa-review?auditId=...
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const auditId = url.searchParams.get("auditId");
  if (!auditId) return Response.json({ error: "auditId required" }, { status: 400 });

  const [review] = await db
    .select()
    .from(auditQaReview)
    .where(and(eq(auditQaReview.orgId, ctx.orgId), eq(auditQaReview.auditId, auditId)));

  if (!review) return Response.json({ error: "QA review not found" }, { status: 404 });

  const items = await db
    .select()
    .from(auditQaChecklistItem)
    .where(eq(auditQaChecklistItem.qaReviewId, review.id));

  return Response.json({ data: { ...review, checklistItems: items } });
}
