// PUT /api/v1/whistleblowing/cases/:id/acknowledge — Mark case as acknowledged

import { db, wbCase, wbCaseMessage } from "@grc/db";
import { requireModule } from "@grc/auth";
import { acknowledgeCaseSchema } from "@grc/shared";
import { encrypt } from "@grc/shared";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("whistleblowing", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = acknowledgeCaseSchema.safeParse(await req.json());
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

  if (caseRow.status !== "received") {
    return Response.json(
      { error: "Case has already been acknowledged" },
      { status: 409 },
    );
  }

  const now = new Date();

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(wbCase)
      .set({
        status: "acknowledged",
        acknowledgedAt: now,
        updatedAt: now,
      })
      .where(eq(wbCase.id, id));

    // If ombudsperson included a message, create it
    if (body.data.message) {
      await tx.insert(wbCaseMessage).values({
        caseId: id,
        orgId: ctx.orgId,
        direction: "outbound",
        content: encrypt(body.data.message),
        authorType: "ombudsperson",
        authorId: ctx.userId,
        createdAt: now,
      });
    }
  });

  return Response.json({ data: { id, status: "acknowledged", acknowledgedAt: now.toISOString() } });
}
