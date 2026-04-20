import { db, biReportExecution } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/bi-reports/executions/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const [row] = await db
    .select()
    .from(biReportExecution)
    .where(
      and(eq(biReportExecution.id, id), eq(biReportExecution.orgId, ctx.orgId)),
    );
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}
