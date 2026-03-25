import { db, process, auditLog, userOrganizationRole } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  bulkActionSchema,
  PROCESS_STATUS_TRANSITIONS,
} from "@grc/shared";
import type { ProcessStatus } from "@grc/shared";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/processes/bulk — Bulk operations
export async function POST(req: Request) {
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
              .where(
                and(eq(process.id, pid), eq(process.orgId, ctx.orgId)),
              );
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
              .where(
                and(eq(process.id, pid), eq(process.orgId, ctx.orgId)),
              );
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
              .where(
                and(eq(process.id, pid), eq(process.orgId, ctx.orgId)),
              );
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
              .where(
                and(eq(process.id, pid), eq(process.orgId, ctx.orgId)),
              );
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
              .where(
                and(eq(process.id, pid), eq(process.orgId, ctx.orgId)),
              );
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

    // Write audit log entry for bulk operation
    await tx.insert(auditLog).values({
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
}
