import { db, eamAiPromptTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updatePromptSchema } from "@grc/shared";
import { eq, and, or, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/ai/prompts — List all prompt templates
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const templates = await db
    .select()
    .from(eamAiPromptTemplate)
    .where(
      and(
        eq(eamAiPromptTemplate.isActive, true),
        or(
          isNull(eamAiPromptTemplate.orgId),
          eq(eamAiPromptTemplate.orgId, ctx.orgId),
        ),
      ),
    );

  // Merge: org override wins over system default
  const merged = new Map<
    string,
    (typeof templates)[0] & { isCustom: boolean }
  >();
  for (const t of templates) {
    const existing = merged.get(t.templateKey);
    if (!existing || t.orgId !== null) {
      merged.set(t.templateKey, { ...t, isCustom: t.orgId !== null });
    }
  }

  return Response.json({ data: [...merged.values()] });
}

// PUT /api/v1/eam/ai/prompts/:key — Override prompt template for org
export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) return Response.json({ error: "key required" }, { status: 400 });

  const body = await req.json();
  const parsed = updatePromptSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  // Check if org override already exists
  const existing = await db
    .select()
    .from(eamAiPromptTemplate)
    .where(
      and(
        eq(eamAiPromptTemplate.orgId, ctx.orgId),
        eq(eamAiPromptTemplate.templateKey, key),
      ),
    )
    .limit(1);

  let result;
  if (existing.length) {
    result = await db
      .update(eamAiPromptTemplate)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eamAiPromptTemplate.id, existing[0].id))
      .returning();
  } else {
    result = await db
      .insert(eamAiPromptTemplate)
      .values({
        orgId: ctx.orgId,
        templateKey: key,
        templateText: parsed.data.templateText,
        variables: parsed.data.variables ?? [],
      })
      .returning();
  }

  return Response.json({ data: result[0] });
}
