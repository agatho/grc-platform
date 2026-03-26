import { db, tia, user } from "@grc/db";
import { updateTiaSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/dpms/tia/:id — Full TIA detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select({
      id: tia.id,
      orgId: tia.orgId,
      workItemId: tia.workItemId,
      title: tia.title,
      transferCountry: tia.transferCountry,
      legalBasis: tia.legalBasis,
      schremsIiAssessment: tia.schremsIiAssessment,
      riskRating: tia.riskRating,
      supportingDocuments: tia.supportingDocuments,
      responsibleId: tia.responsibleId,
      responsibleName: user.name,
      assessmentDate: tia.assessmentDate,
      nextReviewDate: tia.nextReviewDate,
      createdAt: tia.createdAt,
      updatedAt: tia.updatedAt,
      createdBy: tia.createdBy,
    })
    .from(tia)
    .leftJoin(user, eq(tia.responsibleId, user.id))
    .where(
      and(
        eq(tia.id, id),
        eq(tia.orgId, ctx.orgId),
        isNull(tia.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PUT /api/v1/dpms/tia/:id — Update TIA
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(tia)
    .where(
      and(
        eq(tia.id, id),
        eq(tia.orgId, ctx.orgId),
        isNull(tia.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateTiaSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(tia)
      .set({
        ...body.data,
        updatedAt: new Date(),
      })
      .where(eq(tia.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
