import { db, frameworkMappingRule } from "@grc/db";
import { createMappingRuleSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
  requirePlatformAdmin,
} from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  // #WP3-S02-03 (Critical) — diese Tabelle hat KEIN `org_id`, keine RLS und
  // keine Policy; eine Änderung wirkt auf ALLE Mandanten. Der bisherige Guard
  // `withAuth("admin")` (bei framework-mappings sogar `risk_manager`) ist eine
  // PRO-ORGANISATION vergebene Rolle — jeder Mandanten-Admin konnte damit
  // Feature-, Abrechnungs- und Data-Sovereignty-Konfiguration aller Mandanten
  // verändern. Schreibzugriff verlangt jetzt einen Plattform-Admin
  // (Tabelle `platform_admin`, Migration 0411; nicht über die API vergebbar).
  const platformCheck = await requirePlatformAdmin(ctx);
  if (platformCheck) return platformCheck;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const body = createMappingRuleSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(frameworkMappingRule)
      .values({
        orgId: ctx.orgId,
        ...body.data,
        confidence: body.data.confidence
          ? String(body.data.confidence)
          : undefined,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });
  return Response.json({ data: created }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { page, limit, offset } = paginate(req);
  const where = eq(frameworkMappingRule.orgId, ctx.orgId);
  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(frameworkMappingRule)
      .where(where)
      .orderBy(desc(frameworkMappingRule.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(frameworkMappingRule).where(where),
  ]);
  return paginatedResponse(items, total, page, limit);
}
