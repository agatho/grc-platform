import { db, processorAgreement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";
import { createProcessorAgreementSchema, ART_28_CHECKLIST_ITEMS } from "@grc/shared";

// GET /api/v1/dpms/processor-agreements — List processor agreements
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);
  const where = eq(processorAgreement.orgId, ctx.orgId);

  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(processorAgreement).where(where)
      .orderBy(desc(processorAgreement.createdAt)).limit(limit).offset(offset),
    db.select({ value: count() }).from(processorAgreement).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}

// POST /api/v1/dpms/processor-agreements — Create agreement with Art. 28(3) checklist
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createProcessorAgreementSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  // Initialize Art. 28(3) compliance checklist with 16 items (all status='missing')
  const defaultChecklist = ART_28_CHECKLIST_ITEMS.map((item) => ({
    requirement: item.requirement,
    article: item.article,
    category: item.category,
    status: "missing" as const,
    notes: "",
  }));

  const created = await withAuditContext(ctx, async (tx) => {
    const [item] = await tx.insert(processorAgreement).values({
      orgId: ctx.orgId,
      createdBy: ctx.userId,
      complianceChecklist: defaultChecklist,
      ...body.data,
    }).returning();
    return item;
  });

  return Response.json({ data: created }, { status: 201 });
}
