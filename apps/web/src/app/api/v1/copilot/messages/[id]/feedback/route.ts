import { db, copilotFeedback } from "@grc/db";
import { createFeedbackSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/copilot/messages/:id/feedback — Submit feedback
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner", "auditor", "dpo", "viewer");
  if (ctx instanceof Response) return ctx;

  const { id: messageId } = await params;
  const body = createFeedbackSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(copilotFeedback)
      .values({
        messageId,
        orgId: ctx.orgId,
        userId: ctx.userId,
        rating: body.data.rating,
        comment: body.data.comment,
      })
      .onConflictDoUpdate({
        target: [copilotFeedback.messageId, copilotFeedback.userId],
        set: { rating: body.data.rating, comment: body.data.comment },
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
