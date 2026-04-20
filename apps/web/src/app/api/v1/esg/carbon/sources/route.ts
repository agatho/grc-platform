import { db, emissionSource } from "@grc/db";
import { createEmissionSourceSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { limit, offset } = paginate(new URL(req.url).searchParams);
  const rows = await db
    .select()
    .from(emissionSource)
    .where(eq(emissionSource.orgId, ctx.orgId))
    .orderBy(desc(emissionSource.createdAt))
    .limit(limit)
    .offset(offset);
  return paginatedResponse(rows, rows.length, limit, offset);
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const body = createEmissionSourceSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(emissionSource)
      .values({ orgId: ctx.orgId, ...body.data })
      .returning();
    return row;
  });
  return Response.json({ data: created }, { status: 201 });
}
