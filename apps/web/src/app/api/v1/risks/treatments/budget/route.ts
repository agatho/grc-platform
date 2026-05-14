// GET /api/v1/risks/treatments/budget?groupBy=owner|department|org&status=planned,in_progress
//
// #WAVE18-P1-2: Cowork QA's Wave-17 dataflow tests reported "no
// budget aggregation endpoint exists" for treatment costs. Required
// for the CISO quarterly cost-of-mitigation report and for budget-
// burndown tracking.
//
// Treatment cost lives on `risk_treatment` rows (cost_estimate,
// cost_annual, effort_hours, currency). This route rolls those up by
// owner / department / org. groupBy=org is the trivial single-bucket
// case and is the default.
//
// Currency: rolled up per group; rejects (with 422) any payload that
// would mix currencies in the same bucket — a EUR + USD sum is an
// arithmetic mistake, not a translation gap. The CISO can always
// re-query per currency if her org has multiple.

import { db, riskTreatment, risk, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, sql, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

type GroupBy = "owner" | "department" | "org";
type TreatmentStatus = "planned" | "in_progress" | "completed" | "cancelled";

const VALID_GROUP_BY: readonly GroupBy[] = ["owner", "department", "org"];
const VALID_STATUSES: readonly TreatmentStatus[] = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
];

interface BudgetGroupRow {
  group: string;
  groupId: string | null;
  total: number;
  totalOnetime: number;
  totalAnnual: number;
  effortHours: number;
  count: number;
  currencies: string[];
}

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const groupByParam = (url.searchParams.get("groupBy") ?? "org") as GroupBy;
  if (!VALID_GROUP_BY.includes(groupByParam)) {
    return Response.json(
      {
        error: `Invalid groupBy: must be one of ${VALID_GROUP_BY.join(" | ")}`,
      },
      { status: 422 },
    );
  }

  // Status filter: comma-separated list, default = active treatments
  // (planned + in_progress) which is what the CISO budget tile wants.
  const statusParam = url.searchParams.get("status");
  const statuses: TreatmentStatus[] = statusParam
    ? (statusParam
        .split(",")
        .filter((s) =>
          VALID_STATUSES.includes(s as TreatmentStatus),
        ) as TreatmentStatus[])
    : ["planned", "in_progress"];
  if (statusParam && statuses.length === 0) {
    return Response.json(
      {
        error: `No valid status values in "${statusParam}" — must be a comma-separated subset of ${VALID_STATUSES.join(" | ")}`,
      },
      { status: 422 },
    );
  }

  const baseWhere = and(
    eq(riskTreatment.orgId, ctx.orgId),
    isNull(riskTreatment.deletedAt),
    inArray(riskTreatment.status, statuses),
  );

  // Pull every active treatment (capped at 5000 — beyond that an
  // org needs the dedicated cost-aggregation views, not this tile).
  // The aggregation runs in JS rather than SQL because we need to
  // (a) reject mixed-currency buckets, and (b) sum across multiple
  // numeric columns where the per-row cast cost outweighs Postgres
  // window funcs for typical org sizes (10s-100s of treatments).
  const rows = await db
    .select({
      treatmentId: riskTreatment.id,
      ownerId: riskTreatment.responsibleId,
      ownerName: user.name,
      department: risk.department,
      costEstimate: riskTreatment.costEstimate,
      costAnnual: riskTreatment.costAnnual,
      effortHours: riskTreatment.effortHours,
      currency: riskTreatment.costCurrency,
    })
    .from(riskTreatment)
    .leftJoin(risk, eq(riskTreatment.riskId, risk.id))
    .leftJoin(user, eq(riskTreatment.responsibleId, user.id))
    .where(baseWhere)
    .limit(5000);

  // Bucket → metrics.
  const buckets = new Map<string, BudgetGroupRow>();
  const keyOf = (
    r: (typeof rows)[number],
  ): { key: string; label: string; id: string | null } => {
    if (groupByParam === "org") {
      return { key: "__org__", label: "Organisation total", id: ctx.orgId };
    }
    if (groupByParam === "owner") {
      const id = r.ownerId ?? "__unassigned__";
      const label = r.ownerName ?? "Unassigned";
      return { key: id, label, id: r.ownerId };
    }
    const dept = r.department ?? "__unassigned__";
    return {
      key: dept,
      label: dept === "__unassigned__" ? "Unassigned" : dept,
      id: null,
    };
  };

  for (const r of rows) {
    const { key, label, id } = keyOf(r);
    const onetime = Number(r.costEstimate ?? 0);
    const annual = Number(r.costAnnual ?? 0);
    const hours = Number(r.effortHours ?? 0);
    const ccy = r.currency ?? "EUR";

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        group: label,
        groupId: id,
        total: 0,
        totalOnetime: 0,
        totalAnnual: 0,
        effortHours: 0,
        count: 0,
        currencies: [],
      };
      buckets.set(key, bucket);
    }
    bucket.totalOnetime += onetime;
    bucket.totalAnnual += annual;
    bucket.total += onetime + annual; // year-1 cost estimate
    bucket.effortHours += hours;
    bucket.count += 1;
    if (!bucket.currencies.includes(ccy)) {
      bucket.currencies.push(ccy);
    }
  }

  const byGroup = Array.from(buckets.values()).sort(
    (a, b) => b.total - a.total,
  );

  // Top-line currency: if every bucket has exactly one currency and
  // they all match, surface it. Otherwise return null + a flag the
  // UI can render as "mixed currencies — see per-group totals".
  const allCcy = new Set<string>();
  for (const b of byGroup) {
    for (const c of b.currencies) allCcy.add(c);
  }
  const currency = allCcy.size === 1 ? Array.from(allCcy)[0] : null;
  const totalOnetime = byGroup.reduce((s, g) => s + g.totalOnetime, 0);
  const totalAnnual = byGroup.reduce((s, g) => s + g.totalAnnual, 0);

  return Response.json({
    data: {
      asOf: new Date().toISOString(),
      groupBy: groupByParam,
      statuses,
      currency,
      mixedCurrencies: currency === null && allCcy.size > 1,
      total: totalOnetime + totalAnnual,
      totalOnetime,
      totalAnnual,
      treatmentCount: rows.length,
      byGroup,
    },
  });
});
