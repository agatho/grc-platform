// Audit-log helper for document download events (DMS controlled copies).
// Shared by both document download routes; kept out of the route files
// because Next.js route modules may only export handlers.
//
// ── #S06-08 (ARCTOS-FULL-2026-08-31, Medium) ────────────────────────
// This helper used to run in exactly ONE branch: the successful
// watermarked download. The uncontrolled paths — `?raw=1` (pristine
// original, admin/quality_manager) and the watermark-failure fallback —
// left no trace at all, so the evidence logic was inverted: the
// controlled bezug was demonstrable, the uncontrolled one was not.
//
// Every byte that leaves the DMS is now recorded, with the outcome as
// part of the entry. `actionDetail` differs per outcome so the audit
// query can separate them without parsing metadata.

import { auditLog } from "@grc/db";
import { withAuditContext, type ApiContext } from "@/lib/api";

export type ControlledCopyOutcome =
  /** Footer stamped, marked copy handed out. */
  | "watermarked"
  /** `?raw=1` — pristine original, no marking (privileged roles only). */
  | "uncontrolled_raw"
  /** Watermarking was required but impossible; download refused. */
  | "watermark_failed"
  /** Non-PDF or non-released document — nothing to stamp. */
  | "unmarked";

const ACTION_DETAIL: Record<ControlledCopyOutcome, string> = {
  watermarked: "controlled_copy_download",
  uncontrolled_raw: "uncontrolled_copy_download",
  watermark_failed: "controlled_copy_watermark_failed",
  unmarked: "document_download",
};

export interface ControlledCopyDownloadInfo {
  documentId: string;
  title: string;
  fileName: string;
  versionLabel: string | null;
  sha256: string | null;
  fileId?: string;
  /** Which branch produced this entry. Defaults to "watermarked". */
  outcome?: ControlledCopyOutcome;
  /** Lifecycle status of the document at download time (#S06-07). */
  documentStatus?: string | null;
  /** WatermarkError.reason when outcome === "watermark_failed". */
  failureReason?: string;
  /** Whether the response was actually served (false = refused). */
  served?: boolean;
}

/** Write the download audit-log entry (who, when, which version, and
 *  whether the copy left the DMS marked, unmarked or not at all). */
export async function recordControlledCopyDownload(
  ctx: ApiContext,
  info: ControlledCopyDownloadInfo,
): Promise<void> {
  const outcome = info.outcome ?? "watermarked";
  await withAuditContext(ctx, async (tx) => {
    // S03-05: chained by the BEFORE INSERT trigger on audit_log
    // (migration 0401). "Who downloaded a controlled copy" used to be
    // recorded outside the chain and outside the external anchor.
    await tx.insert(auditLog).values({
      orgId: ctx.orgId,
      userId: ctx.userId,
      userEmail: ctx.session.user.email,
      userName: ctx.session.user.name,
      entityType: "document",
      entityId: info.documentId,
      entityTitle: info.title,
      action: "export",
      actionDetail: ACTION_DETAIL[outcome],
      metadata: {
        fileName: info.fileName,
        fileId: info.fileId,
        versionLabel: info.versionLabel,
        sourceSha256: info.sha256,
        documentStatus: info.documentStatus ?? null,
        outcome,
        watermarked: outcome === "watermarked",
        failureReason: info.failureReason ?? null,
        served: info.served ?? outcome !== "watermark_failed",
      },
    });
  });
}
