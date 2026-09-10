import { db, process } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { reorderProcessMapSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// PUT /api/v1/processes/map/reorder — Prozesslandkarte: persist the
// manual tile order of one band. Body { category, orderedIds } →
// map_sequence is rewritten in steps of 10 (10, 20, 30, …) following
// the given order. `category` names the band being sorted (validation
// + audit trail); the sequence itself lives on the process rows, so
// uncategorized children that merely inherit the band stay sortable.
//
// Roles mirror the process PUT route (admin, process_owner).
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = reorderProcessMapSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }
  const { category, orderedIds } = body.data;

  // Every id must be a live process of this org — otherwise reject the
  // whole batch (a partial reorder would leave the band inconsistent).
  const rows = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        inArray(process.id, orderedIds),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (rows.length !== orderedIds.length) {
    const found = new Set(rows.map((r) => r.id));
    return Response.json(
      {
        error: "Some processes were not found in this organization",
        missingIds: orderedIds.filter((id) => !found.has(id)),
      },
      { status: 422 },
    );
  }

  await withAuditContext(
    ctx,
    async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(process)
          .set({
            mapSequence: (i + 1) * 10,
            updatedBy: ctx.userId,
            updatedAt: new Date(),
          })
          .where(
            and(eq(process.id, orderedIds[i]), eq(process.orgId, ctx.orgId)),
          );
      }
    },
    { actionDetail: `process map reorder (${category})` },
  );

  return Response.json({
    data: { category, updated: orderedIds.length },
  });
});
