import { copilotFeedback } from "@grc/db";
import { createFeedbackSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/copilot/messages/:id/feedback — Submit feedback
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "dpo",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const { id: messageId } = await params;
  const body = createFeedbackSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
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
});
