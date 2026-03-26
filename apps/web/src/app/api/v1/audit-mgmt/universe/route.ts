import {
  db,
  auditUniverseEntry,
} from "@grc/db";
import { createAuditUniverseEntrySchema } from "@grc/shared";
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
  sql,
  lte,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/audit-mgmt/universe — Create universe entry
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createAuditUniverseEntrySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(auditUniverseEntry)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        entityType: body.data.entityType,
        entityId: body.data.entityId,
        riskScore: body.data.riskScore,
        lastAuditDate: body.data.lastAuditDate,
        auditCycleMonths: body.data.auditCycleMonths,
        nextAuditDue: body.data.nextAuditDue,
        priority: body.data.priority,
        notes: body.data.notes,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/audit-mgmt/universe — List universe entries with gap detection
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(auditUniverseEntry.orgId, ctx.orgId),
    isNull(auditUniverseEntry.deletedAt),
  ];

  // Entity type filter
  const entityType = searchParams.get("entityType");
  if (entityType) {
    const types = entityType.split(",") as Array<
      "process" | "department" | "it_system" | "vendor" | "custom"
    >;
    conditions.push(inArray(auditUniverseEntry.entityType, types));
  }

  // Search
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(auditUniverseEntry.name, pattern),
        ilike(auditUniverseEntry.notes, pattern),
      )!,
    );
  }

  // Gap filter: overdue or never-audited
  const gapFilter = searchParams.get("gap");
  const today = new Date().toISOString().split("T")[0];
  if (gapFilter === "never_audited") {
    conditions.push(isNull(auditUniverseEntry.lastAuditDate));
  } else if (gapFilter === "overdue") {
    conditions.push(lte(auditUniverseEntry.nextAuditDue, today));
  }

  const where = and(...conditions);

  const sortParam = searchParams.get("sort");
  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  let orderBy;
  switch (sortParam) {
    case "name":
      orderBy = sortDir(auditUniverseEntry.name);
      break;
    case "riskScore":
      orderBy = sortDir(auditUniverseEntry.riskScore);
      break;
    case "nextAuditDue":
      orderBy = sortDir(auditUniverseEntry.nextAuditDue);
      break;
    default:
      orderBy = desc(auditUniverseEntry.riskScore);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(auditUniverseEntry)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(auditUniverseEntry).where(where),
  ]);

  // Compute gap stats
  const allConditions: SQL[] = [
    eq(auditUniverseEntry.orgId, ctx.orgId),
    isNull(auditUniverseEntry.deletedAt),
  ];
  const allWhere = and(...allConditions);

  const [neverAuditedResult] = await db
    .select({ value: count() })
    .from(auditUniverseEntry)
    .where(and(allWhere, isNull(auditUniverseEntry.lastAuditDate)));

  const [overdueResult] = await db
    .select({ value: count() })
    .from(auditUniverseEntry)
    .where(
      and(
        allWhere,
        lte(auditUniverseEntry.nextAuditDue, today),
      ),
    );

  return Response.json({
    data: items,
    gaps: {
      neverAudited: neverAuditedResult.value,
      overdue: overdueResult.value,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
