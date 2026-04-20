import { db, bowtieElement, bowtiePath } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { saveBowtieSchema } from "@grc/shared";

// GET /api/v1/erm/bowtie/:riskId — Get bow-tie data for risk
export async function GET(
  req: Request,
  { params }: { params: Promise<{ riskId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { riskId } = await params;

  const [elements, paths] = await Promise.all([
    db
      .select()
      .from(bowtieElement)
      .where(
        and(
          eq(bowtieElement.riskId, riskId),
          eq(bowtieElement.orgId, ctx.orgId),
        ),
      )
      .orderBy(bowtieElement.sortOrder),
    db
      .select()
      .from(bowtiePath)
      .where(eq(bowtiePath.riskId, riskId))
      .orderBy(bowtiePath.sortOrder),
  ]);

  return Response.json({ data: { riskId, elements, paths } });
}

// PUT /api/v1/erm/bowtie/:riskId — Save bow-tie (full replace)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ riskId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { riskId } = await params;
  const body = saveBowtieSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Delete existing bow-tie data
    await tx.delete(bowtiePath).where(eq(bowtiePath.riskId, riskId));
    await tx
      .delete(bowtieElement)
      .where(
        and(
          eq(bowtieElement.riskId, riskId),
          eq(bowtieElement.orgId, ctx.orgId),
        ),
      );

    // Insert new elements
    const insertedElements = [];
    for (const elem of body.data.elements) {
      const [inserted] = await tx
        .insert(bowtieElement)
        .values({
          orgId: ctx.orgId,
          riskId,
          ...elem,
        })
        .returning();
      insertedElements.push(inserted);
    }

    // Insert paths
    for (const path of body.data.paths) {
      await tx.insert(bowtiePath).values({ riskId, ...path });
    }

    return insertedElements;
  });

  return Response.json({ data: result });
}
