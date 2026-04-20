import { db, evidenceReviewJob } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/evidence-review/jobs/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "control_owner",
    "auditor",
    "risk_manager",
  );
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const [job] = await db
    .select()
    .from(evidenceReviewJob)
    .where(
      and(eq(evidenceReviewJob.id, id), eq(evidenceReviewJob.orgId, ctx.orgId)),
    );

  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: job });
}

// POST /api/v1/evidence-review/jobs/:id — Cancel job
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "control_owner");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(evidenceReviewJob)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(evidenceReviewJob.id, id),
          eq(evidenceReviewJob.orgId, ctx.orgId),
          eq(evidenceReviewJob.status, "running"),
        ),
      )
      .returning();
    return updated;
  });

  if (!result)
    return Response.json(
      { error: "Not found or not running" },
      { status: 404 },
    );
  return Response.json({ data: result });
}
