#!/usr/bin/env node
// audit-rls-coverage.mjs
//
// ===========================================================================
// [ARCTOS-FULL-2026-08-31 / WP2 · S01-14, S01-15, S01-24] Neufassung
// ===========================================================================
//
// Dieses Skript erzeugte `docs/security/rls-coverage-report.md` — das
// Artefakt, mit dem Kunden, Auditoren und dem eigenen Betriebsteam die
// Mandantentrennung zugesichert wird. Es hatte drei Defekte, die zusammen
// dazu führten, dass der Report messbar von der Datenbank abwich:
//
//  * S01-14: Es las MIGRATIONSTEXTE per Regex, nicht die Datenbank. Migration
//    `0379`, die RLS auf fünf Tabellen wieder ABSCHALTET, kam darin nicht vor
//    — der Report wies `session`, `account`, `verification_token` und
//    `audit_log` als "RLS ✅ Policy ✅" aus, während `pg_class` für alle vier
//    `relrowsecurity = false` und null Policies meldete. Wer dem Report
//    folgte, hielt die Session- und OAuth-Token-Tabellen für geschützt.
//    Zusätzlich zählte er 574 Tabellen, real existierten 527.
//
//  * S01-15: Tabellen ohne `org_id` galten pauschal als `PLATFORM_EXEMPT` —
//    inklusive `user` (Passwort-Hashes!) und der 18 Kindtabellen, in denen
//    der Audit Cross-Tenant-Zugriff praktisch nachgewiesen hat.
//
//  * S01-24: Es gab keinen `--check`-Modus. Jeder Lauf überschrieb den Report
//    mit dem gerade gemessenen Stand; eine Regression erzeugte keinen Fehler,
//    sondern nur eine Dateiänderung. Drift fiel damit nie auf.
//
// Diese Fassung misst gegen die LAUFENDE Datenbank (`DATABASE_URL`), nutzt
// dieselbe Klassifikation wie `packages/db/src/rls-audit.ts` (eine Quelle der
// Wahrheit für Admin-UI, Systemtest und Report) und kennt zwei Modi:
//
//     node scripts/audit-rls-coverage.mjs            # Report schreiben
//     node scripts/audit-rls-coverage.mjs --check    # Gate: Exit 1 bei Lücke
//                                                    # ODER bei Drift zum
//                                                    # eingecheckten Report
//
// `--check` ist der Modus für CI. Er schreibt nichts.
// ===========================================================================

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const ROOT = new URL("..", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);
const OUT_DIR = join(ROOT, "docs/security");
const CHECK = process.argv.includes("--check");

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://grc:grc_dev_password@localhost:5432/grc_platform";

const AUTH_CORE = new Set(["user", "session", "account", "verification_token"]);
const INFRA = new Set(["_arctos_migrations"]);

/**
 * Klassifiziert jedes Objekt in `public` gegen den Katalog. Bewusst dieselbe
 * Logik wie `runRlsAudit()` in packages/db/src/rls-audit.ts — dieses Skript
 * ist die CLI-/CI-Variante davon, ohne Drizzle-Abhängigkeit.
 */
async function measure(sql) {
  const relations = await sql`
    SELECT c.relname AS name, c.relkind::text AS kind,
           c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
           COALESCE(array_to_string(c.reloptions, ','), '') AS reloptions,
           COALESCE(
             (SELECT has_table_privilege('grc_app', c.oid, 'SELECT')
               WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app')),
             false) AS readable_by_app
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m')
     ORDER BY c.relname`;

  const orgCols = await sql`
    SELECT table_name FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name IN ('org_id','organization_id')`;
  const tenantSet = new Set(orgCols.map((r) => r.table_name));

  const fkRows = await sql`
    SELECT src.relname AS child, tgt.relname AS parent
      FROM pg_constraint con
      JOIN pg_class src ON src.oid = con.conrelid
      JOIN pg_class tgt ON tgt.oid = con.confrelid
      JOIN pg_namespace n ON n.oid = src.relnamespace
     WHERE con.contype = 'f' AND n.nspname = 'public'`;
  const parentsOf = new Map();
  for (const f of fkRows) {
    if (f.child === f.parent) continue;
    parentsOf.set(f.child, [...(parentsOf.get(f.child) ?? []), f.parent]);
  }
  const reachesTenant = (t) => {
    const seen = new Set([t]);
    let frontier = parentsOf.get(t) ?? [];
    for (let d = 0; d < 4 && frontier.length; d++) {
      const next = [];
      for (const p of frontier) {
        if (tenantSet.has(p)) return true;
        if (seen.has(p)) continue;
        seen.add(p);
        next.push(...(parentsOf.get(p) ?? []));
      }
      frontier = next;
    }
    return false;
  };

  const policies = await sql`
    SELECT tablename, policyname, cmd, qual, with_check
      FROM pg_policies WHERE schemaname = 'public'`;
  const polByTable = new Map();
  for (const p of policies) {
    const slot = polByTable.get(p.tablename) ?? {
      names: [],
      cmds: new Set(),
      defects: [],
    };
    slot.names.push(p.policyname);
    const cmd = p.cmd.toUpperCase();
    slot.cmds.add(cmd);
    const expr = `${p.qual ?? ""} ${p.with_check ?? ""}`;
    const writeCmd = cmd === "ALL" || cmd === "INSERT" || cmd === "UPDATE";
    if (expr.includes("app.bypass_rls"))
      slot.defects.push(`${p.policyname}: app.bypass_rls (S01-02)`);
    if (
      cmd !== "INSERT" &&
      ((p.qual ?? "").trim() === "true" ||
        (p.with_check ?? "").trim() === "true")
    )
      slot.defects.push(`${p.policyname}: USING/CHECK (true) on ${cmd}`);
    if (writeCmd && expr.includes("org_id IS NULL"))
      slot.defects.push(`${p.policyname}: org_id IS NULL writable (S01-07)`);
    if (
      expr.includes("current_setting('app.current_org_id'") &&
      !expr.includes("NULLIF(current_setting('app.current_org_id'")
    )
      slot.defects.push(`${p.policyname}: no NULLIF guard (S01-18)`);
    if (expr.includes("(org_id)::text = current_setting"))
      slot.defects.push(`${p.policyname}: text comparison (S01-25)`);
    polByTable.set(p.tablename, slot);
  }

  const triggers = await sql`
    SELECT c.relname AS tablename
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND NOT t.tgisinternal
       AND p.proname = 'audit_trigger'`;
  const auditTriggered = new Set(triggers.map((t) => t.tablename));

  const rows = [];
  for (const r of relations) {
    const pol = polByTable.get(r.name) ?? {
      names: [],
      cmds: new Set(),
      defects: [],
    };
    const base = {
      table: r.name,
      rls: r.rls,
      forced: r.forced,
      policies: pol.names.length,
      audit: auditTriggered.has(r.name),
      defects: pol.defects,
    };

    if (r.kind === "v") {
      const invoker = r.reloptions.includes("security_invoker=true");
      rows.push({
        ...base,
        scope: "VIEW",
        status: invoker ? "OK" : "VIEW_NOT_INVOKER",
      });
      continue;
    }
    if (r.kind === "m") {
      rows.push({
        ...base,
        scope: "MATVIEW",
        status: r.readable_by_app ? "MATVIEW_READABLE" : "OK",
      });
      continue;
    }
    if (INFRA.has(r.name)) {
      rows.push({ ...base, scope: "INFRA", status: "PLATFORM_EXEMPT" });
      continue;
    }

    const scope = tenantSet.has(r.name)
      ? "TENANT"
      : AUTH_CORE.has(r.name)
        ? "AUTH"
        : reachesTenant(r.name)
          ? "TENANT_CHILD"
          : "PLATFORM";

    if (scope === "PLATFORM") {
      rows.push({ ...base, scope, status: "PLATFORM_EXEMPT" });
      continue;
    }
    let status;
    if (!r.rls) status = "RLS_MISSING";
    else if (pol.names.length === 0)
      status =
        AUTH_CORE.has(r.name) && !r.readable_by_app ? "OK" : "POLICY_MISSING";
    else if (
      !pol.cmds.has("ALL") &&
      ["SELECT", "INSERT", "UPDATE", "DELETE"].some((c) => !pol.cmds.has(c))
    )
      status = "POLICY_MISSING";
    else if (pol.defects.length > 0) status = "WEAK_POLICY";
    else if (!r.forced) status = "FORCE_MISSING";
    else status = "OK";
    rows.push({ ...base, scope, status });
  }
  return rows;
}

function render(rows, dbName) {
  const counts = rows.reduce((a, r) => {
    a[r.status] = (a[r.status] ?? 0) + 1;
    return a;
  }, {});
  const gaps = rows.filter(
    (r) => r.status !== "OK" && r.status !== "PLATFORM_EXEMPT",
  );

  const md = [
    `# RLS Coverage Report`,
    ``,
    `**Quelle: die laufende Datenbank** (\`pg_class\`, \`pg_policies\`,`,
    `\`pg_trigger\`, \`information_schema\`) — nicht die Migrationstexte.`,
    ``,
    `Erzeugt mit \`node scripts/audit-rls-coverage.mjs\` gegen \`${dbName}\`.`,
    `Die Gegenprüfung \`node scripts/audit-rls-coverage.mjs --check\` schlägt`,
    `fehl, wenn eine Lücke besteht **oder** dieser Report vom gemessenen Ist`,
    `abweicht.`,
    ``,
    `> Diese Datei wurde im Rahmen der Remediation (WP2, Findings S01-14,`,
    `> S01-15, S01-24) auf eine Messung umgestellt. Die Vorgängerfassung las`,
    `> Migrationstexte per Regex und wies deshalb \`session\`, \`account\`,`,
    `> \`verification_token\` und \`audit_log\` als RLS-geschützt aus, obwohl`,
    `> Migration \`0379\` RLS auf ihnen abgeschaltet hatte.`,
    ``,
    `## Zusammenfassung`,
    ``,
    `| Status | Anzahl |`,
    `|---|---|`,
    ...Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `| ${k} | ${v} |`),
    `| **Objekte gesamt** | **${rows.length}** |`,
    `| **Lücken** | **${gaps.length}** |`,
    ``,
    `## Geltungsbereiche`,
    ``,
    `| Scope | Bedeutung |`,
    `|---|---|`,
    `| \`TENANT\` | Tabelle mit \`org_id\`/\`organization_id\` |`,
    `| \`TENANT_CHILD\` | keine eigene \`org_id\`, aber Fremdschlüsselpfad auf eine org-skalierte Tabelle — braucht eine Policy über den Elternbezug (S01-03) |`,
    `| \`AUTH\` | \`user\`/\`session\`/\`account\`/\`verification_token\` — mandantenrelevant über die Mitgliedschaft, nicht über \`org_id\` (S01-04) |`,
    `| \`VIEW\` | muss \`security_invoker = true\` tragen, sonst wird sie mit den Rechten des Eigentümers ausgewertet (S01-08) |`,
    `| \`MATVIEW\` | kann keine RLS tragen — Leserecht muss der Runtime-Rolle entzogen sein (S01-08) |`,
    `| \`PLATFORM\` | weder \`org_id\` noch FK-Pfad dorthin — echt global |`,
    ``,
    `## Statuswerte`,
    ``,
    `- \`RLS_MISSING\` — mandantenbezogen, aber \`relrowsecurity = false\``,
    `- \`POLICY_MISSING\` — RLS aktiv, aber kein Policy-Satz für alle vier Kommandos`,
    `- \`FORCE_MISSING\` — RLS aktiv, aber kein \`FORCE\`: der Eigentümer umgeht seine eigenen Policies (S01-20)`,
    `- \`WEAK_POLICY\` — Policy vorhanden, Ausdruck fehlerhaft (\`app.bypass_rls\`, \`USING (true)\`, schreibbares \`org_id IS NULL\`, \`::uuid\`-Cast ohne \`NULLIF\`, Textvergleich)`,
    `- \`VIEW_NOT_INVOKER\` / \`MATVIEW_READABLE\` — siehe oben`,
    `- \`OK\` / \`PLATFORM_EXEMPT\``,
    ``,
  ];

  if (gaps.length > 0) {
    md.push(`## Offene Lücken (${gaps.length})`, ``);
    md.push(`| Objekt | Scope | Status | RLS | FORCE | Policies | Befund |`);
    md.push(`|---|---|---|---|---|---|---|`);
    for (const g of gaps) {
      md.push(
        `| \`${g.table}\` | ${g.scope} | ${g.status} | ${g.rls ? "✅" : "❌"} | ${g.forced ? "✅" : "❌"} | ${g.policies} | ${g.defects.join("; ") || "—"} |`,
      );
    }
    md.push(``);
  } else {
    md.push(
      `## Offene Lücken`,
      ``,
      `Keine. Jedes Objekt mit Mandantenbezug trägt RLS, FORCE und einen`,
      `vollständigen, fehlerfreien Policy-Satz; jede View läuft mit`,
      `\`security_invoker\`; keine Materialized View ist für \`grc_app\` lesbar.`,
      ``,
      `Der Nachweis, dass diese Konfiguration auch WIRKT — Cross-Tenant-Lesen`,
      `und -Schreiben mit Daten in zwei echten Orgs als Rolle \`grc_app\` —`,
      `steht in \`packages/db/tests/rls/tenant-isolation-systemtest.test.ts\`.`,
      `Ein grüner Report ohne diesen Test wäre genau die Behauptung, die`,
      `Finding S01-14 beanstandet hat.`,
      ``,
    );
  }

  md.push(`## Vollständige Objektliste`, ``);
  md.push(
    `| Objekt | Scope | RLS | FORCE | Policies | audit_trigger | Status |`,
  );
  md.push(`|---|---|---|---|---|---|---|`);
  for (const r of rows) {
    md.push(
      `| \`${r.table}\` | ${r.scope} | ${r.rls ? "✅" : "❌"} | ${r.forced ? "✅" : "❌"} | ${r.policies} | ${r.audit ? "✅" : "❌"} | ${r.status} |`,
    );
  }
  md.push(``);
  return md.join("\n") + "\n";
}

function renderCsv(rows) {
  return (
    [
      "object,scope,rls_enabled,force_rls,policy_count,audit_trigger,status,defects",
      ...rows.map(
        (r) =>
          `${r.table},${r.scope},${r.rls},${r.forced},${r.policies},${r.audit},${r.status},"${r.defects.join("; ")}"`,
      ),
    ].join("\n") + "\n"
  );
}

async function main() {
  const sql = postgres(DATABASE_URL, { max: 1 });
  let rows;
  try {
    rows = await measure(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }

  const dbName = DATABASE_URL.replace(/:[^:@/]*@/, ":***@");
  const md = render(rows, dbName);
  const csv = renderCsv(rows);
  const gaps = rows.filter(
    (r) => r.status !== "OK" && r.status !== "PLATFORM_EXEMPT",
  );

  if (CHECK) {
    let failed = false;
    if (gaps.length > 0) {
      console.error(`✗ ${gaps.length} RLS-Lücke(n) in der Datenbank:`);
      for (const g of gaps) {
        console.error(
          `    ${g.status.padEnd(18)} ${g.scope.padEnd(13)} ${g.table}` +
            (g.defects.length ? `  — ${g.defects.join("; ")}` : ""),
        );
      }
      failed = true;
    }
    // Drift zwischen Report und Ist — der eigentliche S01-14/-24-Fix.
    const stripGenerated = (s) =>
      s
        .replace(/^Erzeugt mit .*$/gm, "")
        .replace(/\s+/g, " ")
        .trim();
    let committed = null;
    try {
      committed = await readFile(
        join(OUT_DIR, "rls-coverage-report.md"),
        "utf8",
      );
    } catch {
      console.error("✗ docs/security/rls-coverage-report.md fehlt.");
      failed = true;
    }
    if (committed && stripGenerated(committed) !== stripGenerated(md)) {
      console.error(
        "✗ docs/security/rls-coverage-report.md weicht vom gemessenen Ist ab.\n" +
          "  Neu erzeugen: node scripts/audit-rls-coverage.mjs",
      );
      failed = true;
    }
    if (failed) process.exit(1);
    console.log(
      `✓ RLS-Abdeckung vollständig (${rows.length} Objekte, 0 Lücken) und Report aktuell.`,
    );
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, "rls-coverage-report.md"), md);
  await writeFile(join(OUT_DIR, "rls-coverage-report.csv"), csv);
  console.log(
    `→ docs/security/rls-coverage-report.{md,csv} geschrieben — ${rows.length} Objekte, ${gaps.length} Lücke(n).`,
  );
  if (gaps.length > 0) {
    for (const g of gaps) console.log(`    ${g.status} ${g.table}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
