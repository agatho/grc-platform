// POST /api/v1/whistleblowing/cases/:id/message — Ombudsperson sends encrypted message

import { db, wbCase, wbCaseMessage } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sendWbMessageSchema } from "@grc/shared";
import { encrypt } from "@grc/shared";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: RouteParams,
) {
  // #WAVE13-RBAC-02 / #WAVE19-W7: see /whistleblowing/cases/route.ts.
  // HinSchG isolation — admin deliberately excluded.
  const ctx = await withAuth("whistleblowing_officer", "ombudsperson");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule(
    "whistleblowing",
    ctx.orgId,
    req.method,
  );
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = sendWbMessageSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const caseRow = await db.query.wbCase.findFirst({
    where: eq(wbCase.id, id),
  });

  if (!caseRow || caseRow.orgId !== ctx.orgId) {
    return Response.json({ error: "Case not found" }, { status: 404 });
  }

  if (caseRow.status === "closed") {
    return Response.json({ error: "Case is closed" }, { status: 409 });
  }

  const now = new Date();
  const encryptedContent = encrypt(body.data.content);

  const [message] = await withAuditContext(ctx, async (tx) => {
    // If case is in "acknowledged" state, move to investigating
    if (caseRow.status === "acknowledged") {
      await tx
        .update(wbCase)
        .set({ status: "investigating", updatedAt: now })
        .where(eq(wbCase.id, id));
    }

    return tx
      .insert(wbCaseMessage)
      .values({
        caseId: id,
        orgId: ctx.orgId,
        direction: "outbound",
        content: encryptedContent,
        authorType: "ombudsperson",
        authorId: ctx.userId,
        createdAt: now,
      })
      .returning();
  });

  return Response.json(
    {
      data: {
        id: message!.id,
        direction: "outbound",
        authorType: "ombudsperson",
        createdAt: message!.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
});
