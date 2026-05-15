import { db, contract, workItem, user, vendor } from "@grc/db";
import { createContractSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  count,
  desc,
  asc,
  ilike,
  inArray,
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
import { withErrorHandler } from "@/lib/api-wrapper";
import type { SQL } from "drizzle-orm";

// POST /api/v1/contracts — Create contract
export async function POST(req: Request) {
  // #WAVE19-MAR-P0-02: contract_manager + vendor_manager are the
  // operator roles that own contract lifecycles in TPRM.
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "process_owner",
    "contract_manager",
    "vendor_manager",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // #WAVE19-P3-01: detect deprecated field-name aliases (value, startDate,
  // endDate, name) before Zod normalises them away, so the response can
  // emit RFC-7234 Warning headers pointing callers at the canonical
  // names. Aliases stay accepted for v0.2 to give frontend consumers
  // a runway; the headers are the migration signal.
  const rawBody = (await req.json()) as Record<string, unknown>;
  const deprecatedAliases: Array<{ from: string; to: string }> = [];
  const ALIAS_MAP: Array<[string, string]> = [
    ["value", "totalValue"],
    ["startDate", "effectiveDate"],
    ["endDate", "expirationDate"],
    ["name", "title"],
  ];
  for (const [from, to] of ALIAS_MAP) {
    if (from in rawBody && !(to in rawBody)) {
      deprecatedAliases.push({ from, to });
    }
  }

  const body = createContractSchema.safeParse(rawBody);
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [wi] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: "contract",
        name: body.data.title,
        status: "draft",
        responsibleId: body.data.ownerId,
        grcPerspective: ["contract"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    const [row] = await tx
      .insert(contract)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        vendorId: body.data.vendorId,
        title: body.data.title,
        description: body.data.description,
        contractType: body.data.contractType,
        contractNumber: body.data.contractNumber,
        effectiveDate: body.data.effectiveDate,
        expirationDate: body.data.expirationDate,
        noticePeriodDays: body.data.noticePeriodDays,
        autoRenewal: body.data.autoRenewal,
        renewalPeriodMonths: body.data.renewalPeriodMonths,
        totalValue: body.data.totalValue,
        currency: body.data.currency,
        annualValue: body.data.annualValue,
        paymentTerms: body.data.paymentTerms,
        documentId: body.data.documentId,
        ownerId: body.data.ownerId,
        approverId: body.data.approverId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    return { ...row, elementId: wi.elementId };
  });

  // #WAVE19-P3-01: emit RFC-7234 Warning headers for each deprecated
  // alias the caller used. Frontend / integration code can grep
  // 299-status warnings in their HTTP middleware to spot pending
  // deprecations before the v0.3 hard-cutover.
  const headers = new Headers({ "content-type": "application/json" });
  for (const { from, to } of deprecatedAliases) {
    headers.append(
      "Warning",
      `299 - "Use '${to}' instead of '${from}', deprecated since v0.2.0 — alias removed in v0.3.0"`,
    );
  }
  return new Response(JSON.stringify({ data: created }), {
    status: 201,
    headers,
  });
}

// GET /api/v1/contracts — List contracts with filters
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(contract.orgId, ctx.orgId),
    isNull(contract.deletedAt),
  ];

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      | "draft"
      | "negotiation"
      | "pending_approval"
      | "active"
      | "renewal"
      | "expired"
      | "terminated"
      | "archived"
    >;
    conditions.push(inArray(contract.status, statuses));
  }

  const typeParam = searchParams.get("contractType");
  if (typeParam) {
    const types = typeParam.split(",") as Array<
      | "master_agreement"
      | "service_agreement"
      | "nda"
      | "dpa"
      | "sla"
      | "license"
      | "maintenance"
      | "consulting"
      | "other"
    >;
    conditions.push(inArray(contract.contractType, types));
  }

  const vendorIdParam = searchParams.get("vendorId");
  if (vendorIdParam) {
    conditions.push(eq(contract.vendorId, vendorIdParam));
  }

  const expiringDaysParam = searchParams.get("expiringWithinDays");
  if (expiringDaysParam) {
    const days = parseInt(expiringDaysParam, 10);
    if (!isNaN(days)) {
      conditions.push(
        sql`${contract.expirationDate}::date <= CURRENT_DATE + interval '${sql.raw(String(days))} days'`,
      );
      conditions.push(sql`${contract.expirationDate}::date >= CURRENT_DATE`);
    }
  }

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(contract.title, pattern),
        ilike(contract.description, pattern),
        ilike(contract.contractNumber, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const sortParam = searchParams.get("sort");
  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  let orderBy;
  switch (sortParam) {
    case "title":
      orderBy = sortDir(contract.title);
      break;
    case "status":
      orderBy = sortDir(contract.status);
      break;
    case "expirationDate":
      orderBy = sortDir(contract.expirationDate);
      break;
    case "annualValue":
      orderBy = sortDir(contract.annualValue);
      break;
    default:
      orderBy = desc(contract.createdAt);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: contract.id,
        orgId: contract.orgId,
        workItemId: contract.workItemId,
        elementId: workItem.elementId,
        vendorId: contract.vendorId,
        vendorName: vendor.name,
        title: contract.title,
        description: contract.description,
        contractType: contract.contractType,
        status: contract.status,
        contractNumber: contract.contractNumber,
        effectiveDate: contract.effectiveDate,
        expirationDate: contract.expirationDate,
        noticePeriodDays: contract.noticePeriodDays,
        autoRenewal: contract.autoRenewal,
        totalValue: contract.totalValue,
        currency: contract.currency,
        annualValue: contract.annualValue,
        ownerId: contract.ownerId,
        ownerName: user.name,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
      })
      .from(contract)
      .leftJoin(workItem, eq(contract.workItemId, workItem.id))
      .leftJoin(vendor, eq(contract.vendorId, vendor.id))
      .leftJoin(user, eq(contract.ownerId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(contract).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
