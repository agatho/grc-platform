import {
  db,
  finding,
  workItem,
  user,
  userOrganizationRole,
  notification,
} from "@grc/db";
import { createFindingSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  count,
  desc,
  asc,
  inArray,
  ilike,
  or,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import type { SQL } from "drizzle-orm";

// #WAVE23-A1: Sentinel-Error-Class für Post-Insert-FK-Mismatch. Wave 22
// festgestellt: POST /findings lieferte 201 aber FKs persistierten als
// null. Statt das still durchgehen zu lassen, verifizieren wir die
// Returning-Row gegen den Input und werfen — die Transaction rollt zurück
// (kein halbkaputtes Finding bleibt liegen) und der withErrorHandler
// emittiert eine 500 mit strukturiertem Body, der die genauen
// `mismatches` enthält. Stille Datenverlust-201er werden damit unmöglich.
export class FindingFkMismatchError extends Error {
  public readonly mismatches: Array<{
    field: string;
    expected: unknown;
    actual: unknown;
  }>;
  constructor(
    mismatches: Array<{ field: string; expected: unknown; actual: unknown }>,
  ) {
    super(
      `Finding insert returned mismatched FK values: ${mismatches
        .map(
          (m) =>
            `${m.field}: expected=${String(m.expected)} actual=${String(m.actual)}`,
        )
        .join(", ")}`,
    );
    this.name = "FindingFkMismatchError";
    this.mismatches = mismatches;
  }
}

// POST /api/v1/findings — Create finding
//
// #WAVE23-A1: gewrappt in withErrorHandler so any uncaught Drizzle/PG
// exception lands as RFC-7807 problem+json mit RequestID, statt empty
// 500-Body. Vorher (Wave 22): bare `export async function POST` →
// uncaught exceptions wurden zu Next.js' Default-Empty-500-Response,
// was die Cowork-QA-Reproduzierbarkeit von A1 verzögerte.
export const POST = withErrorHandler(async function POST(req: Request) {
  // Findings can be raised by any 1st-line operator that runs the
  // process whose control failed, plus 2nd-line and 3rd-line. Adding
  // process_owner closes the gap the parametric RBAC suite flagged.
  //
  // #WAVE19-P3-02: ciso added — 2nd-LoD CISO must be able to
  // document compliance violations as findings (Wave-18 QA flagged
  // this as an RBAC consistency gap).
  const ctx = await withAuth(
    "admin",
    "auditor",
    "risk_manager",
    "control_owner",
    "process_owner",
    "ciso",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // #WAVE19-P1-01: surface common client mistakes as 422 instead of
  // silently dropping. Wave-18 QA sent `{status:'open'}` and got back
  // `status:'identified'` — Zod stripped the unknown key and the DB
  // default kicked in. Strict-reject teaches callers the canonical
  // shape and the dedicated transition endpoint.
  const rawBody = (await req.json()) as Record<string, unknown>;
  if ("status" in rawBody) {
    return Response.json(
      {
        error:
          "Finding status is set automatically on create (defaults to 'identified'). Use POST /api/v1/findings/{id}/status for transitions.",
        rejectedFields: ["status"],
      },
      { status: 422 },
    );
  }

  const body = createFindingSchema.safeParse(rawBody);
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate owner is in same org
  if (body.data.ownerId) {
    const [ownerRole] = await db
      .select({ id: userOrganizationRole.userId })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, body.data.ownerId),
          eq(userOrganizationRole.orgId, ctx.orgId),
          isNull(userOrganizationRole.deletedAt),
        ),
      );
    if (!ownerRole) {
      return Response.json(
        { error: "Owner not found in this organization" },
        { status: 422 },
      );
    }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    // Create work item for the finding
    const [wi] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: "finding",
        name: body.data.title,
        status: "draft",
        responsibleId: body.data.ownerId,
        grcPerspective: ["ics"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Create the finding.
    //
    // #WAVE14D-P1-01: Wave-14 QA found that POST /findings {auditId}
    // returned 201 but persisted auditId=NULL. The createFindingSchema
    // already accepted auditId (packages/shared/.../control.ts line 255)
    // and the finding table already had the column (control.ts:333),
    // but this insert handler dropped it on the floor — silently
    // breaking the audit→finding cross-module link. Now passed through.
    const [row] = await tx
      .insert(finding)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        title: body.data.title,
        description: body.data.description,
        severity: body.data.severity,
        source: body.data.source,
        controlId: body.data.controlId,
        controlTestId: body.data.controlTestId,
        riskId: body.data.riskId,
        auditId: body.data.auditId,
        ownerId: body.data.ownerId,
        remediationPlan: body.data.remediationPlan,
        remediationDueDate: body.data.remediationDueDate,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // #WAVE23-A1: Post-Insert-FK-Verifikation. Wave 22 verifizierte
    // 4× hintereinander, dass POST /findings 201 lieferte aber die FKs
    // als null persistierten — `body.data.controlId` ging rein, `row.controlId`
    // kam null raus. Im Repo ist der Code korrekt, also ist die
    // Drift entweder im Deploy (alter Build), im Trigger (BEFORE INSERT
    // setzt FK auf null) oder in der Drizzle-Inferenz (camel→snake
    // misst die Spalte nicht). Diese Verifikation macht die Failure-
    // Klasse beobachtbar: wenn ein FK gesendet wurde aber als null
    // zurückkommt, werfen wir eine strukturierte Exception, die der
    // withErrorHandler auf 500 mit Diagnostic-Body mappt. Stille
    // 201er werden damit unmöglich.
    const fkMismatches: Array<{
      field: string;
      expected: unknown;
      actual: unknown;
    }> = [];
    const fkPairs: Array<[keyof typeof body.data, keyof typeof row]> = [
      ["controlId", "controlId"],
      ["controlTestId", "controlTestId"],
      ["riskId", "riskId"],
      ["auditId", "auditId"],
    ];
    for (const [inputKey, rowKey] of fkPairs) {
      const expected = body.data[inputKey];
      const actual = (row as Record<string, unknown>)[rowKey as string];
      if (expected != null && actual !== expected) {
        fkMismatches.push({ field: inputKey, expected, actual });
      }
    }
    if (fkMismatches.length > 0) {
      throw new FindingFkMismatchError(fkMismatches);
    }

    // Notify owner
    if (body.data.ownerId && body.data.ownerId !== ctx.userId) {
      await tx.insert(notification).values({
        userId: body.data.ownerId,
        orgId: ctx.orgId,
        type: "task_assigned",
        entityType: "finding",
        entityId: row.id,
        title: `Finding assigned to you: ${body.data.title}`,
        message: body.data.description ?? null,
        channel: "both",
        templateKey: "finding_owner_assigned",
        templateData: {
          findingId: row.id,
          findingTitle: body.data.title,
          assignedBy: ctx.userId,
        },
        createdBy: ctx.userId,
      });
    }

    return { ...row, elementId: wi.elementId };
  });

  return Response.json({ data: created }, { status: 201 });
});

// GET /api/v1/findings — List findings with filters
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(finding.orgId, ctx.orgId),
    isNull(finding.deletedAt),
  ];

  // Status filter
  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      | "identified"
      | "in_remediation"
      | "remediated"
      | "verified"
      | "accepted"
      | "closed"
    >;
    conditions.push(inArray(finding.status, statuses));
  }

  // Severity filter
  const severityParam = searchParams.get("severity");
  if (severityParam) {
    const severities = severityParam.split(",") as Array<
      | "observation"
      | "recommendation"
      | "improvement_requirement"
      | "insignificant_nonconformity"
      | "significant_nonconformity"
    >;
    conditions.push(inArray(finding.severity, severities));
  }

  // Source filter
  const sourceParam = searchParams.get("source");
  if (sourceParam) {
    const sources = sourceParam.split(",") as Array<
      "control_test" | "audit" | "incident" | "self_assessment" | "external"
    >;
    conditions.push(inArray(finding.source, sources));
  }

  // Control filter
  const controlId = searchParams.get("controlId");
  if (controlId) {
    conditions.push(eq(finding.controlId, controlId));
  }

  // Audit filter -- scope findings to a single audit execution
  const auditId = searchParams.get("auditId");
  if (auditId) {
    conditions.push(eq(finding.auditId, auditId));
  }

  // Risk filter -- list findings linked to a risk (Audit-ERM feedback loop)
  const riskId = searchParams.get("riskId");
  if (riskId) {
    conditions.push(eq(finding.riskId, riskId));
  }

  // Owner filter
  const ownerId = searchParams.get("ownerId");
  if (ownerId) {
    conditions.push(eq(finding.ownerId, ownerId));
  }

  // Search
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(finding.title, pattern), ilike(finding.description, pattern))!,
    );
  }

  const where = and(...conditions);

  const sortParam = searchParams.get("sort");
  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  let orderBy;
  switch (sortParam) {
    case "title":
      orderBy = sortDir(finding.title);
      break;
    case "status":
      orderBy = sortDir(finding.status);
      break;
    case "severity":
      orderBy = sortDir(finding.severity);
      break;
    case "createdAt":
      orderBy = sortDir(finding.createdAt);
      break;
    default:
      orderBy = desc(finding.updatedAt);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: finding.id,
        orgId: finding.orgId,
        workItemId: finding.workItemId,
        elementId: workItem.elementId,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        status: finding.status,
        source: finding.source,
        controlId: finding.controlId,
        controlTestId: finding.controlTestId,
        riskId: finding.riskId,
        // #WAVE16-P1-B: Wave-15 QA verified POST persists auditId but
        // GET dropped it from the projection — looked like a silent
        // link-loss until you queried with ?auditId=X. Now included
        // so the cross-module link is visible end-to-end.
        auditId: finding.auditId,
        ownerId: finding.ownerId,
        ownerName: user.name,
        ownerEmail: user.email,
        remediationPlan: finding.remediationPlan,
        remediationDueDate: finding.remediationDueDate,
        remediatedAt: finding.remediatedAt,
        verifiedAt: finding.verifiedAt,
        createdAt: finding.createdAt,
        updatedAt: finding.updatedAt,
      })
      .from(finding)
      .leftJoin(workItem, eq(finding.workItemId, workItem.id))
      .leftJoin(user, eq(finding.ownerId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(finding).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
