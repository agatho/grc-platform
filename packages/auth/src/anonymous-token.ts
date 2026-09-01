// #WP3-S02-05 — Auflösung anonymer Zugangstoken unter der Laufzeitrolle grc_app
//
// Befund S02-05 (High, per SQL reproduziert): jeder anonyme Token-Endpunkt
// (Invite-Annahme, SCIM, Vendor-DD-Portal, HinSchG-Postfach, iCal-Feed,
// Branding-CSS) liest seine Zugangstabelle OHNE Org-Kontext — es kann keinen
// geben, weil die Organisation erst AUS dem Token folgt. Unter `grc_app`
// (rolsuper=f, rolbypassrls=f) filtern die FORCE-RLS-Policies jede dieser
// Abfragen auf 0 Zeilen. Ein gültiges Token war von einem ungültigen nicht
// unterscheidbar; Einladungen konnten nie angenommen, ausgeschiedene
// Mitarbeiter nie per SCIM deprovisioniert werden.
//
// Vorgehen (bewusst zweistufig, siehe Migration 0412):
//   1. GENAU die Token-Auflösung läuft über eine eng begrenzte
//      SECURITY-DEFINER-Funktion mit gesetztem `search_path`. Sie gibt nur die
//      Felder zurück, die zur Ermittlung des Org-Kontexts nötig sind.
//   2. Danach etabliert der Aufrufer über `withAnonymousTokenContext()` einen
//      normalen, org-gebundenen RLS-Kontext. ALLE weiteren Abfragen des
//      Handlers laufen wieder vollständig unter RLS.
//
// Was hier NICHT passiert: keine RLS-Policy wird verändert, kein
// `app.bypass_rls`, keine Superuser-Verbindung. Die Policy-seitige Alternative
// ist in /work/audit/remediation/WP3.md an WP2 übergeben.

import { createHash } from "crypto";
import { db, withOrgReadContext } from "@grc/db";
import { sql } from "drizzle-orm";
import { isUserRole, type UserRole, type LineOfDefense } from "@grc/shared";

/** SHA-256 hex — dieselbe Funktion, die SCIM-Token schon nutzen. */
export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type Row = Record<string, unknown>;

async function callResolver(
  fnCall: ReturnType<typeof sql>,
): Promise<Row | null> {
  const result = (await db.execute(fnCall)) as unknown as Row[];
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: Row[] }).rows ?? []);
  return rows.length ? rows[0] : null;
}

export interface ResolvedInvitation {
  id: string;
  orgId: string;
  email: string;
  role: UserRole;
  lineOfDefense: LineOfDefense | null;
  status: string;
  expiresAt: Date;
  invitedBy: string | null;
}

export async function resolveInvitationToken(
  token: string,
): Promise<ResolvedInvitation | null> {
  const row = await callResolver(
    sql`SELECT * FROM public.auth_resolve_invitation_token(${token})`,
  );
  if (!row) return null;
  const role = String(row.role);
  if (!isUserRole(role)) {
    // The DB enum and the TS union are kept in lockstep by
    // `packages/shared/src/types/platform.ts` + migration 0410 (S02-14). A
    // value outside the union means the invitation predates the alignment or
    // the enum drifted again — fail closed rather than assign an unknown role.
    return null;
  }
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    email: String(row.email),
    role,
    lineOfDefense: (row.line_of_defense
      ? String(row.line_of_defense)
      : null) as LineOfDefense | null,
    status: String(row.status),
    expiresAt: new Date(row.expires_at as string),
    invitedBy: row.invited_by ? String(row.invited_by) : null,
  };
}

export interface ResolvedScimToken {
  id: string;
  orgId: string;
  isActive: boolean;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export async function resolveScimTokenHash(
  tokenHash: string,
): Promise<ResolvedScimToken | null> {
  const row = await callResolver(
    sql`SELECT * FROM public.auth_resolve_scim_token(${tokenHash})`,
  );
  if (!row) return null;
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    isActive: row.is_active === true,
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : null,
  };
}

export async function touchScimToken(tokenId: string): Promise<void> {
  try {
    await db.execute(sql`SELECT public.auth_touch_scim_token(${tokenId})`);
  } catch (err) {
    // #WP3-S02-15: der bisherige nackte UPDATE ohne try/catch konnte die
    // Authentifizierung NACH erfolgreicher Tokenprüfung mit einem 500 abbrechen.
    // Ein fehlgeschlagener Zeitstempel darf kein Auth-Fehler sein.
    console.warn(
      "[scim] last_used_at update failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function resolveDdSessionTokenHash(
  tokenHash: string,
): Promise<{ id: string; orgId: string } | null> {
  const row = await callResolver(
    sql`SELECT * FROM public.auth_resolve_dd_session_token(${tokenHash})`,
  );
  return row ? { id: String(row.id), orgId: String(row.org_id) } : null;
}

export async function resolveWbMailboxToken(token: string): Promise<{
  id: string;
  reportId: string;
  orgId: string;
  expiresAt: Date;
} | null> {
  const row = await callResolver(
    sql`SELECT * FROM public.auth_resolve_wb_mailbox_token(${token})`,
  );
  if (!row) return null;
  return {
    id: String(row.id),
    reportId: String(row.report_id),
    orgId: String(row.org_id),
    expiresAt: new Date(row.expires_at as string),
  };
}

export async function resolveOrgByCode(orgCode: string): Promise<{
  id: string;
  name: string;
  shortName: string | null;
} | null> {
  const row = await callResolver(
    sql`SELECT * FROM public.auth_resolve_org_by_code(${orgCode})`,
  );
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    shortName: row.short_name ? String(row.short_name) : null,
  };
}

export async function resolveIcalTokenHash(
  tokenHash: string,
): Promise<{ userId: string; orgId: string } | null> {
  const row = await callResolver(
    sql`SELECT * FROM public.auth_resolve_ical_token(${tokenHash})`,
  );
  return row
    ? { userId: String(row.user_id), orgId: String(row.org_id) }
    : null;
}

/**
 * Durable, instanzübergreifender SAML-Replay-Schutz (S02-23).
 * @returns true, wenn die Assertion-ID NEU war; false bei einem Replay.
 */
export async function consumeSamlAssertionId(
  assertionId: string,
  orgId: string,
  expiresAt: Date,
): Promise<boolean> {
  const row = await callResolver(
    sql`SELECT public.auth_consume_saml_assertion(${assertionId}, ${orgId}::uuid, ${expiresAt.toISOString()}::timestamptz) AS fresh`,
  );
  return row?.fresh === true;
}

/**
 * Establish a normal, org-scoped RLS context for the remainder of an anonymous
 * token request. Everything inside runs under full RLS on a dedicated,
 * connection-pinned context.
 *
 * #WP3-S02-08: this replaces the pattern
 * `db.execute(sql\`SELECT set_config('app.current_org_id', X, false)\`)`, which
 * wrote a SESSION-level GUC onto a shared base-pool connection and leaked that
 * org context into every later, context-free query on the same connection.
 */
export async function withAnonymousTokenContext<T>(
  orgId: string,
  fn: (
    scopedDb: Parameters<Parameters<typeof withOrgReadContext>[1]>[0],
  ) => Promise<T>,
  opts?: { userId?: string | null },
): Promise<T> {
  return withOrgReadContext(orgId, fn, opts);
}
