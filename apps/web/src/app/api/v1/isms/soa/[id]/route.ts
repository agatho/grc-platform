import { db, soaEntry, catalogEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateSoaEntrySchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { syncSoaEntryToProgramme } from "@grc/db";

// GET /api/v1/isms/soa/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select({
      id: soaEntry.id,
      orgId: soaEntry.orgId,
      catalogEntryId: soaEntry.catalogEntryId,
      controlId: soaEntry.controlId,
      applicability: soaEntry.applicability,
      applicabilityJustification: soaEntry.applicabilityJustification,
      implementation: soaEntry.implementation,
      implementationNotes: soaEntry.implementationNotes,
      responsibleId: soaEntry.responsibleId,
      lastReviewed: soaEntry.lastReviewed,
      createdAt: soaEntry.createdAt,
      updatedAt: soaEntry.updatedAt,
      catalogCode: catalogEntry.code,
      catalogTitleDe: catalogEntry.nameDe,
      catalogTitleEn: catalogEntry.name,
      catalogDescriptionDe: catalogEntry.descriptionDe,
      catalogDescriptionEn: catalogEntry.description,
    })
    .from(soaEntry)
    .leftJoin(catalogEntry, eq(soaEntry.catalogEntryId, catalogEntry.id))
    .where(and(eq(soaEntry.id, id), eq(soaEntry.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "SoA entry not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PUT /api/v1/isms/soa/[id]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();

  const parsed = updateSoaEntrySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(soaEntry)
    .where(and(eq(soaEntry.id, id), eq(soaEntry.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "SoA entry not found" }, { status: 404 });
  }

  const data = parsed.data;
  const result = await withAuditContext(ctx, async (tx) => {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      lastReviewed: new Date(),
    };
    if (data.controlId !== undefined) updates.controlId = data.controlId;
    if (data.applicability !== undefined)
      updates.applicability = data.applicability;
    if (data.applicabilityJustification !== undefined)
      updates.applicabilityJustification = data.applicabilityJustification;
    if (data.implementation !== undefined)
      updates.implementation = data.implementation;
    if (data.implementationNotes !== undefined)
      updates.implementationNotes = data.implementationNotes;
    if (data.responsibleId !== undefined)
      updates.responsibleId = data.responsibleId;

    const [updated] = await tx
      .update(soaEntry)
      .set(updates)
      .where(eq(soaEntry.id, id))
      .returning();
    return updated;
  });

  // Project the SoA change into the active ISO 27001 journey (idempotent).
  let syncResult: Awaited<ReturnType<typeof syncSoaEntryToProgramme>> | null =
    null;
  try {
    syncResult = await syncSoaEntryToProgramme(
      db,
      ctx.orgId,
      id,
      ctx.userId,
    );
  } catch (err) {
    console.error("[soa PUT] sync failed for", id, err);
  }

  return Response.json({ data: result, sync: syncResult });
}
