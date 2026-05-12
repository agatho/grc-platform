import { db, vulnerability } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";
import { buildTransitionsResponse } from "@/lib/generic-transitions";

const VULN_STATUSES = [
  "open",
  "in_progress",
  "mitigated",
  "accepted_risk",
  "false_positive",
] as const;

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  requireUuidParam(id);

  const [row] = await db
    .select({ status: vulnerability.status })
    .from(vulnerability)
    .where(and(eq(vulnerability.id, id), eq(vulnerability.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "Vulnerability not found" }, { status: 404 });
  }

  return Response.json({
    data: buildTransitionsResponse({
      current: row.status,
      knownStatuses: VULN_STATUSES,
      module: "isms/vulnerabilities",
      entityId: id,
    }),
  });
});
