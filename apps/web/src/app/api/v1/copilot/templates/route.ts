import { db, copilotPromptTemplate } from "@grc/db";
import { createPromptTemplateSchema, promptTemplateQuerySchema } from "@grc/shared";
import { eq, and, or, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/copilot/templates — Create prompt template
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createPromptTemplateSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(copilotPromptTemplate)
      .values({ ...body.data, orgId: ctx.orgId, createdBy: ctx.userId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/copilot/templates — List prompt templates (org + platform)
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner", "auditor", "dpo", "viewer");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = promptTemplateQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) {
    return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });
  }

  const conditions = [
    or(eq(copilotPromptTemplate.orgId, ctx.orgId), isNull(copilotPromptTemplate.orgId)),
  ];

  if (query.data.category) conditions.push(eq(copilotPromptTemplate.category, query.data.category));
  if (query.data.moduleKey) conditions.push(eq(copilotPromptTemplate.moduleKey, query.data.moduleKey));
  if (query.data.isActive !== undefined) conditions.push(eq(copilotPromptTemplate.isActive, query.data.isActive));

  const templates = await db
    .select()
    .from(copilotPromptTemplate)
    .where(and(...conditions));

  return Response.json({ data: templates });
}
