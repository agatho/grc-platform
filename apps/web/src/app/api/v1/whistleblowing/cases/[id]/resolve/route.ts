// PUT /api/v1/whistleblowing/cases/:id/resolve — Resolve case with category + encrypted resolution

import { db, wbCase, wbCaseMessage } from "@grc/db";
import { requireModule } from "@grc/auth";
import { resolveCaseSchema } from "@grc/shared";
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

export const PUT = withErrorHandler(async function PUT(
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

  const body = resolveCaseSchema.safeParse(await req.json());
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

  if (caseRow.status === "resolved" || caseRow.status === "closed") {
    return Response.json(
      { error: "Case is already resolved or closed" },
      { status: 409 },
    );
  }

  const now = new Date();

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(wbCase)
      .set({
        status: "resolved",
        resolution: encrypt(body.data.resolution),
        resolutionCategory: body.data.resolutionCategory,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(wbCase.id, id));

    // Send optional final message to whistleblower
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

  return Response.json({
    data: {
      id,
      status: "resolved",
      resolutionCategory: body.data.resolutionCategory,
      resolvedAt: now.toISOString(),
    },
  });
});
