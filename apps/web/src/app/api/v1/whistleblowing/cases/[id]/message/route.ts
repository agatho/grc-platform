// POST /api/v1/whistleblowing/cases/:id/message — Ombudsperson sends encrypted message

import { db, wbCase, wbCaseMessage } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sendWbMessageSchema } from "@grc/shared";
import { encrypt } from "@grc/shared";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "ombudsperson");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("whistleblowing", ctx.orgId, req.method);
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
}
