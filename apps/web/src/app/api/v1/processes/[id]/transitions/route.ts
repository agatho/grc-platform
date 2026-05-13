import { db, process } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

// GET /api/v1/processes/[id]/transitions
//
// Discovery for the BPMN-process lifecycle.
// Status (process_status enum):
//   draft → in_review → approved → published → archived

const PROCESS_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
] as const;

const PROCESS_ALLOWED: Record<
  (typeof PROCESS_STATUSES)[number],
  (typeof PROCESS_STATUSES)[number][]
> = {
  draft: ["in_review", "archived"],
  in_review: ["approved", "draft", "archived"],
  approved: ["published", "in_review", "archived"],
  published: ["archived", "in_review"], // re-review for amendments
  archived: ["draft"], // un-archive forks a new draft
};

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  requireUuidParam(id);

  const [row] = await db
    .select({ status: process.status })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      current: row.status,
      knownStatuses: PROCESS_STATUSES,
      allowedNext: PROCESS_ALLOWED[row.status] ?? [],
      endpoint: `/api/v1/processes/${id}`,
      method: "PUT",
      bodyShape: {
        status: `<one of: ${PROCESS_STATUSES.join(" | ")}>`,
      },
      note: "Process publication updates ProcessVersion downstream — published is the single source of truth for BPMN consumers.",
    },
  });
});
