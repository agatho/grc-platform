import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { z } from "zod";

// ─── Zod Schemas ─────────────────────────────────────────────

const objectiveValues = [
  "climate_mitigation",
  "climate_adaptation",
  "water",
  "circular_economy",
  "pollution",
  "biodiversity",
] as const;

const statusValues = ["draft", "in_review", "approved", "rejected"] as const;

const createTaxonomyAssessmentSchema = z.object({
  reportingYear: z.number().int().min(2020).max(2035),
  activityName: z.string().min(1).max(500),
  naceCode: z.string().max(20).optional(),
  objectiveId: z.enum(objectiveValues),
  isEligible: z.boolean().optional(),
  isAligned: z.boolean().optional(),
  turnoverAmount: z.number().min(0).optional(),
  capexAmount: z.number().min(0).optional(),
  opexAmount: z.number().min(0).optional(),
  substantialContributionMet: z.boolean().optional(),
  dnshMet: z.boolean().optional(),
  minimumSafeguardsMet: z.boolean().optional(),
  justification: z.string().optional(),
  status: z.enum(statusValues).optional(),
});

// ─── GET /api/v1/esg/taxonomy ────────────────────────────────

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const { limit, offset, page } = paginate(url.searchParams);
  const yearFilter = url.searchParams.get("year");

  // Build WHERE clause
  const conditions = [sql`org_id = ${ctx.orgId}`];
  if (yearFilter) {
    const year = parseInt(yearFilter, 10);
    if (!isNaN(year)) {
      conditions.push(sql`reporting_year = ${year}`);
    }
  }
  const whereClause = sql.join(conditions, sql` AND `);

  // Fetch activities
  const activities = await db.execute(sql`
    SELECT
      id,
      reporting_year AS "reportingYear",
      activity_name AS "activityName",
      nace_code AS "naceCode",
      objective_id AS "objective",
      is_eligible AS "eligible",
      is_aligned AS "aligned",
      substantial_contribution_met AS "substantialContribution",
      dnsh_met AS "dnsh",
      minimum_safeguards_met AS "minimumSafeguards",
      COALESCE(turnover_amount, 0)::float AS "turnoverAligned",
      COALESCE(capex_amount, 0)::float AS "capexAligned",
      COALESCE(opex_amount, 0)::float AS "opexAligned",
      status,
      justification,
      assessed_by AS "assessedBy",
      assessed_at AS "assessedAt",
      created_at AS "createdAt"
    FROM eu_taxonomy_assessment
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  // Get total count
  const [countResult] = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM eu_taxonomy_assessment
    WHERE ${whereClause}
  `);
  const total = (countResult as Record<string, unknown>).total as number;

  // Compute summary stats
  const [stats] = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE is_eligible = true)::int AS "eligibleCount",
      COUNT(*) FILTER (WHERE is_aligned = true)::int AS "alignedCount",
      CASE
        WHEN COUNT(*) FILTER (WHERE is_eligible = true) > 0
        THEN ROUND(
          COUNT(*) FILTER (WHERE is_aligned = true)::numeric
          / NULLIF(COUNT(*) FILTER (WHERE is_eligible = true), 0) * 100, 1
        )
        ELSE 0
      END AS "alignmentRate",
      COALESCE(SUM(turnover_amount) FILTER (WHERE is_aligned = true), 0)::float AS "totalTurnoverAligned",
      COALESCE(SUM(capex_amount) FILTER (WHERE is_aligned = true), 0)::float AS "totalCapexAligned",
      COALESCE(SUM(opex_amount) FILTER (WHERE is_aligned = true), 0)::float AS "totalOpexAligned"
    FROM eu_taxonomy_assessment
    WHERE ${whereClause}
  `);

  return Response.json({
    data: activities,
    summary: stats,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// ─── POST /api/v1/esg/taxonomy ───────────────────────────────

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "esg_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createTaxonomyAssessmentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx.execute(sql`
      INSERT INTO eu_taxonomy_assessment (
        org_id, reporting_year, activity_name, nace_code, objective_id,
        is_eligible, is_aligned, turnover_amount, capex_amount, opex_amount,
        substantial_contribution_met, dnsh_met, minimum_safeguards_met,
        justification, status, assessed_by, assessed_at, created_by
      ) VALUES (
        ${ctx.orgId}, ${body.data.reportingYear}, ${body.data.activityName},
        ${body.data.naceCode ?? null}, ${body.data.objectiveId},
        ${body.data.isEligible ?? false}, ${body.data.isAligned ?? false},
        ${body.data.turnoverAmount ?? 0}, ${body.data.capexAmount ?? 0}, ${body.data.opexAmount ?? 0},
        ${body.data.substantialContributionMet ?? false}, ${body.data.dnshMet ?? false},
        ${body.data.minimumSafeguardsMet ?? false},
        ${body.data.justification ?? null}, ${body.data.status ?? "draft"},
        ${ctx.userId}, now(), ${ctx.userId}
      )
      RETURNING
        id,
        reporting_year AS "reportingYear",
        activity_name AS "activityName",
        nace_code AS "naceCode",
        objective_id AS "objective",
        is_eligible AS "eligible",
        is_aligned AS "aligned",
        substantial_contribution_met AS "substantialContribution",
        dnsh_met AS "dnsh",
        minimum_safeguards_met AS "minimumSafeguards",
        COALESCE(turnover_amount, 0)::float AS "turnoverAligned",
        COALESCE(capex_amount, 0)::float AS "capexAligned",
        COALESCE(opex_amount, 0)::float AS "opexAligned",
        status,
        created_at AS "createdAt"
    `);
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
