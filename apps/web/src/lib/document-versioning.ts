// DMS D1 — DB-side versioning helper.
//
// Single place that creates document_version rows so PUT /documents/[id]
// (minor bump on draft content edit), PUT /documents/[id]/status
// (major bump on publish) and POST .../versions/[versionId]/restore
// all share the same effective-dating semantics:
//   - the outgoing current version gets validUntil = now, isCurrent = false
//   - the new version gets validFrom = now, isCurrent = true
//   - major/minor/label computed via @grc/shared computeNextVersion
//   - document_file rows not yet pinned to a version are stamped with
//     the outgoing version id (they were uploaded while it was current)
//
// Pure numbering / point-in-time logic lives in @grc/shared
// (packages/shared/src/document-control.ts) and is re-exported here.

import { db, documentVersion, documentFile } from "@grc/db";
import { and, eq, isNull, desc } from "drizzle-orm";
import { computeNextVersion, type DocumentVersionBump } from "@grc/shared";

export {
  computeNextVersion,
  formatVersionLabel,
  resolveVersionAt,
  type DocumentVersionBump,
  type DocumentVersionNumbers,
} from "@grc/shared";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface DocumentFileSnapshot {
  fileName: string | null;
  filePath: string | null;
  fileSize: number | null;
  mimeType: string | null;
  fileSha256: string | null;
}

export interface CreateDocumentVersionParams {
  documentId: string;
  orgId: string;
  userId: string;
  bump: DocumentVersionBump;
  content: string | null;
  changeSummary: string;
  /** File snapshot carried into the new version (defaults to none). */
  file?: DocumentFileSnapshot | null;
  now?: Date;
}

export interface CreatedDocumentVersion {
  id: string;
  versionNumber: number;
  versionMajor: number;
  versionMinor: number;
  versionLabel: string;
  validFrom: Date;
}

/**
 * Create a new document version inside an existing transaction.
 * Returns the new version numbers so the caller can sync
 * document.currentVersion.
 */
export async function createDocumentVersion(
  tx: Tx,
  params: CreateDocumentVersionParams,
): Promise<CreatedDocumentVersion> {
  const now = params.now ?? new Date();

  // Latest version = numbering base (also covers rows where isCurrent
  // got out of sync — versionNumber is the authoritative sequence).
  const [latest] = await tx
    .select({
      id: documentVersion.id,
      versionNumber: documentVersion.versionNumber,
      versionMajor: documentVersion.versionMajor,
      versionMinor: documentVersion.versionMinor,
    })
    .from(documentVersion)
    .where(
      and(
        eq(documentVersion.documentId, params.documentId),
        eq(documentVersion.orgId, params.orgId),
      ),
    )
    .orderBy(desc(documentVersion.versionNumber))
    .limit(1);

  const next = computeNextVersion(
    latest ?? { versionNumber: 0, versionMajor: 0, versionMinor: 0 },
    params.bump,
  );

  // Close the effective-dating window of the current version(s)
  await tx
    .update(documentVersion)
    .set({ isCurrent: false, validUntil: now })
    .where(
      and(
        eq(documentVersion.documentId, params.documentId),
        eq(documentVersion.isCurrent, true),
      ),
    );

  // Pin not-yet-versioned files to the outgoing version so the version
  // history shows which files belonged to which version.
  if (latest) {
    await tx
      .update(documentFile)
      .set({ versionId: latest.id, updatedAt: now })
      .where(
        and(
          eq(documentFile.documentId, params.documentId),
          isNull(documentFile.versionId),
          isNull(documentFile.deletedAt),
        ),
      );
  }

  const [inserted] = await tx
    .insert(documentVersion)
    .values({
      documentId: params.documentId,
      orgId: params.orgId,
      versionNumber: next.versionNumber,
      content: params.content,
      changeSummary: params.changeSummary,
      isCurrent: true,
      validFrom: now,
      validUntil: null,
      versionLabel: next.versionLabel,
      versionMajor: next.versionMajor,
      versionMinor: next.versionMinor,
      fileName: params.file?.fileName ?? null,
      filePath: params.file?.filePath ?? null,
      fileSize: params.file?.fileSize ?? null,
      mimeType: params.file?.mimeType ?? null,
      fileSha256: params.file?.fileSha256 ?? null,
      createdBy: params.userId,
      createdAt: now,
    })
    .returning({ id: documentVersion.id });

  return {
    id: inserted.id,
    versionNumber: next.versionNumber,
    versionMajor: next.versionMajor,
    versionMinor: next.versionMinor,
    versionLabel: next.versionLabel,
    validFrom: now,
  };
}
