import { db, finding } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";
import { buildTransitionsResponse } from "@/lib/generic-transitions";

const FINDING_STATUSES = [
  "identified",
  "validated",
  "remediating",
  "remediated",
  "verified",
  "closed",
  "deferred",
] as const;

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  requireUuidParam(id);

  const [row] = await db
    .select({ status: finding.status })
    .from(finding)
    .where(and(eq(finding.id, id), eq(finding.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "Finding not found" }, { status: 404 });
  }

  return Response.json({
    data: buildTransitionsResponse({
      current: row.status,
      knownStatuses: FINDING_STATUSES,
      module: "findings",
      entityId: id,
    }),
  });
});
