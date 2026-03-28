import { db, auditWorkingPaper, auditWpFolder } from "@grc/db";
import { createWorkingPaperSchema, generateWpReference } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/audit-mgmt/working-papers?auditId=...
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const auditId = url.searchParams.get("auditId");
  if (!auditId) return Response.json({ error: "auditId required" }, { status: 400 });

  const { limit, offset } = paginate(url.searchParams);

  const rows = await db
    .select()
    .from(auditWorkingPaper)
    .where(and(eq(auditWorkingPaper.orgId, ctx.orgId), eq(auditWorkingPaper.auditId, auditId)))
    .orderBy(desc(auditWorkingPaper.createdAt))
    .limit(limit)
    .offset(offset);

  return paginatedResponse(rows, rows.length, limit, offset);
}

// POST /api/v1/audit-mgmt/working-papers
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const auditId = url.searchParams.get("auditId");
  if (!auditId) return Response.json({ error: "auditId required" }, { status: 400 });

  const body = createWorkingPaperSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    // Get folder code
    const [folder] = await tx
      .select({ code: auditWpFolder.code })
      .from(auditWpFolder)
      .where(eq(auditWpFolder.id, body.data.folderId));

    if (!folder) {
      throw new Error("Folder not found");
    }

    // Get existing references in this folder for auto-generation
    const existingWps = await tx
      .select({ reference: auditWorkingPaper.reference })
      .from(auditWorkingPaper)
      .where(and(eq(auditWorkingPaper.auditId, auditId), eq(auditWorkingPaper.folderId, body.data.folderId)));

    const reference = generateWpReference(folder.code, existingWps.map((w) => w.reference));

    const [row] = await tx
      .insert(auditWorkingPaper)
      .values({
        orgId: ctx.orgId,
        auditId,
        folderId: body.data.folderId,
        reference,
        title: body.data.title,
        objective: body.data.objective,
        scope: body.data.scope,
        procedurePerformed: body.data.procedurePerformed,
        results: body.data.results,
        conclusion: body.data.conclusion,
        evidenceDocumentIds: body.data.evidenceDocumentIds,
        crossReferenceWpIds: body.data.crossReferenceWpIds,
        crossReferenceFindingIds: body.data.crossReferenceFindingIds,
        preparedBy: ctx.userId,
        preparedAt: new Date(),
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
