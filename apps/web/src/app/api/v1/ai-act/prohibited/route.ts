import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, paginate } from "@/lib/api";
import { sql } from "drizzle-orm";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { limit, offset, searchParams } = paginate(req);
  const aiSystemId = searchParams.get("ai_system_id");

  let query = sql`SELECT s.*, s.id AS screening_id FROM ai_prohibited_screening s WHERE s.org_id = ${ctx.orgId}`;
  let countQuery = sql`SELECT count(*)::int AS count FROM ai_prohibited_screening WHERE org_id = ${ctx.orgId}`;

  if (aiSystemId) {
    query = sql`${query} AND s.ai_system_id = ${aiSystemId}`;
    countQuery = sql`${countQuery} AND ai_system_id = ${aiSystemId}`;
  }

  query = sql`${query} ORDER BY s.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const [rows, countResult] = await Promise.all([
    db.execute(query),
    db.execute(countQuery),
  ]);
  return Response.json({
    data: rows.rows,
    pagination: { page: Math.floor(offset / limit) + 1, limit, total: Number((countResult.rows[0] as any)?.count ?? 0) },
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const { ai_system_id, social_scoring, real_time_biometric, emotion_recognition, predictive_policing, untargeted_scraping, subliminal_manipulation, exploiting_vulnerabilities, biometric_categorization } = body;
  if (!ai_system_id) {
    return Response.json({ error: "ai_system_id is required" }, { status: 422 });
  }

  const isProhibited = !!(social_scoring || real_time_biometric || emotion_recognition || predictive_policing || untargeted_scraping || subliminal_manipulation || exploiting_vulnerabilities || biometric_categorization);

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      INSERT INTO ai_prohibited_screening (org_id, ai_system_id, social_scoring, real_time_biometric, emotion_recognition, predictive_policing, untargeted_scraping, subliminal_manipulation, exploiting_vulnerabilities, biometric_categorization, overall_result, screened_by, created_by)
      VALUES (${ctx.orgId}, ${ai_system_id}, ${social_scoring ?? false}, ${real_time_biometric ?? false}, ${emotion_recognition ?? false}, ${predictive_policing ?? false}, ${untargeted_scraping ?? false}, ${subliminal_manipulation ?? false}, ${exploiting_vulnerabilities ?? false}, ${biometric_categorization ?? false}, ${isProhibited ? 'prohibited' : 'clear'}, ${ctx.userId}, ${ctx.userId})
      RETURNING *
    `);
    return res.rows[0];
  });
  return Response.json({ data: result }, { status: 201 });
}
