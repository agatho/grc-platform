import { db, horizonScanItem } from "@grc/db";
import { horizonItemQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "dpo",
    "risk_manager",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const query = horizonItemQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success)
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );

  const {
    page,
    limit,
    classification,
    itemType,
    status,
    jurisdiction,
    since,
    framework,
  } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(horizonScanItem.orgId, ctx.orgId)];
  if (classification)
    conditions.push(eq(horizonScanItem.classification, classification));
  if (itemType) conditions.push(eq(horizonScanItem.itemType, itemType));
  if (status) conditions.push(eq(horizonScanItem.status, status));
  if (jurisdiction)
    conditions.push(eq(horizonScanItem.jurisdiction, jurisdiction));
  if (since) conditions.push(gte(horizonScanItem.publishedAt, new Date(since)));

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(horizonScanItem)
      .where(and(...conditions))
      .orderBy(desc(horizonScanItem.publishedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(horizonScanItem)
      .where(and(...conditions)),
  ]);
  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
