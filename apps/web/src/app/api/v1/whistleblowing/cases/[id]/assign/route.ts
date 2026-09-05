// PUT /api/v1/whistleblowing/cases/:id/assign — Assign case to ombudsperson

import { db, wbCase, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { assignWbCaseSchema } from "@grc/shared";
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

  const body = assignWbCaseSchema.safeParse(await req.json());
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

  // Verify assignee exists
  const assignee = await db.query.user.findFirst({
    where: eq(user.id, body.data.assignedTo),
  });

  if (!assignee) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const now = new Date();

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(wbCase)
      .set({
        assignedTo: body.data.assignedTo,
        updatedAt: now,
      })
      .where(eq(wbCase.id, id));
  });

  return Response.json({
    data: {
      id,
      assignedTo: body.data.assignedTo,
      assignedToName: assignee.name,
    },
  });
});
