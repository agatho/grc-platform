import { db, architectureElement } from "@grc/db";
import {
  createArchitectureElementSchema,
  VALID_LAYER_TYPES,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/eam/elements — Create architecture element
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createArchitectureElementSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Layer-type validation
  const validTypes = VALID_LAYER_TYPES[body.data.layer];
  if (!validTypes?.includes(body.data.type)) {
    return Response.json(
      {
        error: `Type '${body.data.type}' is not valid for layer '${body.data.layer}'. Valid types: ${validTypes?.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(architectureElement)
      .values({ ...body.data, orgId: ctx.orgId, createdBy: ctx.userId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
// GET /api/v1/eam/elements — List elements
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const layer = url.searchParams.get("layer");
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const conditions = [eq(architectureElement.orgId, ctx.orgId)];
  if (layer)
    conditions.push(
      eq(
        architectureElement.layer,
        layer as "business" | "application" | "technology",
      ),
    );
  if (type) conditions.push(eq(architectureElement.type, type as any));
  if (status) conditions.push(eq(architectureElement.status, status));

  const elements = await db
    .select()
    .from(architectureElement)
    .where(and(...conditions))
    .orderBy(desc(architectureElement.updatedAt))
    .limit(limit)
    .offset(offset);

  return Response.json({ data: elements });
});
