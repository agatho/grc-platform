import { db, evidenceArtifact } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc, count } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";

// GET /api/v1/connectors/:id/artifacts — List artifacts for a connector
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(evidenceArtifact.connectorId, id),
    eq(evidenceArtifact.orgId, ctx.orgId),
  ];

  const artifactType = searchParams.get("artifactType");
  if (artifactType) {
    conditions.push(eq(evidenceArtifact.artifactType, artifactType));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(evidenceArtifact).where(where).orderBy(desc(evidenceArtifact.collectedAt)).limit(limit).offset(offset),
    db.select({ value: count() }).from(evidenceArtifact).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
