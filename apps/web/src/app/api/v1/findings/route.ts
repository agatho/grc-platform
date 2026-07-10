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
import { emitEntityCreated } from "@/lib/entity-events";
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

  // Webhook fan-out (best-effort, after commit — never fails the request)
  emitEntityCreated({
    orgId: ctx.orgId,
    entityType: "finding",
    entityId: created.id,
    userId: ctx.userId,
    data: created,
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

  // #WAVE24-B2: pre-validate enum filters before pushing into the
  // WHERE-clause. Wave-23 cast-trick blew up the PG enum coercion when
  // callers passed bogus values like `?status=open` (5xx with RequestID
  // 81d9101ffa46f648). Now any non-enum value returns 422 with a
  // structured body listing the legal options.
  const FINDING_STATUS_VALUES = [
    "identified",
    "in_remediation",
    "remediated",
    "verified",
    "accepted",
    "closed",
  ] as const;
  const FINDING_SEVERITY_VALUES = [
    "positive",
    "conforming",
    "opportunity_for_improvement",
    "minor_nonconformity",
    "major_nonconformity",
    "observation",
    "recommendation",
    "improvement_requirement",
    "insignificant_nonconformity",
    "significant_nonconformity",
  ] as const;
  const FINDING_SOURCE_VALUES = [
    "control_test",
    "audit",
    "incident",
    "self_assessment",
    "external",
  ] as const;

  const validateEnumParam = <T extends readonly string[]>(
    paramName: string,
    raw: string | null,
    allowed: T,
  ): { values: T[number][]; error: Response | null } => {
    if (!raw) return { values: [], error: null };
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const invalid = parts.filter(
      (v) => !(allowed as readonly string[]).includes(v),
    );
    if (invalid.length > 0) {
      return {
        values: [],
        error: Response.json(
          {
            error: "Validation failed",
            detail: `Invalid value(s) for '${paramName}': ${invalid.join(", ")}. Allowed: ${allowed.join(", ")}.`,
            invalidParam: paramName,
            invalidValues: invalid,
            allowed,
          },
          { status: 422 },
        ),
      };
    }
    return { values: parts as T[number][], error: null };
  };

  // Status filter
  const statusCheck = validateEnumParam(
    "status",
    searchParams.get("status"),
    FINDING_STATUS_VALUES,
  );
  if (statusCheck.error) return statusCheck.error;
  if (statusCheck.values.length > 0) {
    conditions.push(inArray(finding.status, statusCheck.values));
  }

  // Severity filter
  const severityCheck = validateEnumParam(
    "severity",
    searchParams.get("severity"),
    FINDING_SEVERITY_VALUES,
  );
  if (severityCheck.error) return severityCheck.error;
  if (severityCheck.values.length > 0) {
    conditions.push(inArray(finding.severity, severityCheck.values));
  }

  // Source filter
  const sourceCheck = validateEnumParam(
    "source",
    searchParams.get("source"),
    FINDING_SOURCE_VALUES,
  );
  if (sourceCheck.error) return sourceCheck.error;
  if (sourceCheck.values.length > 0) {
    conditions.push(inArray(finding.source, sourceCheck.values));
  }

  // #WAVE25-B1: UUID-typed filters were pushed into the WHERE clause
  // without validation. Postgres then rejected the parameter cast on
  // any non-UUID value (e.g. `?controlId=not-a-uuid`), bubbling up as
  // a 500. Same as the W24-B2 fix but for UUID-typed FK filters
  // instead of enum-typed status filters. Invalid value → 422 with a
  // structured body naming the rejected param. Empty string is treated
  // the same as a missing filter so callers can no-op cleanly.
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validateUuidParam = (
    paramName: string,
    raw: string | null,
  ): { value: string | null; error: Response | null } => {
    if (!raw || raw.trim() === "") return { value: null, error: null };
    if (!UUID_RE.test(raw)) {
      return {
        value: null,
        error: Response.json(
          {
            error: "Validation failed",
            detail: `Invalid UUID for '${paramName}': ${raw}`,
            invalidParam: paramName,
          },
          { status: 422 },
        ),
      };
    }
    return { value: raw, error: null };
  };

  // Control filter
  const controlCheck = validateUuidParam(
    "controlId",
    searchParams.get("controlId"),
  );
  if (controlCheck.error) return controlCheck.error;
  if (controlCheck.value) {
    conditions.push(eq(finding.controlId, controlCheck.value));
  }

  // Audit filter -- scope findings to a single audit execution
  const auditCheck = validateUuidParam("auditId", searchParams.get("auditId"));
  if (auditCheck.error) return auditCheck.error;
  if (auditCheck.value) {
    conditions.push(eq(finding.auditId, auditCheck.value));
  }

  // Risk filter -- list findings linked to a risk (Audit-ERM feedback loop)
  const riskCheck = validateUuidParam("riskId", searchParams.get("riskId"));
  if (riskCheck.error) return riskCheck.error;
  if (riskCheck.value) {
    conditions.push(eq(finding.riskId, riskCheck.value));
  }

  // Owner filter
  const ownerCheck = validateUuidParam("ownerId", searchParams.get("ownerId"));
  if (ownerCheck.error) return ownerCheck.error;
  if (ownerCheck.value) {
    conditions.push(eq(finding.ownerId, ownerCheck.value));
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
