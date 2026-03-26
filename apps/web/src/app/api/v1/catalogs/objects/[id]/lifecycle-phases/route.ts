import { db, catalogLifecyclePhase, generalCatalogEntry } from "@grc/db";
import { createLifecyclePhaseSchema } from "@grc/shared";
import { eq, and, isNull, asc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/catalogs/objects/[id]/lifecycle-phases — List phases for object
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Verify object exists in this org
  const [obj] = await db
    .select({ id: generalCatalogEntry.id })
    .from(generalCatalogEntry)
    .where(
      and(
        eq(generalCatalogEntry.id, id),
        eq(generalCatalogEntry.orgId, ctx.orgId),
        isNull(generalCatalogEntry.deletedAt),
      ),
    );

  if (!obj) {
    return Response.json({ error: "Object not found" }, { status: 404 });
  }

  const phases = await db
    .select()
    .from(catalogLifecyclePhase)
    .where(
      and(
        eq(catalogLifecyclePhase.entityId, id),
        eq(catalogLifecyclePhase.entityType, "general_catalog_entry"),
        eq(catalogLifecyclePhase.orgId, ctx.orgId),
      ),
    )
    .orderBy(asc(catalogLifecyclePhase.startDate));

  return Response.json({ data: phases });
}

// POST /api/v1/catalogs/objects/[id]/lifecycle-phases — Create phase
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Verify object exists in this org
  const [obj] = await db
    .select({ id: generalCatalogEntry.id })
    .from(generalCatalogEntry)
    .where(
      and(
        eq(generalCatalogEntry.id, id),
        eq(generalCatalogEntry.orgId, ctx.orgId),
        isNull(generalCatalogEntry.deletedAt),
      ),
    );

  if (!obj) {
    return Response.json({ error: "Object not found" }, { status: 404 });
  }

  const body = createLifecyclePhaseSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(catalogLifecyclePhase)
      .values({
        orgId: ctx.orgId,
        entityType: "general_catalog_entry",
        entityId: id,
        phaseName: body.data.phaseName,
        startDate: body.data.startDate,
        endDate: body.data.endDate,
        notes: body.data.notes,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
