// GET /api/v1/whistleblowing/cases — List cases (ombudsperson only, paginated)

import { db, wbCase, wbReport, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { wbCaseListQuerySchema } from "@grc/shared";
import { eq, and, desc, count, isNull } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "ombudsperson");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("whistleblowing", ctx.orgId, req.method);
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
