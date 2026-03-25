import { db, process, processDocument } from "@grc/db";
import { linkProcessDocumentSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/processes/:id/documents — Link document to process
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = linkProcessDocumentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Check duplicate
  const [duplicate] = await db
    .select({ id: processDocument.id })
    .from(processDocument)
    .where(
      and(
        eq(processDocument.processId, id),
        eq(processDocument.documentId, body.data.documentId),
      ),
    );

  if (duplicate) {
    return Response.json(
      { error: "Document is already linked to this process" },
      { status: 409 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(processDocument)
      .values({
        orgId: ctx.orgId,
        processId: id,
        documentId: body.data.documentId,
        documentType: body.data.documentType,
        linkContext: body.data.linkContext,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/processes/:id/documents — List documents linked to process
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // No join since document table doesn't exist yet (Sprint 4)
  const documents = await db
    .select({
      linkId: processDocument.id,
      documentId: processDocument.documentId,
      documentType: processDocument.documentType,
      linkContext: processDocument.linkContext,
      createdAt: processDocument.createdAt,
    })
    .from(processDocument)
    .where(eq(processDocument.processId, id));

  return Response.json({ data: documents });
}
