// Audit-log helper for controlled-copy (watermarked) PDF downloads.
// Shared by both document download routes; kept out of the route files
// because Next.js route modules may only export handlers.

import { auditLog } from "@grc/db";
import { withAuditContext, type ApiContext } from "@/lib/api";

export interface ControlledCopyDownloadInfo {
  documentId: string;
  title: string;
  fileName: string;
  versionLabel: string | null;
  sha256: string | null;
  fileId?: string;
}

/** Write the "controlled copy issued" audit-log entry (who, when,
 *  which version) so controlled distribution is demonstrable. */
export async function recordControlledCopyDownload(
  ctx: ApiContext,
  info: ControlledCopyDownloadInfo,
): Promise<void> {
  await withAuditContext(ctx, async (tx) => {
    await tx.insert(auditLog).values({
      orgId: ctx.orgId,
      userId: ctx.userId,
      userEmail: ctx.session.user.email,
      userName: ctx.session.user.name,
      entityType: "document",
      entityId: info.documentId,
      entityTitle: info.title,
      action: "export",
      actionDetail: "controlled_copy_download",
      metadata: {
        fileName: info.fileName,
        fileId: info.fileId,
        versionLabel: info.versionLabel,
        sourceSha256: info.sha256,
        watermarked: true,
      },
    });
  });
}
