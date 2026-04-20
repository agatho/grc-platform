import { db, dpia, dpiaMeasure } from "@grc/db";
import { createDpiaMeasureSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/dpms/dpia/:id/measures — Add a measure to DPIA
export async function POST(
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
    .from(dpia)
    .where(
      and(eq(dpia.id, id), eq(dpia.orgId, ctx.orgId), isNull(dpia.deletedAt)),
    );

  if (!existing) {
    return Response.json({ error: "DPIA not found" }, { status: 404 });
  }

  const body = createDpiaMeasureSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(dpiaMeasure)
      .values({
        orgId: ctx.orgId,
        dpiaId: id,
        measureDescription: body.data.measureDescription,
        riskId: body.data.riskId ?? null,
        implementationTimeline: body.data.implementationTimeline,
        costOnetime: body.data.costOnetime
          ? String(body.data.costOnetime)
          : null,
        costAnnual: body.data.costAnnual ? String(body.data.costAnnual) : null,
        effortHours: body.data.effortHours
          ? String(body.data.effortHours)
          : null,
        costCurrency: body.data.costCurrency ?? "EUR",
        costNote: body.data.costNote ?? null,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/dpms/dpia/:id/measures — List measures for a DPIA
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const measures = await db
    .select()
    .from(dpiaMeasure)
    .where(and(eq(dpiaMeasure.dpiaId, id), eq(dpiaMeasure.orgId, ctx.orgId)));

  return Response.json({ data: measures });
}
