// BPM Overhaul Phase 6 P6: Quality-Manager bulk-approve endpoint.
//
// Accepts an array of process IDs and a target status; per process:
//   1. Run the gate evaluator — skip + report any process with blocker errors
//   2. Update status (auto-version is handled by status PUT logic on the wire,
//      but here we replicate the version snapshot for bulk-flow parity).
//   3. Record a sign-off row for the bulk action.
//
// Returns a per-process result list so the UI can render a successes/failures
// summary.

import { db, process, processSignOff, processVersion, notification } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { evaluateTransitionGates, type ProcessStatus } from "@/lib/process-gates";
import {
  computePayloadHash,
  computeChainHash,
} from "@/lib/sign-off-chain";
import { z } from "zod";

const bulkSchema = z.object({
  processIds: z.array(z.string().uuid()).min(1).max(100),
  targetStatus: z.enum(["approved", "published"]),
  signoffType: z.enum(["approval", "publish"]).default("approval"),
  signerRole: z
    .enum(["admin", "quality_manager", "compliance_officer"])
    .default("quality_manager"),
  comments: z.string().max(1000).optional().nullable(),
});

interface PerProcessResult {
  processId: string;
  status: "approved" | "skipped" | "error";
  blockers?: any[];
  error?: string;
  newStatus?: string;
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "quality_manager", "compliance_officer");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const parsed = bulkSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const results: PerProcessResult[] = [];

  for (const processId of parsed.data.processIds) {
    try {
      const [existing] = await db
        .select({
          id: process.id,
          status: process.status,
          name: process.name,
          processOwnerId: process.processOwnerId,
        })
        .from(process)
        .where(
          and(eq(process.id, processId), eq(process.orgId, ctx.orgId), isNull(process.deletedAt)),
        );
      if (!existing) {
        results.push({ processId, status: "error", error: "Process not found" });
        continue;
      }

      // Check gates
      const blockers = await db.transaction(async (tx) =>
        evaluateTransitionGates({
          tx,
          processId,
          orgId: ctx.orgId,
          target: parsed.data.targetStatus as ProcessStatus,
        }),
      );
      const errBlockers = blockers.filter((b) => b.severity === "error");
      if (errBlockers.length > 0) {
        results.push({ processId, status: "skipped", blockers: errBlockers });
        continue;
      }

      // Mutate + sign-off
      await withAuditContext(
        ctx,
        async (tx) => {
          // Status update
          await tx
            .update(process)
            .set({
              status: parsed.data.targetStatus,
              publishedAt: parsed.data.targetStatus === "published" ? new Date() : undefined,
              updatedAt: new Date(),
              updatedBy: ctx.userId,
            })
            .where(eq(process.id, processId));

          // Auto-version
          const [curr] = await tx
            .select({
              bpmnXml: processVersion.bpmnXml,
              diagramJson: processVersion.diagramJson,
              versionNumber: processVersion.versionNumber,
            })
            .from(processVersion)
            .where(
              and(eq(processVersion.processId, processId), eq(processVersion.isCurrent, true)),
            )
            .limit(1);
          if (curr) {
            await tx
              .update(processVersion)
              .set({ isCurrent: false })
              .where(
                and(eq(processVersion.processId, processId), eq(processVersion.isCurrent, true)),
              );
            await tx.insert(processVersion).values({
              processId,
              orgId: ctx.orgId,
              versionNumber: (curr.versionNumber ?? 0) + 1,
              bpmnXml: curr.bpmnXml,
              diagramJson: curr.diagramJson,
              isCurrent: true,
              changeSummary: `Bulk ${parsed.data.targetStatus} by ${parsed.data.signerRole}`,
              createdBy: ctx.userId,
            });
            await tx
              .update(process)
              .set({ currentVersion: (curr.versionNumber ?? 0) + 1 })
              .where(eq(process.id, processId));
          }

          // Sign-off
          const [prev] = await tx
            .select({ chainHash: processSignOff.chainHash })
            .from(processSignOff)
            .where(eq(processSignOff.processId, processId))
            .orderBy(desc(processSignOff.signedAt))
            .limit(1);
          const payloadHash = computePayloadHash({
            processId,
            processName: existing.name,
            processVersionId: null,
            signerId: ctx.userId,
            signerRole: parsed.data.signerRole,
            signoffType: parsed.data.signoffType,
            comments: parsed.data.comments ?? null,
            statusAtSign: parsed.data.targetStatus,
            signedAt: new Date().toISOString(),
          });
          const chainHash = computeChainHash(prev?.chainHash ?? null, payloadHash);
          await tx.insert(processSignOff).values({
            orgId: ctx.orgId,
            processId,
            processVersionId: null,
            signerId: ctx.userId,
            signerRole: parsed.data.signerRole,
            signoffType: parsed.data.signoffType,
            comments: parsed.data.comments ?? null,
            payloadHash,
            previousChainHash: prev?.chainHash ?? null,
            chainHash,
          });

          // Notify owner
          if (existing.processOwnerId) {
            await tx.insert(notification).values({
              userId: existing.processOwnerId,
              orgId: ctx.orgId,
              type: "status_change",
              entityType: "process",
              entityId: processId,
              title: `Process ${parsed.data.targetStatus}: ${existing.name}`,
              message: parsed.data.comments ?? null,
              channel: "both",
              templateKey: `process_${parsed.data.targetStatus}`,
              templateData: { processId },
              createdBy: ctx.userId,
            });
          }
        },
        { actionDetail: `Bulk ${parsed.data.targetStatus} (${parsed.data.signerRole})` },
      );

      results.push({ processId, status: "approved", newStatus: parsed.data.targetStatus });
    } catch (err) {
      results.push({
        processId,
        status: "error",
        error: (err as Error).message,
      });
    }
  }

  return Response.json({
    data: {
      total: parsed.data.processIds.length,
      successful: results.filter((r) => r.status === "approved").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    },
  });
}
