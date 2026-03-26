import {
  db,
  document,
  control,
  risk,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  ilike,
  or,
  desc,
} from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/search — Full-text search across documents, controls, risks
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = url.searchParams.get("q");
  const entityTypes = url.searchParams.get("types")?.split(",") ?? ["document", "control", "risk"];
  const limitParam = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));

  if (!query || query.trim().length < 2) {
    return Response.json(
      { error: "Query parameter 'q' must be at least 2 characters" },
      { status: 422 },
    );
  }

  const pattern = `%${query}%`;
  const results: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    status: string;
    updatedAt: Date;
  }> = [];

  // Search documents
  if (entityTypes.includes("document")) {
    const dmsCheck = await requireModule("dms", ctx.orgId, req.method);
    if (!dmsCheck) {
      const docs = await db
        .select({
          id: document.id,
          title: document.title,
          description: document.content,
          status: document.status,
          updatedAt: document.updatedAt,
        })
        .from(document)
        .where(
          and(
            eq(document.orgId, ctx.orgId),
            isNull(document.deletedAt),
            or(
              ilike(document.title, pattern),
              ilike(document.content, pattern),
            ),
          ),
        )
        .orderBy(desc(document.updatedAt))
        .limit(limitParam);

      results.push(
        ...docs.map((d) => ({
          ...d,
          type: "document" as const,
          description: d.description ? d.description.substring(0, 200) : null,
        })),
      );
    }
  }

  // Search controls
  if (entityTypes.includes("control")) {
    const icsCheck = await requireModule("ics", ctx.orgId, req.method);
    if (!icsCheck) {
      const controls = await db
        .select({
          id: control.id,
          title: control.title,
          description: control.description,
          status: control.status,
          updatedAt: control.updatedAt,
        })
        .from(control)
        .where(
          and(
            eq(control.orgId, ctx.orgId),
            isNull(control.deletedAt),
            or(
              ilike(control.title, pattern),
              ilike(control.description, pattern),
            ),
          ),
        )
        .orderBy(desc(control.updatedAt))
        .limit(limitParam);

      results.push(
        ...controls.map((c) => ({
          ...c,
          type: "control" as const,
          description: c.description ? c.description.substring(0, 200) : null,
        })),
      );
    }
  }

  // Search risks
  if (entityTypes.includes("risk")) {
    const ermCheck = await requireModule("erm", ctx.orgId, req.method);
    if (!ermCheck) {
      const risks = await db
        .select({
          id: risk.id,
          title: risk.title,
          description: risk.description,
          status: risk.status,
          updatedAt: risk.updatedAt,
        })
        .from(risk)
        .where(
          and(
            eq(risk.orgId, ctx.orgId),
            isNull(risk.deletedAt),
            or(
              ilike(risk.title, pattern),
              ilike(risk.description, pattern),
            ),
          ),
        )
        .orderBy(desc(risk.updatedAt))
        .limit(limitParam);

      results.push(
        ...risks.map((r) => ({
          ...r,
          type: "risk" as const,
          description: r.description ? r.description.substring(0, 200) : null,
        })),
      );
    }
  }

  // Sort all results by updatedAt descending
  results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return Response.json({
    data: {
      query,
      totalResults: results.length,
      results: results.slice(0, limitParam),
    },
  });
}
