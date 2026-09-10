import {
  db,
  esgMaterialityAssessment,
  esgMaterialityTopic,
  esrsDatapointDefinition,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/esg/materiality/[year]/topics — Seed ESRS topics for assessment
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "esg_manager",
    "esg_contributor",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { year } = await params;
  const reportingYear = parseInt(year, 10);
  if (isNaN(reportingYear)) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const [assessment] = await db
    .select()
    .from(esgMaterialityAssessment)
    .where(
      and(
        eq(esgMaterialityAssessment.orgId, ctx.orgId),
        eq(esgMaterialityAssessment.reportingYear, reportingYear),
      ),
    );

  if (!assessment) {
    return Response.json(
      { error: "Assessment not found for this year" },
      { status: 404 },
    );
  }

  // Check if topics already seeded
  const existingTopics = await db
    .select({ id: esgMaterialityTopic.id })
    .from(esgMaterialityTopic)
    .where(eq(esgMaterialityTopic.assessmentId, assessment.id))
    .limit(1);

  if (existingTopics.length > 0) {
    return Response.json(
      { error: "Topics already seeded for this assessment" },
      { status: 409 },
    );
  }

  // Get all unique ESRS standards from datapoint definitions
  const datapoints = await db
    .select({
      esrsStandard: esrsDatapointDefinition.esrsStandard,
    })
    .from(esrsDatapointDefinition);

  // Derive unique topics from ESRS standards
  const standardTopicMap: Record<string, string> = {
    E1: "Klimawandel / Climate Change",
    E2: "Umweltverschmutzung / Pollution",
    E3: "Wasser- und Meeresressourcen / Water and Marine Resources",
    E4: "Biodiversitaet / Biodiversity and Ecosystems",
    E5: "Kreislaufwirtschaft / Resource Use and Circular Economy",
    S1: "Eigene Belegschaft / Own Workforce",
    S2: "Arbeitnehmer in der Wertschoepfungskette / Workers in the Value Chain",
    S3: "Betroffene Gemeinschaften / Affected Communities",
    S4: "Verbraucher und Endnutzer / Consumers and End-users",
    G1: "Unternehmensfuehrung / Business Conduct",
  };

  const uniqueStandards = [...new Set(datapoints.map((d) => d.esrsStandard))];

  const topicValues = uniqueStandards.map((standard) => ({
    assessmentId: assessment.id,
    esrsStandard: standard,
    topicName: standardTopicMap[standard] ?? standard,
  }));

  // Also add any standards not yet in the DB
  for (const [standard, name] of Object.entries(standardTopicMap)) {
    if (!uniqueStandards.includes(standard)) {
      topicValues.push({
        assessmentId: assessment.id,
        esrsStandard: standard,
        topicName: name,
      });
    }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    return tx.insert(esgMaterialityTopic).values(topicValues).returning();
  });

  return Response.json({ data: created }, { status: 201 });
});
// GET /api/v1/esg/materiality/[year]/topics — List topics for assessment
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { year } = await params;
  const reportingYear = parseInt(year, 10);
  if (isNaN(reportingYear)) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const [assessment] = await db
    .select()
    .from(esgMaterialityAssessment)
    .where(
      and(
        eq(esgMaterialityAssessment.orgId, ctx.orgId),
        eq(esgMaterialityAssessment.reportingYear, reportingYear),
      ),
    );

  if (!assessment) {
    return Response.json({ error: "Assessment not found" }, { status: 404 });
  }

  const topics = await db
    .select()
    .from(esgMaterialityTopic)
    .where(eq(esgMaterialityTopic.assessmentId, assessment.id));

  return Response.json({ data: topics });
});
