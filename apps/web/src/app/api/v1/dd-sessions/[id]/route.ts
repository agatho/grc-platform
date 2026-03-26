import {
  db,
  ddSession,
  vendor,
  questionnaireTemplate,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/dd-sessions/:id — Get session detail
export async function GET(req: Request, { params }: RouteParams) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const rows = await db
    .select({
      session: ddSession,
      vendorName: vendor.name,
      templateName: questionnaireTemplate.name,
    })
    .from(ddSession)
    .leftJoin(vendor, eq(ddSession.vendorId, vendor.id))
    .leftJoin(
      questionnaireTemplate,
      eq(ddSession.templateId, questionnaireTemplate.id),
    )
    .where(
      and(eq(ddSession.id, id), eq(ddSession.orgId, ctx.orgId)),
    );

  if (rows.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const row = rows[0];
  return Response.json({
    data: {
      ...row.session,
      vendorName: row.vendorName,
      templateName: row.templateName,
    },
  });
}
