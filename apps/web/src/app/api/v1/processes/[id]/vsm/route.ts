// BPM Overhaul Phase 8: GET value_stream_map rows for a process.

import { db, process, valueStreamMap } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId), isNull(process.deletedAt)));
  if (!existing) return Response.json({ error: "Process not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(valueStreamMap)
    .where(and(eq(valueStreamMap.processId, id), eq(valueStreamMap.orgId, ctx.orgId)))
    .orderBy(desc(valueStreamMap.createdAt));

  return Response.json({ data: rows });
}
