import { db, threat } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createThreatSchema } from "@grc/shared";
import { eq, and, ilike } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// GET /api/v1/isms/threats
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const categoryFilter = searchParams.get("category");
  const search = searchParams.get("search");

  const conditions = [eq(threat.orgId, ctx.orgId)];
  if (categoryFilter) {
    conditions.push(eq(threat.threatCategory, categoryFilter));
  }
  if (search) {
    conditions.push(ilike(threat.title, `%${search}%`));
  }

  const rows = await db
    .select()
    .from(threat)
    .where(and(...conditions))
    .orderBy(threat.createdAt)
    .limit(limit)
    .offset(offset);

  const allRows = await db
    .select({ id: threat.id })
    .from(threat)
    .where(and(...conditions));

  return paginatedResponse(rows, allRows.length, page, limit);
}

// POST /api/v1/isms/threats
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createThreatSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(threat)
      .values({
        orgId: ctx.orgId,
        title: data.title,
        description: data.description ?? null,
        threatCategory: data.threatCategory ?? null,
        likelihoodRating: data.likelihoodRating ?? null,
        catalogEntryId: data.catalogEntryId ?? null,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
