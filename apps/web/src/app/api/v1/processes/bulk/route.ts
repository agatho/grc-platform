import { db, process } from "@grc/db";
import { writeAuditEntry } from "@/lib/audit-entry";
import { requireModule } from "@grc/auth";
import { bulkActionSchema, PROCESS_STATUS_TRANSITIONS } from "@grc/shared";
import type { ProcessStatus } from "@grc/shared";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/processes/bulk — Bulk operations
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = bulkActionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { action, processIds } = body.data;

  // Fetch all requested processes
  const processes = await db
    .select({
      id: process.id,
      status: process.status,
      processOwnerId: process.processOwnerId,
      name: process.name,
    })
    .from(process)
    .where(
      and(
        inArray(process.id, processIds),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  const processMap = new Map(processes.map((p) => [p.id, p]));

  const bulkOperationId = crypto.randomUUID();
  const errors: Array<{ processId: string; error: string }> = [];
  let succeeded = 0;

  const result = await withAuditContext(ctx, async (tx) => {
    for (const pid of processIds) {
      const proc = processMap.get(pid);

      if (!proc) {
        errors.push({ processId: pid, error: "Process not found" });
        continue;
      }

      try {
        switch (action) {
          case "change_status": {
            const targetStatus = body.data.status;
            const currentStatus = proc.status as ProcessStatus;
            const allowedTargets = PROCESS_STATUS_TRANSITIONS[currentStatus];

            if (!allowedTargets || !allowedTargets.includes(targetStatus)) {
              errors.push({
                processId: pid,
                error: `Cannot transition from ${currentStatus} to ${targetStatus}`,
              });
              continue;
            }

            const updateData: Record<string, unknown> = {
              status: targetStatus,
              updatedBy: ctx.userId,
              updatedAt: new Date(),
            };

            if (targetStatus === "published") {
              updateData.publishedAt = new Date();
            }

            await tx
              .update(process)
              .set(updateData)
              .where(and(eq(process.id, pid), eq(process.orgId, ctx.orgId)));
            break;
          }

          case "assign_owner": {
            await tx
              .update(process)
              .set({
                processOwnerId: body.data.processOwnerId,
                updatedBy: ctx.userId,
                updatedAt: new Date(),
              })
              .where(and(eq(process.id, pid), eq(process.orgId, ctx.orgId)));
            break;
          }

          case "assign_reviewer": {
            await tx
              .update(process)
              .set({
                reviewerId: body.data.reviewerId,
                updatedBy: ctx.userId,
                updatedAt: new Date(),
              })
              .where(and(eq(process.id, pid), eq(process.orgId, ctx.orgId)));
            break;
          }

          case "change_department": {
            await tx
              .update(process)
              .set({
                department: body.data.department,
                updatedBy: ctx.userId,
                updatedAt: new Date(),
              })
              .where(and(eq(process.id, pid), eq(process.orgId, ctx.orgId)));
            break;
          }

          case "delete": {
            await tx
              .update(process)
              .set({
                deletedAt: new Date(),
                deletedBy: ctx.userId,
                updatedBy: ctx.userId,
                updatedAt: new Date(),
              })
              .where(and(eq(process.id, pid), eq(process.orgId, ctx.orgId)));
            break;
          }
        }

        succeeded++;
      } catch (err) {
        errors.push({
          processId: pid,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Write audit log entry for bulk operation.
    //
    // [ARCTOS-FULL-2026-08-31 / WP4 · S03-05] This INSERT used to land in
    // audit_log with entry_hash NULL, previous_hash_scope NULL and
    // hash_version 1 (the column default) — outside every integrity check
    // and outside every external anchor, while /integrity reported such
    // rows as historic "legacy" residue. Migration 0401 moved the chain
    // assignment into a BEFORE INSERT trigger on audit_log itself, so this
    // row is now scoped, scrubbed, committed and hashed like any other.
    // No caller-side change is needed and none is possible to forget.
    await writeAuditEntry(tx, {
      orgId: ctx.orgId,
      userId: ctx.userId,
      userEmail: ctx.session.user.email,
      userName: ctx.session.user.name,
      entityType: "process",
      action: "update",
      actionDetail: `bulk_${action}`,
      metadata: {
        bulk_operation_id: bulkOperationId,
        action,
        processIds,
        succeeded,
        failed: errors.length,
      },
    });

    return {
      totalRequested: processIds.length,
      succeeded,
      failed: errors.length,
      errors,
    };
  });

  return Response.json({ data: result });
});
