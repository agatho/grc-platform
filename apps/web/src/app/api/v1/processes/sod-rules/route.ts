// /api/v1/processes/sod-rules — die Regelmenge der Aufgabentrennung.
//
// [ARCTOS-FULL-2026-08-31 · OP-001] `sod_rule` (0446) ist von den zehn
// Tabellen die einzige, die **kein** Importpfad je füllen kann: eine
// Unverträglichkeit zweier fachlicher Aufgaben steht in keinem BPMN-XML und
// in keinem Ereignisprotokoll. Ohne diese Maske war Layer F3 (`sod`) tot —
// gemessen 0 Zeilen, auch in der geseedeten Datenbank.
//
// Mandantenweit, nicht prozessbezogen: eine Regel gilt zwischen zwei Rollen,
// unabhängig davon, in welchem Diagramm sie sich treffen (so liest sie auch
// der Overlay-Endpunkt). Sie liegt trotzdem unter `/processes`, weil sie
// ausschliesslich dort wirkt.

import { db, sodRule, customRole } from "@grc/db";
import { createSodRuleSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { and, asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const roleA = alias(customRole, "roleA");
const roleB = alias(customRole, "roleB");

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "process_owner",
    "risk_manager",
    "control_owner",
    "compliance_officer",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(sodRule)
    .where(eq(sodRule.orgId, ctx.orgId));

  const rows = await db
    .select({
      id: sodRule.id,
      roleAId: sodRule.roleAId,
      roleAName: roleA.name,
      roleBId: sodRule.roleBId,
      roleBName: roleB.name,
      severity: sodRule.severity,
      rationale: sodRule.rationale,
      frameworkRef: sodRule.frameworkRef,
      isActive: sodRule.isActive,
      updatedAt: sodRule.updatedAt,
    })
    .from(sodRule)
    .leftJoin(roleA, eq(sodRule.roleAId, roleA.id))
    .leftJoin(roleB, eq(sodRule.roleBId, roleB.id))
    .where(eq(sodRule.orgId, ctx.orgId))
    .orderBy(asc(roleA.name), asc(roleB.name))
    .limit(limit)
    .offset(offset);

  const roles = await db
    .select({ id: customRole.id, name: customRole.name })
    .from(customRole)
    .where(eq(customRole.orgId, ctx.orgId))
    .orderBy(asc(customRole.name));

  return Response.json({
    data: rows,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
    },
    options: { roles },
  });
});

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "compliance_officer", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const parsed = createSodRuleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const v = parsed.data;

  const known = await db
    .select({ id: customRole.id })
    .from(customRole)
    .where(eq(customRole.orgId, ctx.orgId));
  const knownIds = new Set(known.map((r) => r.id));
  if (!knownIds.has(v.roleAId) || !knownIds.has(v.roleBId)) {
    return Response.json({ error: "Unknown role" }, { status: 422 });
  }

  // Das ungeordnete Paar ist eindeutig (`sod_rule_pair_uniq` in 0446): ohne
  // die Prüfung liefen (A,B) und (B,A) beide durch, und `computeSod` fände
  // jeden Konflikt zweimal — die Kopfzeile meldete „2 Konflikte" für einen.
  // Die Datenbank hält das ohnehin; hier wird nur ein 409 daraus statt eines
  // 500, damit die Maske es dem Benutzer sagen kann.
  const [existing] = await db
    .select({ id: sodRule.id })
    .from(sodRule)
    .where(
      and(
        eq(sodRule.orgId, ctx.orgId),
        sql`LEAST(${sodRule.roleAId}, ${sodRule.roleBId}) = LEAST(${v.roleAId}::uuid, ${v.roleBId}::uuid)`,
        sql`GREATEST(${sodRule.roleAId}, ${sodRule.roleBId}) = GREATEST(${v.roleAId}::uuid, ${v.roleBId}::uuid)`,
      ),
    );
  if (existing) {
    return Response.json(
      { error: "A rule for this role pair already exists" },
      { status: 409 },
    );
  }

  const created = await withAuditContext(
    ctx,
    async (tx) => {
      const [row] = await tx
        .insert(sodRule)
        .values({
          orgId: ctx.orgId,
          roleAId: v.roleAId,
          roleBId: v.roleBId,
          severity: v.severity,
          rationale: v.rationale ?? null,
          frameworkRef: v.frameworkRef ?? null,
          isActive: v.isActive,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning();
      return row;
    },
    { actionDetail: "SoD rule created" },
  );

  return Response.json({ data: created }, { status: 201 });
});
