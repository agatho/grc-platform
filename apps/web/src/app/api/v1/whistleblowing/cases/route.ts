// GET /api/v1/whistleblowing/cases — List cases (HinSchG officers, paginated)
//
// #WAVE13-RBAC-02 / #WAVE19-W7: `whistleblowing_officer` was missing from
// every cases route's role gate, so the role couldn't read its own caseload
// (a P1 since HinSchG processing is the role's sole purpose). Wave-19 QA
// then flagged the inverse problem: `admin` was in the role list, but
// HinSchG §10/§11 + GDPR Art. 9(2)(b) require **case content isolation**
// from any role outside the designated reporting channel staff. Admin must
// NOT read case lists or case content — even for "platform oversight".
// The /statistics endpoint stays accessible to admin because it returns
// anonymized aggregate counts only (no case content), which is defensible
// for SLA monitoring. The role set on the six case-content endpoints is now:
// `whistleblowing_officer`, `ombudsperson` (no admin).

import { db, wbCase, wbReport, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { wbCaseListQuerySchema } from "@grc/shared";
import { eq, and, desc, count, isNull } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { problem, getRequestId } from "@/lib/api-errors";
import type { SQL } from "drizzle-orm";

export async function GET(req: Request) {
  // HinSchG isolation — admin deliberately excluded; see file header.
  const ctx = await withAuth("whistleblowing_officer", "ombudsperson");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule(
    "whistleblowing",
    ctx.orgId,
    req.method,
  );
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  // Build filters
  const conditions: SQL[] = [eq(wbCase.orgId, ctx.orgId)];

  const status = searchParams.get("status");
  if (status) {
    conditions.push(eq(wbCase.status, status as any));
  }

  const priority = searchParams.get("priority");
  if (priority) {
    conditions.push(eq(wbCase.priority, priority as any));
  }

  const where = and(...conditions);

  // Count total
  const [{ total }] = await db
    .select({ total: count() })
    .from(wbCase)
    .where(where);

  // Fetch cases with report category and assignee name
  const cases = await db
    .select({
      id: wbCase.id,
      caseNumber: wbCase.caseNumber,
      category: wbReport.category,
      status: wbCase.status,
      priority: wbCase.priority,
      submittedAt: wbReport.submittedAt,
      acknowledgeDeadline: wbCase.acknowledgeDeadline,
      responseDeadline: wbCase.responseDeadline,
      acknowledgedAt: wbCase.acknowledgedAt,
      assignedToName: user.name,
    })
    .from(wbCase)
    .innerJoin(wbReport, eq(wbCase.reportId, wbReport.id))
    .leftJoin(user, eq(wbCase.assignedTo, user.id))
    .where(where)
    .orderBy(desc(wbCase.createdAt))
    .limit(limit)
    .offset(offset);

  const data = cases.map((c) => ({
    id: c.id,
    caseNumber: c.caseNumber,
    category: c.category,
    status: c.status,
    priority: c.priority,
    submittedAt: c.submittedAt?.toISOString(),
    acknowledgeDeadline: c.acknowledgeDeadline?.toISOString(),
    responseDeadline: c.responseDeadline?.toISOString(),
    acknowledgedAt: c.acknowledgedAt?.toISOString() ?? null,
    assignedToName: c.assignedToName ?? null,
  }));

  return paginatedResponse(data, total, page, limit);
}

// #NIGHT-037: case creation runs through the anonymized intake pipeline
// (POST /whistleblowing/intake/submit) — never the authenticated cases
// list. Make the 405 explicit and point callers at the right endpoint.
export function POST(req: Request) {
  return problem.methodNotAllowed({
    requestId: getRequestId(req),
    instance: req.url,
    method: "POST",
    allow: ["GET"],
    detail:
      "Case creation goes through POST /api/v1/whistleblowing/intake/submit (anonymized intake). This endpoint is read-only for the ombudsperson role.",
  });
}
export const PUT = POST;
export const PATCH = POST;
export const DELETE = POST;
