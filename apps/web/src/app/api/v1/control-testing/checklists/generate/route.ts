import { db, controlTestChecklist } from "@grc/db";
import { generateChecklistSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/control-testing/checklists/generate — AI-generate checklist
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = generateChecklistSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // AI generation placeholder
  const items = [
    {
      order: 1,
      question: "Is the control documented and up to date?",
      guidance: "Check documentation date and version.",
      evidenceRequired: true,
    },
    {
      order: 2,
      question: "Is the control owner assigned and active?",
      guidance: "Verify the control owner is still employed and responsible.",
      evidenceRequired: false,
    },
    {
      order: 3,
      question: "Has the control been tested within the required frequency?",
      guidance: "Compare last test date with required frequency.",
      evidenceRequired: true,
    },
    {
      order: 4,
      question: "Are all related evidences current and complete?",
      guidance: "Review each evidence artifact for completeness.",
      evidenceRequired: true,
    },
    {
      order: 5,
      question: "Are there any open findings related to this control?",
      guidance: "Check for unresolved findings.",
      evidenceRequired: false,
    },
  ];

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(controlTestChecklist)
      .values({
        controlId: body.data.controlId,
        orgId: ctx.orgId,
        name: "AI-Generated Control Test Checklist",
        description:
          "Automatically generated checklist for manual control testing.",
        items,
        totalItems: items.length,
        aiGenerated: true,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
