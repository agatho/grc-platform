// BPM Overhaul Phase 3: Three-Lines-of-Defense distribution per process.

import { db, process, processStep } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select({
      id: process.id,
      defaultLineOfDefense: process.defaultLineOfDefense,
    })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const dist = await db
    .select({
      lineOfDefense: processStep.lineOfDefense,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(processStep)
    .where(and(eq(processStep.processId, id), isNull(processStep.deletedAt)))
    .groupBy(processStep.lineOfDefense);

  const buckets = {
    first: 0,
    second: 0,
    third: 0,
    oversight: 0,
    unassigned: 0,
  };
  for (const row of dist) {
    const key = (row.lineOfDefense ?? "unassigned") as keyof typeof buckets;
    buckets[key] = (buckets[key] ?? 0) + row.count;
  }

  const total = Object.values(buckets).reduce((a, b) => a + b, 0);

  return Response.json({
    data: {
      processId: id,
      defaultLineOfDefense: existing.defaultLineOfDefense,
      counts: buckets,
      totalActivities: total,
      coveragePct:
        total === 0
          ? 0
          : Math.round(((total - buckets.unassigned) / total) * 100),
    },
  });
}
