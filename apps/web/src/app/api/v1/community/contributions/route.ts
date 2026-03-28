import { db, communityContribution } from "@grc/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createContributionSchema, listContributionsQuerySchema } from "@grc/shared";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listContributionsQuerySchema.parse(Object.fromEntries(url.searchParams));
  const conditions: ReturnType<typeof eq>[] = [eq(communityContribution.orgId, ctx.orgId)];
  if (query.contributionType) conditions.push(eq(communityContribution.contributionType, query.contributionType));
  if (query.status) conditions.push(eq(communityContribution.status, query.status));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(communityContribution).where(and(...conditions))
      .orderBy(desc(communityContribution.createdAt)).limit(query.limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(communityContribution).where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const body = createContributionSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(communityContribution).values({
      orgId: ctx.orgId, contributorId: ctx.userId, ...body,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
