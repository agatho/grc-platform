// BPM Overhaul Phase 2: Bulk-attach documents to a process.

import { db, process, document, processDocument } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const bulkSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(100),
  documentType: z
    .enum(["policy", "procedure", "guideline", "sop", "form", "other"])
    .optional(),
  linkContext: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "compliance_officer", "dpo");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId), isNull(process.deletedAt)));
  if (!existing) return Response.json({ error: "Process not found" }, { status: 404 });

  const parsed = bulkSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const validDocs = await db
    .select({ id: document.id })
    .from(document)
    .where(
      and(
        inArray(document.id, parsed.data.documentIds),
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );
  const validIds = new Set(validDocs.map((d) => d.id));
  const invalid = parsed.data.documentIds.filter((did) => !validIds.has(did));
  if (invalid.length) {
    return Response.json({ error: "Some documents not found", details: { invalid } }, { status: 422 });
  }

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const existingLinks = await tx
        .select({ documentId: processDocument.documentId })
        .from(processDocument)
        .where(
          and(
            eq(processDocument.processId, id),
            inArray(processDocument.documentId, parsed.data.documentIds),
          ),
        );
      const skip = new Set(existingLinks.map((l: any) => l.documentId));
      const toInsert = parsed.data.documentIds.filter((did) => !skip.has(did));
      if (toInsert.length === 0) {
        return { created: 0, skippedDuplicates: parsed.data.documentIds.length };
      }
      await tx.insert(processDocument).values(
        toInsert.map((did) => ({
          orgId: ctx.orgId,
          processId: id,
          documentId: did,
          documentType: parsed.data.documentType ?? null,
          linkContext: parsed.data.linkContext ?? null,
          createdBy: ctx.userId,
        })),
      );
      return { created: toInsert.length, skippedDuplicates: skip.size };
    },
    { actionDetail: `Bulk-attached ${parsed.data.documentIds.length} documents` },
  );

  return Response.json({ data: result }, { status: 201 });
}
