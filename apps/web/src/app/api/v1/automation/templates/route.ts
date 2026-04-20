import { db, automationRuleTemplate } from "@grc/db";
import { automationTemplateQuerySchema } from "@grc/shared";
import { eq, and, or, isNull, desc, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/automation/templates — List predefined templates (admin only)
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const query = automationTemplateQuerySchema.safeParse({
    category: searchParams.get("category") ?? undefined,
    page,
    limit,
  });

  // Templates visible: built-in (org_id IS NULL) + org-specific
  const conditions = [
    or(
      isNull(automationRuleTemplate.orgId),
      eq(automationRuleTemplate.orgId, ctx.orgId),
    ),
  ];

  if (query.success && query.data.category) {
    conditions.push(eq(automationRuleTemplate.category, query.data.category));
  }

  const rows = await db
    .select()
    .from(automationRuleTemplate)
    .where(and(...conditions))
    .orderBy(
      desc(automationRuleTemplate.isBuiltIn),
      automationRuleTemplate.name,
    )
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(automationRuleTemplate)
    .where(and(...conditions));

  return paginatedResponse(rows, total, page, limit);
}
