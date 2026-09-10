// GET /api/v1/whistleblowing/audit-log — Zugriffsprotokoll der Meldestelle
//
// ── ARCTOS-FULL-2026-08-31 · WP8 · S07-21 (Low), S07-09 (High) ───────
//
// `apps/web/src/app/api/v1/audit-log/route.ts:19-21` verweist seit jeher
// auf diese Route:
//
//   // The whistleblowing_audit_log table is a separate relation and is
//   // NEVER returned by this endpoint — only the whistleblowing role can
//   // access it via /api/v1/whistleblowing/audit-log.
//
// Die Route existierte nicht. `whistleblowing_audit_log` wurde
// ausschliesslich vom Trigger befüllt und von nichts gelesen: die
// Meldestelle hatte keinen Zugang zu ihrem eigenen Zugriffsprotokoll, und
// die in ADR-011 rev.2 D3 vorgesehene Nachvollziehbarkeit ("wer hat auf
// diesen Fall zugegriffen") war praktisch nicht verfügbar. Zugleich
// verdeckte genau dieser Kommentar die eigentliche Lücke (S07-01): der
// Inhalt stand über den generischen Trigger ohnehin im org-weiten Log.
//
// Zugriff: `whistleblowing_officer` und `ombudsperson` — und zwar nur
// diese beiden, wie ADR-011 rev.2 §82-83 es vorschreibt. `admin` stand
// entgegen der eigenen Spezifikation in der RLS-Allowlist; Migration 0426
// hat ihn dort entfernt (S07-09), diese Route wiederholt den Schnitt auf
// Anwendungsebene.
//
// Was die Antwort NICHT enthält: den Klarnamen der handelnden Person. Der
// `actor_hash` ist seit Migration 0426 ein HMAC unter einem Schlüssel
// ausserhalb der Datenbank (S07-08) — vorher war er
// `sha256(user_id || '|' || case_id)` mit der `case_id` als Nachbarspalte
// und damit in Sekunden auf die Person zurückzurechnen. Wer wirklich
// wissen muss, wer gehandelt hat, braucht den Schlüssel; das ist ein
// bewusster Bruch mit der Bequemlichkeit zugunsten von HinSchG §8.

import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

interface AuditRow {
  id: string;
  case_id: string;
  actor_role: string | null;
  actor_hash: string;
  actor_key_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  created_at: string;
  hash_version: number;
}

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("whistleblowing_officer", "ombudsperson");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("whistleblowing", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId");
  const limitRaw = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500)
    : 100;
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(offsetRaw)
    ? Math.max(Math.trunc(offsetRaw), 0)
    : 0;

  if (caseId && !/^[0-9a-f-]{36}$/i.test(caseId)) {
    return Response.json({ error: "Invalid caseId" }, { status: 422 });
  }

  // Die Mandanten- und Rollengrenze liegt in der RLS-Policy
  // `wb_audit_log_officer_read` (Migration 0426); der Filter hier ist die
  // zweite Verteidigungslinie, nicht die erste.
  const rows = (await db.execute(sql`
    SELECT id, case_id, actor_role, actor_hash, actor_key_id,
           entity_type, entity_id, action::text AS action,
           created_at, hash_version
      FROM whistleblowing_audit_log
     WHERE org_id = ${ctx.orgId}::uuid
       ${caseId ? sql`AND case_id = ${caseId}::uuid` : sql``}
     ORDER BY created_at DESC
     LIMIT ${limit} OFFSET ${offset}
  `)) as unknown as AuditRow[];

  const list = (
    Array.isArray(rows)
      ? rows
      : ((rows as unknown as { rows?: unknown[] }).rows ?? [])
  ) as AuditRow[];

  return Response.json({
    data: list.map((r) => ({
      id: r.id,
      caseId: r.case_id,
      actorRole: r.actor_role,
      // Bewusst gekürzt: der volle Hash ist ein stabiler Wiedererkennungs-
      // wert über alle Fälle hinweg und damit selbst ein Pseudonym, das
      // niemand für die Nachvollziehbarkeit eines EINZELNEN Falls braucht.
      actorRef: `${r.actor_hash.slice(0, 16)}…`,
      actorKeyId: r.actor_key_id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      createdAt: r.created_at,
      hashVersion: r.hash_version,
    })),
    meta: {
      limit,
      offset,
      note:
        "Actor identities are pseudonymised (HMAC under a key held outside the database, HinSchG §8). " +
        "Re-identification requires the key and a documented dual-control process.",
    },
  });
});
