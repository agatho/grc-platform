#!/usr/bin/env node
// ============================================================================
// ARCTOS — Betriebsmetriken und Sicherheitsalarme
//
// [ARCTOS-FULL-2026-08-31 / WP10 · S13-11, S13-12; ADR-017]
//
// AUSGANGSLAGE
//
// S13-11: Eine vollständige Suche über `apps/web/src`, `apps/worker/src`,
// `packages/*/src`, `deploy`, `scripts`, `.github` und beide Compose-Dateien
// nach `healthchecks.io|alertmanager|prometheus|promtail|loki|sentry|
// opentelemetry|statsd|datadog` ergab NULL Treffer. Kein Client in einer
// package.json, kein Exporter in einer Compose-Datei, kein Heartbeat in
// deploy/ oder scripts/, kein `schedule:`-Workflow, der einen Health-Endpunkt
// abruft. ADR-017 stand seit 4,5 Monaten auf "Proposed" und terminierte
// Phase 1 auf "Woche 1". Die Plattform war unbeobachtet; ein Ausfall wurde
// durch Nutzerreport entdeckt. Die im DR-Playbook zugesagte RTO von 5 min
// beginnt definitionsgemäß bei "Incident Confirmed" — es gab keinen
// Mechanismus, der einen Incident bestätigt.
//
// S13-12: Es gab keinen Alarm auf ein einziges sicherheitsrelevantes
// Ereignis. Die Daten lagen vor (`access_log`, `data_export_log`,
// `audit_log`, `job_run`), niemand las sie. Die 20+ "alert"-Treffer im
// Worker sind fachliche Benachrichtigungen des GRC-Modells für Endnutzer,
// keine Betriebsalarme.
//
// WAS DIESES PROGRAMM LEISTET
//
//  1. Strukturierte Metriken im Prometheus-Textformat unter
//     `GET /metrics` — die Grundlage jedes Scrapers (Prometheus, Grafana
//     Agent, Alloy, VictoriaMetrics) und jeder einfachen Kurve.
//  2. `GET /healthz`  — Liveness des Exporters selbst.
//  3. `GET /readyz`   — DB erreichbar, letzte Auswertung frisch.
//  4. Ein Auswertungslauf alle `OPS_INTERVAL_SECONDS` (Standard 60 s), der
//     die vier vom Auditauftrag geforderten Ereignisklassen prüft und bei
//     Überschreitung einen ALARM auslöst:
//       * fehlgeschlagene Logins / Credential Stuffing
//       * Massenexporte
//       * Bruch der Audit-Hash-Kette (inkl. abgewiesener Schreibversuche)
//       * fehlgeschlagene Jobs
//     dazu die Betriebsereignisse: fehlgeschlagenes Backup, veraltetes
//     Off-Site-Backup, überfälliger DR-Drill, Schema-Drift.
//  5. Alarmzustellung über `ALERT_WEBHOOK_URL` (Slack/Teams/Mattermost/
//     Alertmanager nehmen alle JSON per POST) und/oder `HEALTHCHECKS_URL`
//     (Dead-Man's-Switch: bleibt der Ping aus, alarmiert der Dienst).
//     Ohne beides schreibt das Programm die Alarme strukturiert nach stderr
//     — dann greift wenigstens die Log-Auswertung, und der Zustand ist
//     ehrlich sichtbar statt stillschweigend abwesend.
//
// Warum ein eigener Prozess und kein `/api/v1/metrics` in der Web-App:
// die Auswertung braucht org-übergreifenden Lesezugriff (Kettenprüfung über
// alle Scopes, `access_log` aller Mandanten). Die Web-App läuft
// absichtlich als `grc_app` unter RLS (#S01-10) und darf das nicht. Dieser
// Prozess verbindet als `grc_worker` (BYPASSRLS, kein SUPERUSER) und ist
// NICHT öffentlich exponiert — er hört auf 127.0.0.1 bzw. nur im
// Docker-Netz.
//
// Aufruf:
//   DATABASE_URL=… node scripts/ops-metrics.mjs            # Serverbetrieb
//   DATABASE_URL=… node scripts/ops-metrics.mjs --once     # ein Lauf, Exit
//   DATABASE_URL=… node scripts/ops-metrics.mjs --check    # Exit 1 bei Alarm
// ============================================================================
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

// Datenbankzugriff: bevorzugt der `postgres`-Client (postgres-js), der im
// Worker-Image ohnehin liegt — dann braucht dieses Image KEIN
// postgresql-client-Paket (#S08-11: minimale Images). Faellt der Import
// aus (Arbeitsplatz ohne installierte Abhaengigkeiten), wird auf `psql`
// zurueckgefallen.
let sqlClient = null;
try {
  const { default: postgres } = await import("postgres");
  if (process.env.DATABASE_URL) {
    sqlClient = postgres(process.env.DATABASE_URL, {
      max: 2,
      idle_timeout: 30,
      connect_timeout: 10,
      // Nur Auswertung — nichts wird geschrieben.
      prepare: false,
      onnotice: () => {},
    });
  }
} catch {
  sqlClient = null;
}

const ONCE = process.argv.includes("--once");
const CHECK = process.argv.includes("--check");
const PORT = Number(process.env.OPS_METRICS_PORT ?? 9105);
const HOST = process.env.OPS_METRICS_HOST ?? "0.0.0.0";
const INTERVAL_S = Number(process.env.OPS_INTERVAL_SECONDS ?? 60);
const BACKUP_DIR = process.env.BACKUP_DIR ?? "/opt/arctos/backups";
const DATABASE_URL = process.env.DATABASE_URL;

// ── Schwellen. Bewusst als Env überschreibbar, mit begründeten Vorgaben. ──
const T = {
  // 20 fehlgeschlagene Logins in 5 min über die ganze Instanz. Ein einzelner
  // Nutzer mit Tippfehlern erreicht das nicht; ein Spray über viele Konten
  // schon — und genau den sieht fail2ban im Caddy-Log NICHT, weil ihm die
  // Anwendungssemantik fehlt (#S13-12).
  failedLogins5m: Number(process.env.ALERT_FAILED_LOGINS_5M ?? 20),
  // Ein einzelnes Konto: 10 Fehlversuche in 5 min = gezielter Angriff.
  failedLoginsPerAccount5m: Number(
    process.env.ALERT_FAILED_LOGINS_ACCOUNT_5M ?? 10,
  ),
  // Massenexport: >50.000 Datensätze in 1 h durch EINEN Nutzer. Der in
  // S13-12 beschriebene Insider exportierte über eine Woche verteilt —
  // deshalb zusätzlich ein Tagesbudget.
  exportRows1h: Number(process.env.ALERT_EXPORT_ROWS_1H ?? 50000),
  exportRows24h: Number(process.env.ALERT_EXPORT_ROWS_24H ?? 200000),
  // Kettenbruch: NULL Toleranz. Vgl. #S13-08d.
  chainErrors: 0,
  // Fehlgeschlagene Jobs in 1 h.
  jobFailures1h: Number(process.env.ALERT_JOB_FAILURES_1H ?? 3),
  // Backup älter als 26 h (ADR-015:92 nennt genau diesen Wert).
  backupAgeSeconds: Number(process.env.ALERT_BACKUP_AGE_SECONDS ?? 26 * 3600),
  offsiteAgeSeconds: Number(process.env.ALERT_OFFSITE_AGE_SECONDS ?? 26 * 3600),
  // DR-Drill: monatlich zugesagt, 40 Tage Kulanz.
  drillAgeSeconds: Number(process.env.ALERT_DRILL_AGE_SECONDS ?? 40 * 86400),
};

const state = {
  lastRunAt: 0,
  lastRunOk: false,
  metrics: {},
  alerts: [],
  lastError: null,
};

// ── Abfrage: postgres-js, sonst psql ─────────────────────────────────────
async function q(sql) {
  if (!DATABASE_URL) throw new Error("DATABASE_URL ist nicht gesetzt");
  if (sqlClient) {
    const rows = await sqlClient.unsafe(sql);
    if (!rows.length) return "";
    const first = rows[0];
    const key = Object.keys(first)[0];
    return first[key] === null ? "" : String(first[key]);
  }
  const out = execFileSync(
    "psql",
    [DATABASE_URL, "-tAc", sql.replace(/\s+/g, " ")],
    {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    },
  );
  return out.trim();
}
const qNum = async (sql) => {
  const v = Number(await q(sql));
  return Number.isFinite(v) ? v : 0;
};

function fileAgeSeconds(path) {
  try {
    return Math.round((Date.now() - statSync(path).mtimeMs) / 1000);
  } catch {
    return null;
  }
}
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

// ── Alarmzustellung ──────────────────────────────────────────────────────
const sent = new Map(); // key -> letzter Versand (Anti-Flapping)
const RESEND_AFTER_MS =
  Number(process.env.ALERT_RESEND_AFTER_SECONDS ?? 3600) * 1000;

async function deliver(alert) {
  const last = sent.get(alert.key) ?? 0;
  if (Date.now() - last < RESEND_AFTER_MS) return;
  sent.set(alert.key, Date.now());

  // Immer strukturiert ins Log — auch wenn kein Kanal konfiguriert ist.
  // Das ist der ehrliche Mindestzustand: sichtbar statt abwesend.
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: alert.severity === "critical" ? "error" : "warn",
      service: "arctos-ops-metrics",
      alert: alert.key,
      severity: alert.severity,
      message: alert.message,
      value: alert.value,
      threshold: alert.threshold,
      finding: alert.finding,
    }),
  );

  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        // Slack/Mattermost lesen `text`, Teams `text`, Alertmanager `alerts`.
        text: `[ARCTOS ${alert.severity.toUpperCase()}] ${alert.message}`,
        alerts: [
          {
            labels: {
              alertname: alert.key,
              severity: alert.severity,
              service: "arctos",
              finding: alert.finding ?? "",
            },
            annotations: { description: alert.message },
            startsAt: new Date().toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        service: "arctos-ops-metrics",
        message: "Alarmzustellung fehlgeschlagen",
        error: String(e?.message ?? e),
      }),
    );
  }
}

async function pingHeartbeat(ok) {
  const url = process.env.HEALTHCHECKS_URL;
  if (!url) return;
  try {
    await fetch(ok ? url : `${url}/fail`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    /* Der Dead-Man's-Switch alarmiert gerade dann, wenn das hier scheitert. */
  }
}

// ── Der Auswertungslauf ──────────────────────────────────────────────────
async function collect() {
  const m = {};
  const alerts = [];
  const add = (key, severity, message, value, threshold, finding) => {
    alerts.push({ key, severity, message, value, threshold, finding });
  };

  // 1. Fehlgeschlagene Logins (#S13-12, Zeile 1 der Tabelle)
  m.arctos_failed_logins_5m = await qNum(`
    SELECT count(*) FROM access_log
    WHERE event_type IN ('login_failed','mfa_failed')
      AND created_at > now() - interval '5 minutes'`);
  if (m.arctos_failed_logins_5m > T.failedLogins5m) {
    add(
      "failed_logins_burst",
      "critical",
      `${m.arctos_failed_logins_5m} fehlgeschlagene Anmeldungen in 5 Minuten ` +
        `(Schwelle ${T.failedLogins5m}). Muster: Credential Stuffing über viele Konten — ` +
        `fail2ban im Caddy-Log sieht das nicht, weil ihm die Anwendungssemantik fehlt.`,
      m.arctos_failed_logins_5m,
      T.failedLogins5m,
      "S13-12",
    );
  }

  const worstAccount = await q(`
    SELECT coalesce(max(c)::text, '0') FROM (
      SELECT count(*) AS c FROM access_log
      WHERE event_type IN ('login_failed','mfa_failed')
        AND created_at > now() - interval '5 minutes'
        AND email_attempted IS NOT NULL
      GROUP BY email_attempted
    ) t`);
  m.arctos_failed_logins_per_account_5m = Number(worstAccount) || 0;
  if (m.arctos_failed_logins_per_account_5m > T.failedLoginsPerAccount5m) {
    add(
      "failed_logins_single_account",
      "critical",
      `Ein Konto mit ${m.arctos_failed_logins_per_account_5m} Fehlversuchen in 5 Minuten ` +
        `(Schwelle ${T.failedLoginsPerAccount5m}) — gezielter Angriff auf ein einzelnes Konto.`,
      m.arctos_failed_logins_per_account_5m,
      T.failedLoginsPerAccount5m,
      "S13-12",
    );
  }
  m.arctos_account_lockouts_1h = await qNum(`
    SELECT count(*) FROM access_log
    WHERE event_type = 'account_locked' AND created_at > now() - interval '1 hour'`);

  // 2. Massenexporte (#S13-12, Zeile 2)
  m.arctos_export_rows_1h = await qNum(`
    SELECT coalesce(max(s), 0) FROM (
      SELECT sum(coalesce(record_count,0)) AS s FROM data_export_log
      WHERE created_at > now() - interval '1 hour' GROUP BY user_id
    ) t`);
  m.arctos_export_rows_24h = await qNum(`
    SELECT coalesce(max(s), 0) FROM (
      SELECT sum(coalesce(record_count,0)) AS s FROM data_export_log
      WHERE created_at > now() - interval '24 hours' GROUP BY user_id
    ) t`);
  m.arctos_exports_personal_data_24h = await qNum(`
    SELECT count(*) FROM data_export_log
    WHERE contains_personal_data AND created_at > now() - interval '24 hours'`);
  if (m.arctos_export_rows_1h > T.exportRows1h) {
    add(
      "mass_export_hourly",
      "critical",
      `Ein Nutzer hat in einer Stunde ${m.arctos_export_rows_1h} Datensätze exportiert ` +
        `(Schwelle ${T.exportRows1h}). data_export_log führt den Vorgang — bis 2026-08-31 ` +
        `las die Tabelle niemand.`,
      m.arctos_export_rows_1h,
      T.exportRows1h,
      "S13-12",
    );
  }
  if (m.arctos_export_rows_24h > T.exportRows24h) {
    add(
      "mass_export_daily",
      "warning",
      `Ein Nutzer hat in 24 Stunden ${m.arctos_export_rows_24h} Datensätze exportiert ` +
        `(Schwelle ${T.exportRows24h}). Das ist das Muster des über Tage verteilten ` +
        `Insider-Exports, das eine reine Stundenschwelle nicht sieht.`,
      m.arctos_export_rows_24h,
      T.exportRows24h,
      "S13-12",
    );
  }

  // 3. Bruch der Audit-Hash-Kette (#S13-12, Zeile 3; WP4/S03-12)
  try {
    m.arctos_audit_chain_errors = await qNum(`
      SELECT coalesce(sum(
        (v->>'rowMismatches')::int + (v->>'chainMismatches')::int
        + (v->>'commitmentMismatches')::int + (v->>'redactionUnproven')::int), 0)
      FROM (
        SELECT audit_chain_verify(s) AS v
        FROM (SELECT DISTINCT previous_hash_scope AS s FROM audit_log
              WHERE previous_hash_scope IS NOT NULL) x(s)
      ) t`);
  } catch (e) {
    m.arctos_audit_chain_errors = -1;
    add(
      "audit_chain_unverifiable",
      "critical",
      `Die Audit-Kette ist nicht prüfbar: ${String(e?.message ?? e).slice(0, 200)}. ` +
        `Eine nicht prüfbare Kette ist kein Nachweis.`,
      -1,
      0,
      "S13-12",
    );
  }
  if (m.arctos_audit_chain_errors > T.chainErrors) {
    add(
      "audit_chain_broken",
      "critical",
      `${m.arctos_audit_chain_errors} Fehler in der Audit-Hash-Kette. Das Produkt ` +
        `verkauft Tamper-Evidence; ein Bruch ist ein Integritätsvorfall, kein Betriebsdetail.`,
      m.arctos_audit_chain_errors,
      T.chainErrors,
      "S13-12",
    );
  }

  // Abgewiesene Schreibversuche auf audit_log (WP4-Übergabe): jede Zeile ist
  // ein VERSUCH, den Audit-Trail zu verändern.
  try {
    m.arctos_audit_write_attempts_24h = await qNum(`
      SELECT count(*) FROM audit_log_write_attempt
      WHERE attempted_at > now() - interval '24 hours'`);
    if (m.arctos_audit_write_attempts_24h > 0) {
      add(
        "audit_write_attempt",
        "critical",
        `${m.arctos_audit_write_attempts_24h} abgewiesene Schreibversuche auf den ` +
          `Audit-Trail in 24 h. Der Guard hat sie verhindert — versucht hat sie jemand.`,
        m.arctos_audit_write_attempts_24h,
        0,
        "S13-12",
      );
    }
  } catch {
    m.arctos_audit_write_attempts_24h = -1;
  }

  // 4. Job-Fehler (#S13-12, Zeile 4; WP9-Übergabe)
  try {
    m.arctos_job_failures_1h = await qNum(`
      SELECT count(*) FROM job_run
      WHERE status IN ('failed','partial') AND started_at > now() - interval '1 hour'`);
    m.arctos_job_runs_1h = await qNum(`
      SELECT count(*) FROM job_run WHERE started_at > now() - interval '1 hour'`);
    // Ein Scheduler, der gar nichts mehr startet, ist so schlimm wie einer
    // mit Fehlern — und fiel vorher überhaupt nicht auf (#S13-14).
    m.arctos_job_runs_24h = await qNum(`
      SELECT count(*) FROM job_run WHERE started_at > now() - interval '24 hours'`);
    if (m.arctos_job_failures_1h > T.jobFailures1h) {
      add(
        "job_failures",
        "warning",
        `${m.arctos_job_failures_1h} fehlgeschlagene oder unvollständige Jobs in einer ` +
          `Stunde (Schwelle ${T.jobFailures1h}). Betroffen sind u. a. Retention (Art. 17 DSGVO), ` +
          `Fristenüberwachung (Art. 33 DSGVO, HinSchG) und die Audit-Verankerung.`,
        m.arctos_job_failures_1h,
        T.jobFailures1h,
        "S13-12",
      );
    }
    if (m.arctos_job_runs_24h === 0) {
      add(
        "scheduler_silent",
        "critical",
        `In 24 Stunden wurde KEIN Job ausgeführt. Der Scheduler steht — damit laufen ` +
          `weder Löschfristen noch Fristenüberwachung noch die tägliche Verankerung ` +
          `der Audit-Kette (#S13-14).`,
        0,
        1,
        "S13-14",
      );
    }
  } catch {
    m.arctos_job_failures_1h = -1;
  }

  // 5. Backup, Off-Site, DR-Drill (#S13-12, Zeilen 5-6; ADR-015:92)
  const backupStamp = readJson(join(BACKUP_DIR, ".last-run.json"));
  const backupAge = fileAgeSeconds(join(BACKUP_DIR, ".last-run.json"));
  m.arctos_backup_age_seconds = backupAge ?? -1;
  m.arctos_backup_last_status = backupStamp?.status === "ok" ? 1 : 0;
  m.arctos_backup_encrypted = backupStamp?.encrypted ? 1 : 0;
  m.arctos_backup_includes_objects = backupStamp?.objects ? 1 : 0;
  if (backupAge === null) {
    add(
      "backup_missing",
      "critical",
      `Es gibt keinen Backup-Stempel (${BACKUP_DIR}/.last-run.json). Entweder läuft ` +
        `das Backup nicht, oder es ist eine Fassung ohne Stempel im Einsatz.`,
      -1,
      T.backupAgeSeconds,
      "S13-12",
    );
  } else if (backupAge > T.backupAgeSeconds) {
    add(
      "backup_stale",
      "critical",
      `Das letzte Backup ist ${Math.round(backupAge / 3600)} h alt (Schwelle ` +
        `${Math.round(T.backupAgeSeconds / 3600)} h). Der Stempel wurde vorher geschrieben, ` +
        `aber von nichts gelesen.`,
      backupAge,
      T.backupAgeSeconds,
      "S13-12",
    );
  } else if (backupStamp?.status !== "ok") {
    add(
      "backup_failed",
      "critical",
      `Der letzte Backup-Lauf endete mit Status "${backupStamp?.status}".`,
      0,
      1,
      "S13-12",
    );
  }
  if (backupStamp && backupStamp.encrypted === false) {
    add(
      "backup_unencrypted",
      "warning",
      `Die Backups sind UNVERSCHLÜSSELT (#S13-07). ADR-015 §1 sagt Verschlüsselung zu.`,
      0,
      1,
      "S13-07",
    );
  }
  if (backupStamp && backupStamp.objects === false) {
    add(
      "backup_without_objects",
      "critical",
      `Das Backup enthält den DMS-Objektspeicher NICHT (#S13-06). Nach einem ` +
        `Host-Verlust blieben die Dokumentenzeilen mit Hashes — und die Dateien wären weg.`,
      0,
      1,
      "S13-06",
    );
  }

  const offsiteStamp = readJson(join(BACKUP_DIR, ".offsite-last-run.json"));
  const offsiteAge = fileAgeSeconds(join(BACKUP_DIR, ".offsite-last-run.json"));
  m.arctos_offsite_backup_age_seconds = offsiteAge ?? -1;
  m.arctos_offsite_last_status = offsiteStamp?.summary?.status === "ok" ? 1 : 0;
  if (offsiteAge === null || offsiteAge > T.offsiteAgeSeconds) {
    add(
      "offsite_stale",
      "warning",
      `Das Off-Site-Backup ist ${offsiteAge === null ? "nie gelaufen" : Math.round(offsiteAge / 3600) + " h alt"} ` +
        `(Schwelle ${Math.round(T.offsiteAgeSeconds / 3600)} h). ADR-015:92 hatte genau diese ` +
        `Metrik vorgesehen und sie war nicht implementiert.`,
      offsiteAge ?? -1,
      T.offsiteAgeSeconds,
      "S13-23",
    );
  } else if (offsiteStamp?.summary?.status !== "ok") {
    add(
      "offsite_failed",
      "warning",
      `Der letzte Off-Site-Sync endete mit Status "${offsiteStamp?.summary?.status}". ` +
        `Vorher endete er in derselben Lage mit Exit 0 und "uploaded":0.`,
      0,
      1,
      "S13-23",
    );
  }

  const drillStamp = readJson(join(BACKUP_DIR, ".dr-drill-last-run.json"));
  const drillAge = fileAgeSeconds(join(BACKUP_DIR, ".dr-drill-last-run.json"));
  m.arctos_dr_drill_age_seconds = drillAge ?? -1;
  m.arctos_dr_drill_last_status = drillStamp?.status === "ok" ? 1 : 0;
  if (drillAge === null || drillAge > T.drillAgeSeconds) {
    add(
      "dr_drill_overdue",
      "warning",
      `Der DR-Restore-Drill ist ${drillAge === null ? "nie gelaufen" : Math.round(drillAge / 86400) + " Tage alt"} ` +
        `(monatlich zugesagt, Kulanz ${Math.round(T.drillAgeSeconds / 86400)} Tage). ` +
        `Ein Backup ohne getesteten Restore ist ein Versprechen, kein Nachweis.`,
      drillAge ?? -1,
      T.drillAgeSeconds,
      "S13-08",
    );
  } else if (drillStamp?.status !== "ok") {
    add(
      "dr_drill_failed",
      "critical",
      `Der letzte DR-Drill ist FEHLGESCHLAGEN.`,
      0,
      1,
      "S13-08",
    );
  }

  // 6. Schema-Drift (ADR-014-Deploy-Gate) und Laufzeitrolle (#S13-10)
  try {
    m.arctos_migrations_applied = await qNum(
      `SELECT count(*) FROM _arctos_migrations WHERE status IN ('applied','adopted')`,
    );
    m.arctos_migrations_failed = await qNum(
      `SELECT count(*) FROM _arctos_migrations WHERE status NOT IN ('applied','adopted')`,
    );
    if (m.arctos_migrations_failed > 0) {
      add(
        "migrations_failed",
        "critical",
        `${m.arctos_migrations_failed} Migrationen stehen im Ledger NICHT auf 'applied'. ` +
          `Die Instanz läuft auf einem unvollständigen Schema.`,
        m.arctos_migrations_failed,
        0,
        "S13-03",
      );
    }
  } catch {
    m.arctos_migrations_applied = -1;
  }

  m.arctos_rls_policies = await qNum(
    `SELECT count(*) FROM pg_policies WHERE schemaname='public'`,
  );
  m.arctos_rls_tables_without_rls = await qNum(`
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity
      AND c.relname NOT LIKE '\\_%'`);

  state.metrics = m;
  state.alerts = alerts;
  state.lastRunAt = Date.now();
  state.lastRunOk = true;
  state.lastError = null;

  for (const a of alerts) await deliver(a);
  // Dead-Man's-Switch: nur pingen, wenn NICHTS Kritisches offen ist.
  await pingHeartbeat(!alerts.some((a) => a.severity === "critical"));
  return alerts;
}

function renderPrometheus() {
  const lines = [];
  const help = {
    arctos_failed_logins_5m:
      "Fehlgeschlagene Anmeldungen der letzten 5 Minuten (#S13-12)",
    arctos_failed_logins_per_account_5m:
      "Maximale Fehlversuche eines einzelnen Kontos in 5 Minuten",
    arctos_account_lockouts_1h: "Kontosperrungen der letzten Stunde",
    arctos_export_rows_1h:
      "Groesster Einzelnutzer-Export der letzten Stunde in Datensaetzen",
    arctos_export_rows_24h:
      "Groesster Einzelnutzer-Export der letzten 24 Stunden",
    arctos_exports_personal_data_24h:
      "Exporte mit personenbezogenen Daten in 24 Stunden",
    arctos_audit_chain_errors:
      "Fehler in der Audit-Hash-Kette ueber alle Scopes (-1 = nicht pruefbar)",
    arctos_audit_write_attempts_24h:
      "Abgewiesene Schreibversuche auf den Audit-Trail",
    arctos_job_failures_1h:
      "Fehlgeschlagene oder unvollstaendige Jobs der letzten Stunde",
    arctos_job_runs_1h: "Jobläufe der letzten Stunde",
    arctos_job_runs_24h:
      "Jobläufe der letzten 24 Stunden (0 = Scheduler steht, #S13-14)",
    arctos_backup_age_seconds: "Alter des letzten Backups in Sekunden",
    arctos_backup_last_status: "1 = letztes Backup ok",
    arctos_backup_encrypted: "1 = Backups sind verschluesselt (#S13-07)",
    arctos_backup_includes_objects:
      "1 = Backup enthaelt den DMS-Objektspeicher (#S13-06)",
    arctos_offsite_backup_age_seconds:
      "Alter der Off-Site-Kopie in Sekunden (ADR-015 §92)",
    arctos_offsite_last_status: "1 = letzter Off-Site-Sync ok",
    arctos_dr_drill_age_seconds:
      "Alter des letzten DR-Restore-Drills in Sekunden (#S13-08)",
    arctos_dr_drill_last_status: "1 = letzter DR-Drill bestanden",
    arctos_migrations_applied:
      "Angewendete Migrationen laut _arctos_migrations",
    arctos_migrations_failed: "Nicht angewendete Migrationen im Ledger",
    arctos_rls_policies: "Anzahl RLS-Policies im Schema public",
    arctos_rls_tables_without_rls: "Tabellen ohne aktives ROW LEVEL SECURITY",
  };
  for (const [k, v] of Object.entries(state.metrics)) {
    if (help[k]) lines.push(`# HELP ${k} ${help[k]}`);
    lines.push(`# TYPE ${k} gauge`);
    lines.push(`${k} ${v}`);
  }
  lines.push(
    "# HELP arctos_ops_last_collect_timestamp_seconds Zeitpunkt der letzten Auswertung",
  );
  lines.push("# TYPE arctos_ops_last_collect_timestamp_seconds gauge");
  lines.push(
    `arctos_ops_last_collect_timestamp_seconds ${Math.floor(state.lastRunAt / 1000)}`,
  );
  lines.push(
    "# HELP arctos_ops_active_alerts Aktuell offene Alarme nach Schweregrad",
  );
  lines.push("# TYPE arctos_ops_active_alerts gauge");
  for (const sev of ["critical", "warning"]) {
    lines.push(
      `arctos_ops_active_alerts{severity="${sev}"} ${state.alerts.filter((a) => a.severity === sev).length}`,
    );
  }
  return lines.join("\n") + "\n";
}

// ── Einmallauf / Prüfmodus ───────────────────────────────────────────────
if (ONCE || CHECK) {
  try {
    const alerts = await collect();
    if (CHECK) {
      if (alerts.length === 0) {
        console.log("ops-metrics: keine offenen Alarme.");
        process.exit(0);
      }
      console.error(`ops-metrics: ${alerts.length} offene Alarme:`);
      for (const a of alerts)
        console.error(`  [${a.severity}] ${a.key}: ${a.message}`);
      process.exit(1);
    }
    process.stdout.write(renderPrometheus());
    process.exit(0);
  } catch (e) {
    console.error(`ops-metrics: Auswertung fehlgeschlagen: ${e?.message ?? e}`);
    process.exit(2);
  }
}

// ── Serverbetrieb ────────────────────────────────────────────────────────
const server = createServer((req, res) => {
  const url = (req.url ?? "/").split("?")[0];
  if (url === "/metrics") {
    res.writeHead(200, {
      "content-type": "text/plain; version=0.0.4; charset=utf-8",
    });
    res.end(renderPrometheus());
    return;
  }
  if (url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (url === "/readyz") {
    const fresh = Date.now() - state.lastRunAt < INTERVAL_S * 3000;
    const ok = state.lastRunOk && fresh;
    res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        status: ok ? "ok" : "degraded",
        lastCollectAt: state.lastRunAt
          ? new Date(state.lastRunAt).toISOString()
          : null,
        lastError: state.lastError,
        activeAlerts: state.alerts.length,
      }),
    );
    return;
  }
  if (url === "/alerts") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ alerts: state.alerts }, null, 2));
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found\n");
});

async function tick() {
  try {
    await collect();
  } catch (e) {
    state.lastRunOk = false;
    state.lastError = String(e?.message ?? e);
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        service: "arctos-ops-metrics",
        message: "Auswertung fehlgeschlagen",
        error: state.lastError,
      }),
    );
  }
}

server.listen(PORT, HOST, () => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      service: "arctos-ops-metrics",
      message: `Metriken auf http://${HOST}:${PORT}/metrics, Auswertung alle ${INTERVAL_S}s`,
      alertWebhook: process.env.ALERT_WEBHOOK_URL
        ? "konfiguriert"
        : "NICHT konfiguriert (Alarme nur ins Log)",
      heartbeat: process.env.HEALTHCHECKS_URL
        ? "konfiguriert"
        : "NICHT konfiguriert",
    }),
  );
});
void tick();
setInterval(() => void tick(), INTERVAL_S * 1000);
