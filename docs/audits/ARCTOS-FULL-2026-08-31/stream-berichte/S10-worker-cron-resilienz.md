# S10 — Worker, Cron, Resilienz, Rate Limiting

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Stream:** S10
**Prüfgegenstand:** `/work/repo` @ `a8d1414f` — `apps/worker/**` (128 Cron-Dateien + `index.ts` + `lib/` + `webhooks/`, 13.675 LOC in `crons/`), `packages/email`, `apps/web/src/lib/rate-limit.ts`, `docs/ADR-017/019/021`, `docker-compose.production.yml`, `deploy/**`
**Laufzeit-Evidenz:** lokale PostgreSQL 16 (`grc_platform`), Queries in `/work/audit/evidence/S10/repro-queries.txt`
**Nebenevidenz:** `/work/audit/evidence/S10-cron-matrix.csv`, `/work/audit/evidence/S10/silent-catches.txt`, `/work/audit/evidence/S10/email-template-key-mismatch.txt`

---

## 1. Zusammenfassung

Der Worker ist der Teil der Plattform, der unbeaufsichtigt und mit den höchsten
Datenbankrechten läuft. Der Befund ist zweigeteilt: ein **echtes Sicherheitsloch**
und ein **strukturelles Zuverlässigkeitsproblem**.

**Sicherheit.** Über das Feature „Continuous Audit — Custom SQL Rule" kann ein
Org-Admin oder Auditor beliebiges SQL hinterlegen, das der Worker per `sql.raw()`
auf seinem **PostgreSQL-Superuser-Pool** ausführt und dessen Ergebniszeilen er in
die Exception-Tabelle der eigenen Org zurückschreibt. Die einzige Kontrolle ist
eine Keyword-Denylist aus sieben Wörtern, die `COPY … TO PROGRAM`, `DO $$ … $$`,
`pg_read_file()` und ein schlichtes `SELECT * FROM risk` (= alle Mandanten)
durchlässt. Das ist ein vollständiges Cross-Tenant-Leseprimitiv mit
RCE-Anschluss (**S10-01, Critical**).

**Zuverlässigkeit.** Für die 128 Cron-Jobs existiert **kein Scheduler** — weder in
`docker-compose.production.yml`, noch in `deploy/`, noch im Runbook (**S10-02**).
Und selbst wenn sie liefen, käme keine einzige Deadline-Mail an: 36 der 38
`templateKey`-Werte, die die Crons schreiben, haben in der `EmailService` keinen
`case` und werfen (**S10-03**); und das Resend-SDK wirft grundsätzlich keine
Exceptions, weshalb der gesamte Retry-Block toter Code ist und jeder Zustellfehler
als Erfolg mit `emailSentAt = now()` in die DB geschrieben wird (**S10-04**).
Drei unabhängige Defekte auf demselben Pfad — die Benachrichtigungskette der
Plattform ist an drei Stellen gleichzeitig unterbrochen.

**Nebenläufigkeit und Idempotenz.** In allen 128 Jobs: **0 Advisory Locks,
0 `SELECT … FOR UPDATE SKIP LOCKED`, 3 Transaktionen.** 69 von 128 Jobs sind bei
Doppelausführung nicht idempotent. Acht Queue-Prozessoren „claimen" ihre Jobs mit
einem ungeschützten `SELECT … WHERE status='pending'` → `UPDATE … SET
status='running'` und haben keinen Lease-Timeout, so dass ein Absturz eine Zeile
dauerhaft auf `running` festnagelt.

**Beobachtbarkeit.** 39 vollständig leere `catch`-Blöcke, 28 weitere, die nur
einen Zähler erhöhen — durchgängig mit dem Kommentar „Wrapper logs structured
error", der nachweislich falsch ist (`withCronInstrumentation` loggt nur, was aus
dem Handler _entkommt_). Fehler werden zusätzlich als HTTP 200 `success: true`
mit einem `errors`-Array im Body zurückgegeben. ADR-017 (Monitoring) ist nicht
umgesetzt, und weder `web` noch `worker` haben einen Healthcheck. Ein Cron, der
für jede Org scheitert, ist in dieser Architektur von außen nicht unterscheidbar
von einem, der erfolgreich lief.

**Fabrizierte Compliance-Daten.** Neun Jobs schreiben erfundene Ergebnisse in
Tabellen, die ein Auditor als Nachweis liest: bestandene Connector-Control-Tests
mit `Math.random()`-Laufzeit, „passed" Security-Scans für Marketplace-Plugins,
Monte-Carlo-VaR-Werte aus `Math.random()`, „healthy" Connector-Healthchecks ohne
Ping. Für eine GRC-Plattform ist das die schwerwiegendste Kategorie nach S10-01.

**Rate Limiting.** 5 von 1.357 Routen sind limitiert. Der Login-Pfad
(`/api/auth/[...nextauth]`) hat weder Rate-Limit noch Account-Lockout. Das eine
IP-basierte Limit ist über `X-Forwarded-For` beliebig umgehbar, weil Caddy den
Header anhängt statt ihn zu ersetzen und `getClientIp()` das erste (= vom Client
gelieferte) Element nimmt. Die in ADR-019 als „bestehend" bezeichnete
Caddy-Ebene existiert in `deploy/Caddyfile` nicht.

**Was gut ist** (Kompensationen, die ich geprüft und anerkannt habe): der Worker
ist in keinem Compose-File nach außen gemappt; `/crons/*` ist per `CRON_SECRET`
mit `timingSafeEqual` geschützt und _fail-closed_ bei fehlendem Secret; die
Webhook-Zustellung hat eine ordentliche zweistufige SSRF-Prüfung inkl.
Re-Resolution gegen DNS-Rebinding; `risk-acceptance-expiry.ts` ist ein
mustergültig gebauter Job (Transaktion pro Org, `SET LOCAL`, guarded UPDATE mit
`RETURNING`) — das Team kennt das richtige Muster, es ist nur in 125 von 128
Jobs nicht angewandt; `export_schedule.entity_types` ist API-seitig durch ein
Zod-Enum gedeckelt, was die Injection in `scheduled-export.ts` auf „latent"
herunterstuft.

**Zahlen im Überblick**

| Metrik                                     | Wert                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Cron-Dateien                               | 128 (alle in `index.ts` verdrahtet)                                                        |
| HTTP-Cron-Endpunkte                        | 96 explizit + 31 Batch + 12 Modul-Stubs = 139                                              |
| Scheduler, der sie aufruft                 | **0**                                                                                      |
| Advisory Locks / `SKIP LOCKED`             | **0 / 0**                                                                                  |
| Jobs mit Transaktion                       | **3** (`document-retention-purge`, `process-mining-conformance`, `risk-acceptance-expiry`) |
| Nicht idempotent bei Doppelausführung      | **69 von 128**                                                                             |
| Leere `catch`-Blöcke                       | **39**                                                                                     |
| `catch`, die nur einen Zähler erhöhen      | **28**                                                                                     |
| Notification-Crons ohne Dedup-Guard        | **40 von 44**                                                                              |
| E-Mail-`templateKey`s ohne Implementierung | **36 von 38**                                                                              |
| RLS-Tabellen, die der Worker umgeht        | **460**                                                                                    |
| Rate-limitierte API-Routen                 | **5 von 1.357**                                                                            |

---

## 2. Methodik-Protokoll

Die sieben Punkte aus AUDIT_PLAN.md §S10, jeweils mit dem konkret Getanen.

**(1) Jeder Cron-Job: Idempotenz, Fehlerbehandlung, Teilerfolg, Transaktionsgrenzen.**
Alle 128 Dateien maschinell auf Schreiboperationen, Dedup-Signale
(`onConflict`, Existenzprüfung, Status-Flag im `WHERE`), `transaction(`,
`catch`-Rumpf und Org-Bezug klassifiziert; Ergebnis in
`/work/audit/evidence/S10-cron-matrix.csv` (128 Zeilen). 24 Jobs zusätzlich
vollständig gelesen und die maschinelle Einstufung manuell überschrieben —
die Overrides stehen im Generator und sind in der CSV markiert (Klammerzusatz
in der Spalte `idempotent`). Die `catch`-Analyse ist eine echte
Klammer-Matching-Auswertung, kein Zeilen-Grep (`silent-catches.txt`).

**(2) Nebenläufigkeit / Locking.**
Repo-weite Suche nach `pg_advisory_lock`, `pg_advisory_xact_lock`,
`FOR UPDATE`, `SKIP LOCKED` in `apps/worker/**` → **null Treffer**. Danach
gezielte Prüfung der acht Job-Queue-Prozessoren auf das
read-then-claim-Muster und auf einen Lease-/Timeout-Mechanismus für
abgestürzte Läufe.

**(3) Org-Kontext ohne RLS.**
Ausgangslage aus dem Parallel-Stream übernommen und gegen die laufende DB
verifiziert: `rolsuper = t` für `grc`, `row_security_active('risk') = f`,
460 Tabellen mit `relrowsecurity`. Dann für jede der 128 Dateien bestimmt,
_wie_ der Org-Bezug hergestellt wird (pro Zeile / Org-Schleife mit Filter /
`set_config` / kein Bezug) und die fünf `set_config`-Aufrufe einzeln auf
Transaktionsgrenze und Session-Scope geprüft. Zusätzlich der
Empfänger-Auflösungspfad aller neun Crons geprüft, die über
`user_organization_role` gehen — dort liegt der einzige gefundene reale
Cross-Boundary-Defekt (S10-07), reproduziert mit einer SQL-Transaktion gegen
die Audit-DB.

**(4) Authentifizierung der Worker-Endpunkte.**
`index.ts` vollständig gelesen; Middleware-Scope (`/crons/*`) gegen die
Routenliste gehalten, um die ungeschützten Endpunkte zu finden; Vergleich mit
den Port-Mappings in `docker-compose.production.yml`, `deploy/docker-compose.yml`
und `deploy/ensure-tenant-worker.sh`.

**(5) Rate Limiting.**
`apps/web/src/lib/rate-limit.ts` gelesen, alle Aufrufer gezählt (5 von 1.357
`route.ts`), Bucket-Schlüssel jedes Aufrufers geprüft (IP vs. User),
`getClientIp()` gegen das Caddy-Verhalten gehalten, Login-/Reset-Pfade auf
Limit _und_ Lockout geprüft, ADR-019-Behauptungen gegen `deploy/Caddyfile` und
gegen die Existenz der `RATE_LIMIT_*`-Variablen validiert.

**(6) Fehlerbehandlung app-weit / ADR-021.**
Aufrufer des `problem`-Helpers gezählt (5 von 1.357), Worker-Antwortformat
gegen ADR-021 gehalten, Leak interner Fehlermeldungen im Cron-Response-Body
bewertet.

**(7) E-Mail / Resend.**
`packages/email/src/EmailService.ts` gelesen; das installierte Resend-SDK
(`node_modules/resend/dist/index.cjs:1184-1238`) auf sein Fehlerverhalten
untersucht (wirft nie); die `EmailTemplateKey`-Union, die `switch`-Cases und
die von Crons geschriebenen `templateKey`s per Skript verglichen; Empfänger-
Herkunft aller Sendepfade und Template-Injection-Fläche (React Email,
JSON-API statt SMTP) bewertet; Spam-Relay-Frage entlang der
`recipient_emails`-Felder verfolgt.

**Ausgeschlossen / abgegrenzt.** Der Login-Rate-Limit-Befund (S10-05) berührt
S02; die Klartext-Speicherung des Webhook-Secrets (S10-26) berührt S08; die
verwaisten Dateien nach Retention-Purge (S10-18) berühren S06/S07. Ich führe
sie hier, weil sie aus dem Worker-/Rate-Limit-Scope heraus belegt sind, und
markiere die Überschneidung.

---

## 3. Cron-Job-Matrix

Vollständig (128 Zeilen) als CSV: `/work/audit/evidence/S10-cron-matrix.csv`.
Spalten: `job, endpoint, loc, idempotent, locking, transaktion, org_kontext,
fehlerbehandlung`.

**Aggregat über alle 128 Jobs**

| Dimension                       | Verteilung                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Idempotent bei Doppelausführung | ja 40 · teilweise 19 · **NEIN 69**                                                                                                     |
| Locking                         | **keine 128** (0 Advisory Locks, 0 `SKIP LOCKED`)                                                                                      |
| Transaktion                     | ja 3 · nein 125                                                                                                                        |
| Org-Kontext                     | pro Zeile (`row.orgId`) 75 · kein Org-Bezug 32 · Org-Schleife + `org_id`-Filter 16 · `set_config` SET LOCAL 3 · `set_config` SESSION 2 |
| Fehlerbehandlung                | geloggt 38 · **leerer catch 32** · propagiert 28 · **nur Zähler 19** · `errors[]` im 200er-Body 11                                     |

_(Die Zeilenzahlen bei „leerer catch" / „nur Zähler" zählen Dateien; die
Gesamtzahl der Fundstellen ist 39 bzw. 28, weil mehrere Dateien mehrere haben.)_

**Auszug — die 20 sicherheits-/integritätsrelevantesten Jobs**

| Job                            | Idempotent                                                              | Locking | TX     | Org-Kontext                                           | Fehlerbehandlung                                                   |
| ------------------------------ | ----------------------------------------------------------------------- | ------- | ------ | ----------------------------------------------------- | ------------------------------------------------------------------ |
| `continuous-audit-runner`      | teilweise                                                               | keine   | nein   | pro Zeile                                             | leerer catch (Z. 146) → jede fehlgeschlagene Regel gilt als „pass" |
| `connector-schedule-runner`    | **NEIN** (`next_run_at` nie gesetzt → Dauerschleife)                    | keine   | nein   | pro Zeile                                             | leerer catch (Z. 105)                                              |
| `daily-audit-anchor`           | teilweise (check-then-insert; `failed`-Zeile blockiert Retry dauerhaft) | keine   | nein   | Org-Schleife                                          | `errors[]` im 200er-Body                                           |
| `document-retention-purge`     | teilweise (audit_log-INSERT vor DELETE)                                 | keine   | **ja** | `set_config` SET LOCAL (nach dem INSERT)              | leerer catch (Z. 124, 128)                                         |
| `scheduled-notifications`      | **NEIN** (kein Claim, `emailSentAt` nach Versand)                       | keine   | nein   | pro Zeile                                             | Fehler → `retry_count++`                                           |
| `notification-digest`          | **NEIN** (Mail vor `emailSentAt`)                                       | keine   | nein   | pro Zeile                                             | leerer catch (Z. 124)                                              |
| `wb-deadline-monitor`          | **NEIN**                                                                | keine   | nein   | pro Zeile                                             | leerer catch (Z. 59, 99, 143, 186)                                 |
| `wb-retaliation-check`         | **NEIN**                                                                | keine   | nein   | pro Zeile                                             | leerer catch (Z. 76)                                               |
| `breach-72h-monitor`           | **NEIN**                                                                | keine   | nein   | pro Zeile                                             | geloggt                                                            |
| `dsr-sla-monitor`              | **NEIN**                                                                | keine   | nein   | pro Zeile                                             | geloggt                                                            |
| `import-job-processor`         | **NEIN** (read-then-claim)                                              | keine   | nein   | pro Zeile                                             | Status `failed`                                                    |
| `evidence-review-processor`    | **NEIN** (read-then-claim)                                              | keine   | nein   | pro Zeile                                             | Status `failed`                                                    |
| `var-calculation-runner`       | **NEIN** (read-then-claim)                                              | keine   | nein   | pro Zeile                                             | geloggt                                                            |
| `marketplace-security-scanner` | **NEIN** (read-then-claim)                                              | keine   | nein   | pro Zeile                                             | leerer catch (Z. 55)                                               |
| `simulation-runner`            | **NEIN** (verarbeitet `status='running'`, kein Claim)                   | keine   | nein   | pro Zeile                                             | Status `failed`                                                    |
| `agent-scheduler`              | **NEIN** (read-then-claim)                                              | keine   | nein   | kein Org-Bezug                                        | geloggt                                                            |
| `predictive-risk-trainer`      | **NEIN** (read-then-claim)                                              | keine   | nein   | pro Zeile                                             | leerer catch (Z. 51)                                               |
| `calendar-digest`              | **NEIN** (kein Dedup)                                                   | keine   | nein   | **`set_config` SESSION (`false`) → Pool-Poisoning**   | `errors[]` im 200er-Body                                           |
| `calendar-overdue-check`       | **NEIN** (Eskalation pro Lauf neu)                                      | keine   | nein   | **`set_config` SESSION (`false`)**                    | `errors[]` im 200er-Body                                           |
| `scheduled-export`             | **NEIN** (exportiert nichts)                                            | keine   | nein   | `set_config` SET LOCAL **außerhalb einer TX** = No-op | `errors[]` im 200er-Body                                           |
| `risk-acceptance-expiry`       | **ja** (guarded UPDATE + `RETURNING`)                                   | keine   | **ja** | `set_config` SET LOCAL, korrekt                       | leerer catch (Z. 124)                                              |

---

## 4. Findings

### S10-01 · **Critical** · Beliebiges SQL als DB-Superuser über Continuous-Audit-Regeln — Cross-Tenant-Leseprimitiv mit RCE-Anschluss

**Datei:** `apps/worker/src/crons/continuous-audit-runner.ts:130-147`
(Aufruf: Z. 59-60; Rückschreiben: Z. 81-92)
**Kompensierende Kontrolle:** `isReadOnlySql()` in
`packages/shared/src/schemas/audit-advanced.ts:220-223`, angewandt in
`apps/web/src/app/api/v1/audit-mgmt/continuous-rules/route.ts:51-62`.

```ts
// apps/worker/src/crons/continuous-audit-runner.ts:130-141
async function executeCustomSqlRule(
  rule: typeof continuousAuditRule.$inferSelect,
) {
  const dataSource = rule.dataSource as Record<string, unknown>;
  const query = dataSource?.query as string;
  if (!query) return [];

  // Execute with read-only role and timeout
  try {
    const rows = await db.execute(
      sql.raw(`SET LOCAL statement_timeout = '60s'; ${query}`),
    );
```

```ts
// packages/shared/src/schemas/audit-advanced.ts:219-223
const WRITE_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/i;

export function isReadOnlySql(query: string): boolean {
  return !WRITE_KEYWORDS.test(query);
}
```

Der Kommentar in Z. 137 („Execute with read-only role and timeout") ist in
beiden Aussagen falsch. Es gibt keine Read-only-Rolle: der Worker verbindet
laut `docker-compose.production.yml:310-311` bewusst als `grc`, und gegen die
laufende DB gemessen:

```
$ psql -c "SELECT rolname, rolsuper FROM pg_roles WHERE rolname='grc';"   -> grc | t
$ psql -c "SELECT current_user, row_security_active('risk');"             -> grc | f
$ psql -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE c.relrowsecurity AND n.nspname='public';"                -> 460
```

**Szenario (Eingabe → Wirkung).** Ein Nutzer mit Rolle `admin` oder `auditor`
in _irgendeiner_ Org (die Rollenprüfung in `route.ts:36` verlangt nicht mehr):

1. `POST /api/v1/audit-mgmt/continuous-rules`
   `{"ruleType":"custom_sql","dataSource":{"query":"SELECT * FROM risk"}, …}`
   → `isReadOnlySql("SELECT * FROM risk")` = `true`, Regel wird gespeichert.
2. Der Worker führt sie aus (`sql.raw`, Superuser, RLS inaktiv) und mappt in
   Z. 142-146 **jede Ergebniszeile** auf
   `{ description: JSON.stringify(r), detail: r }`.
3. Z. 81-92 schreibt diese Zeilen in `continuous_audit_exception` mit
   `orgId: rule.orgId` — der Org des Angreifers.
4. Der Angreifer liest die Risiken, Vorfälle, Whistleblowing-Fälle,
   Passwort-Hashes und Session-Tokens **aller Mandanten** in seiner eigenen
   Oberfläche.

Nachgewiesene Denylist-Umgehungen (Skript-Ausgabe in
`evidence/S10/repro-queries.txt`, Abschnitt R3):

| Query                                                              | `isReadOnlySql` | Wirkung als Superuser                 |
| ------------------------------------------------------------------ | --------------- | ------------------------------------- |
| `SELECT * FROM risk`                                               | **passiert**    | Alle Mandanten lesen                  |
| `SELECT pg_read_file('/etc/passwd')`                               | **passiert**    | Dateizugriff auf dem DB-Host          |
| `COPY (SELECT 1) TO PROGRAM 'id'`                                  | **passiert**    | **Befehlsausführung auf dem DB-Host** |
| `DO $$ BEGIN EXECUTE format('%s TABLE risk','DR'\|\|'OP'); END $$` | **passiert**    | Schreiben/DDL trotz Denylist          |
| `GRANT grc TO postgres`                                            | **passiert**    | Rechteausweitung                      |

`COPY`, `DO`, `GRANT`, `SET`, `EXECUTE`, `pg_read_file` und `pg_ls_dir` stehen
nicht in der Denylist. Die Prüfung greift außerdem nur beim `POST`; der Worker
validiert vor der Ausführung nicht erneut.

**Severity-Begründung.** Rubrik §4: „Cross-Tenant-Datenzugriff" _und_ „RCE" —
beide Critical-Kriterien sind erfüllt, jeweils mit einem vollständigen,
reproduzierbaren Pfad von einer regulären Anwendungsrolle aus. Dass der Worker
bewusst als Superuser läuft, ist die dokumentierte Entwurfsentscheidung; genau
deshalb darf auf diesem Pool niemals unvalidiertes SQL landen.

**Empfehlung.** (a) `executeCustomSqlRule` bis zur Absicherung deaktivieren.
(b) Danach: eigene, minimal berechtigte DB-Rolle mit `NOSUPERUSER`,
`GRANT SELECT` nur auf die freigegebenen Views, `SET ROLE` pro Ausführung und
`SET LOCAL row_security = on` innerhalb einer echten Transaktion — plus einen
Org-Filter, der serverseitig in die Query gezwungen wird (View statt
Freitext-SQL). (c) Denylist durch Allowlist ersetzen oder ganz entfernen; sie
gibt falsche Sicherheit.

---

### S10-02 · **High** · Keine der 128 Cron-Jobs wird irgendwo ausgelöst — es existiert kein Scheduler

**Dateien:** `docker-compose.production.yml:285-355` (Worker-Service),
`deploy/docker-compose.yml` (Worker-Service fehlt ganz),
`deploy/ensure-tenant-worker.sh:96-108`, `deploy/create-tenant.sh`,
`deploy/setup-hetzner.sh`, `docs/runbook.md:63-84`

Die 128 Jobs sind ausschließlich als HTTP-Endpunkte erreichbar
(`app.post("/crons/…")`, `apps/worker/src/index.ts:200-1489`). Der Worker
enthält keinen internen Scheduler — repo-weite Suche in `apps/worker` und
`packages` nach `setInterval`, `node-cron`, `croner`, `cron.schedule`: **null
Treffer** (der einzige `setInterval` liegt in
`packages/auth/src/saml/response-validator.ts:26` und räumt einen Cache auf).

Der Header `X-Cron-Secret`, den die Middleware verlangt, kommt im gesamten Repo
außer in `index.ts:147` **nirgends** vor:

```
$ grep -rn "X-Cron-Secret" --include="*" . | grep -v node_modules
./apps/worker/src/index.ts:147:  const secret = c.req.header("X-Cron-Secret");
./apps/worker/coverage/…  (nur generierter Coverage-Report)
```

Die Deploy-Skripte, die die Produktion aufsetzen, erzeugen ein `CRON_SECRET`
(`deploy/create-tenant.sh:54`, `deploy/setup-hetzner.sh:75`), legen aber keinen
Aufrufer an. `docs/runbook.md:63-84` enthält zwei `crontab`-Einträge — beide für
`db-backup.sh` und `offsite-sync.sh`, keiner für einen Cron-Endpunkt. Es gibt
keinen Sidecar-Container, keinen systemd-Timer, keine Vercel-Cron-Config, keine
GitHub-Action, kein `curl` gegen `worker:3001`.

**Szenario.** Deployment nach `deploy/setup-hetzner.sh` + `update-all.sh` — der
dokumentierte Produktionsweg. Der Worker-Container startet, loggt
`[worker] Hono server listening on http://0.0.0.0:3001` und tut ab da nichts.
Konkrete Folgen: `breach-72h-monitor` (DSGVO Art. 33, 72-Stunden-Frist),
`dsr-sla-monitor` (Art. 12 Abs. 3), `wb-deadline-monitor` (HinSchG §17,
7-Tage-Bestätigung / 3-Monats-Rückmeldung), `dora-incident-deadline-monitor`,
`nis2-deadline-monitor`, `document-retention-purge` (Art. 17),
`external-share-expiry` und `portal-session-expiry` (Zugänge laufen nie ab)
und `daily-audit-anchor` (Merkle-Verankerung des Audit-Trails, ADR-011) laufen
nie. Die Plattform meldet gesetzliche Fristen weder, noch löscht sie
fristgebunden, noch verankert sie ihren Audit-Trail.

**Kompensierende Kontrolle geprüft:** keine. Ein Operator _kann_ die Endpunkte
per Hand-Crontab aufrufen; dann ist der Zeitplan der Plattform aber weder
versioniert noch reproduzierbar noch geprüft — was zusätzlich BASE-002
(nicht reproduzierbares Deployment) verschärft.

**Severity-Begründung.** High nach Rubrik „nicht reproduzierbares Deployment";
die betroffene Funktionalität ist der komplette fristgetriebene Teil eines
GRC-Produkts. Kein Critical, weil kein Datenabfluss und keine
Manipulierbarkeit — es passiert schlicht nichts.

---

### S10-03 · **High** · 36 von 38 E-Mail-`templateKey`s existieren nicht — jede Deadline- und Eskalations-Mail stirbt nach drei Versuchen

**Dateien:** `packages/email/src/types.ts:1-27` (Union, 27 Keys),
`packages/email/src/EmailService.ts:190-597` (27 `case`),
`EmailService.ts:593-596` (`default: throw`),
`apps/worker/src/crons/scheduled-notifications.ts:82-83, 114-128`
**Vollständige Liste:** `/work/audit/evidence/S10/email-template-key-mismatch.txt`

```ts
// packages/email/src/EmailService.ts:593-596
      default: {
        const _exhaustive: never = key;
        throw new Error(`Unknown email template key: ${_exhaustive}`);
      }
```

```ts
// apps/worker/src/crons/scheduled-notifications.ts:82-83
const templateKey: EmailTemplateKey =
  (notif.templateKey as EmailTemplateKey) ?? "task_reminder";
```

Der `as`-Cast in Z. 83 hebt die Typprüfung auf: `notification.template_key` ist
eine `varchar`-Spalte, deren Inhalt die Crons frei setzen. Der maschinelle
Vergleich ergibt:

- `EmailTemplateKey`-Union: **27** Keys · `switch`-Cases: **27** · Templates in
  `packages/email/src/templates/`: 25 `.tsx`
- Distinkte `templateKey`s, die die 128 Crons in `notification` schreiben: **38**
- Schnittmenge: **2** — `notification_digest` und `task_overdue`
- Ohne Implementierung: **36**, darunter `breach_72h_warning`,
  `wb_sla_breach_ack`, `wb_sla_breach_response`, `wb_acknowledge_reminder`,
  `wb_response_reminder`, `dsr_sla_warning`, `dora_report_overdue`,
  `ai_act_incident_deadline`, `isms_cap_overdue`, `risk_review_reminder`,
  `policy_overdue`, `document_signature_escalation`, `calendar_weekly_digest`, …

**Szenario.** `breach-72h-monitor.ts:97` schreibt eine Notification mit
`templateKey: "breach_72h_warning"`. `scheduled-notifications.ts:95` ruft
`emailService.send({ templateKey: "breach_72h_warning", … })`.
`renderTemplate` findet keinen `case`, fällt in `default` und wirft
`Unknown email template key: breach_72h_warning`. Der `catch` in Z. 114 erhöht
`retry_count`; nach dem dritten Lauf schließt das `lt(retryCount, 3)`-Prädikat
in Z. 47 die Zeile dauerhaft aus. Die DSGVO-72-Stunden-Warnung existiert dann
als unbeachtete In-App-Notification mit `email_error = 'Unknown email template
key: breach_72h_warning'` und wird nie wieder angefasst.

**Severity-Begründung.** High: der Fehler betrifft alle meldepflichtigen
Fristen (DSGVO Art. 33, HinSchG, NIS2, DORA, AI Act) und ist im laufenden
Betrieb unsichtbar, weil `sent`/`failed` nur in einem HTTP-200-Body stehen,
den niemand abfragt (S10-12).

---

### S10-04 · **High** · Der `EmailService` meldet jeden Zustellfehler als Erfolg; `emailSentAt` wird ohne Versand gesetzt

**Dateien:** `packages/email/src/EmailService.ts:142-180`,
`node_modules/resend/dist/index.cjs:1184-1238`,
`apps/worker/src/crons/scheduled-notifications.ts:95-113`,
`docker-compose.production.yml:236` und `:314`

```ts
// packages/email/src/EmailService.ts:143-148
if (process.env.EMAIL_ENABLED !== "true") {
  console.log(
    `[EmailService] disabled, skipping: ${params.templateKey} -> ${params.to}`,
  );
  return null;
}
```

```ts
// packages/email/src/EmailService.ts:162-179
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this.resend.emails.send({ … });
        return { messageId: result.data?.id ?? "" };
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS - 1) { await this.delay(RETRY_DELAYS[attempt]); }
      }
    }
    throw lastError;
```

**Teil A — der Retry-Block ist toter Code.** Das installierte Resend-SDK
(`resend@^6.17.2`) wirft grundsätzlich nicht. `Client.fetchRequest`
(`node_modules/resend/dist/index.cjs:1184-1238`) fängt alles ab und gibt
Fehler als Rückgabewert zurück — HTTP-Fehler in Z. 1187-1221
(`return { data: null, error: JSON.parse(rawError), … }`) und Netzwerkfehler in
Z. 1228-1237 (`catch { return { data: null, error: { name:"application_error",
… }, headers: null }; }`). Folge: bei einem 422 („domain not verified"), 429
(Resend-Rate-Limit), 401 (falscher Key) oder DNS-Ausfall ist `result.data`
`null`, `result.data?.id ?? ""` ergibt `""`, und Z. 170 gibt
`{ messageId: "" }` als **Erfolg** zurück. Der `catch` in Z. 171 wird nie
erreicht, die drei Retries laufen nie, `throw lastError` (Z. 179) ist
unerreichbar.

**Teil B — der Aufrufer stempelt trotzdem „zugestellt".**

```ts
// apps/worker/src/crons/scheduled-notifications.ts:95-113
        const result = await emailService.send({ to: recipient.email, … });

        // On success: record delivery timestamp and message ID
        await db.update(notification).set({
            emailSentAt: now,
            emailMessageId: result?.messageId ?? null,
            emailError: null,
            …
          }).where(eq(notification.id, notif.id));
        sent++;
```

Es gibt keine Prüfung auf `result === null` und keine auf leere `messageId`.

**Szenario 1 (Standardkonfiguration).** `docker-compose.production.yml:236`
und `:314` setzen beide `EMAIL_ENABLED: ${EMAIL_ENABLED:-false}`. Ein Deploy,
das die Variable nicht setzt — der Default — führt dazu, dass `send()` in
Z. 147 `null` zurückgibt, `scheduled-notifications` `emailSentAt = now()`
schreibt und `sent++` zählt. Der Job meldet `{"success":true,"sent":412}`, es
verlässt keine einzige Mail das System, und weil `isNull(emailSentAt)` in
Z. 44 die Zeilen künftig ausschließt, werden diese 412 Benachrichtigungen auch
nach dem späteren Aktivieren von E-Mail **nie** versendet.

**Szenario 2 (E-Mail aktiv).** Resend antwortet mit 429. `messageId` = `""`,
`emailSentAt = now()`, `emailError = null`. In der DB steht „zugestellt", in
der Realität nicht. Für eine GRC-Plattform ist `notification.email_sent_at`
der Nachweis, dass eine Frist kommuniziert wurde — dieser Nachweis ist
systematisch falsch.

**Severity-Begründung.** High: die Zustell-Statusspalte, auf die sich die
Fristenkommunikation stützt, wird fälschlich als Erfolg geschrieben; der
Zustand ist nicht wiederherstellbar (die Zeilen werden dauerhaft
ausgeschlossen); und der eingebaute Retry-Mechanismus existiert nur auf dem
Papier.

---

### S10-05 · **High** · Rate Limiting: 5 von 1.357 Routen; Login ohne Limit und ohne Lockout; das eine IP-Limit ist über `X-Forwarded-For` umgehbar

**Dateien:** `apps/web/src/lib/rate-limit.ts:45-49, 87-107, 124-134`,
`apps/web/src/app/api/v1/auth/admin-login/route.ts:21-24`,
`packages/auth/src/providers.ts:186-250`, `deploy/Caddyfile:12-27`,
`docs/ADR-019-rate-limiting.md:29-45`
_Überschneidung mit S02 (Auth) — hier aus dem Rate-Limit-Scope belegt._

**(a) Abdeckung.** `rateLimit(` wird in genau **5** von **1.357** `route.ts`
aufgerufen: `ai/suggest-controls`, `ai/draft-policy`, `ai/explain-gap`,
`auth/admin-login`, `copilot/conversations/[id]/messages`. Zwei weitere Routen
(`ai/control-suggestions`, `processes/generate-bpmn`) haben je einen eigenen,
inkompatiblen In-Memory-Limiter. Kein Limit auf: Auth.js-Login
(`/api/auth/[...nextauth]`), Passwort-Reset, Datei-Upload, Export, Import,
Whistleblowing-Intake, Portal.

**(b) Login.** `packages/auth/src/providers.ts:186-250` — die
`authorize`-Funktion protokolliert Fehlversuche über `logAccessEvent`
(`failureReason: "invalid_password"`), drosselt aber nicht. Repo-weite Suche
nach `failedLoginAttempts`, `failed_login`, `locked_until`, `lockout` in
`packages/auth/src`, `packages/db/src/schema` und `apps/web/src/app/api/auth`:
**null Treffer**. Es gibt also weder Rate-Limit noch Account-Lockout; die
einzige Bremse ist die bcrypt-Kostenfunktion.

**(c) `X-Forwarded-For`-Umgehung.**

```ts
// apps/web/src/lib/rate-limit.ts:128-133
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
```

`deploy/Caddyfile:17-27` konfiguriert `reverse_proxy localhost:3000` ohne
`header_up X-Forwarded-For {remote_host}`. Caddy **hängt** die Client-IP an
einen vorhandenen `X-Forwarded-For` an, statt ihn zu ersetzen. Ein Angreifer
sendet `X-Forwarded-For: <zufall>`; am Upstream steht
`"<zufall>, <echte-IP>"`; `split(",")[0]` liefert `<zufall>`. Jeder Request
landet in einem eigenen Bucket → das Limit von 10/min auf
`/api/v1/auth/admin-login` ist mit einem Header-Wert pro Versuch vollständig
aufgehoben. Der Kommentar in Z. 125-127 („Berücksichtigt X-Forwarded-For
(gesetzt vom Caddy-Reverse-Proxy)") beschreibt genau die falsche Annahme.

**(d) Als kompensierend behauptete Kontrolle existiert nicht.** ADR-019 Z. 9-11
und Z. 31 bezeichnen ein Caddy-Limit von „100 req/s pro IP" als „bestehend".
`deploy/Caddyfile` enthält keine `rate_limit`-Direktive (Caddy hat ohne Plugin
auch keine). Ebenso wenig sind die in ADR-019 Z. 68-70 zugesagten
`RATE_LIMIT_DEFAULT` / `RATE_LIMIT_AUTH` / `RATE_LIMIT_COPILOT` irgendwo
implementiert — repo-weite Suche außerhalb von `docs/`: null Treffer.

**(e) Speicher.** `rate-limit.ts:46-49` ist eine `Map`, aus der nie ein Eintrag
entfernt wird. Da der Schlüssel bei `admin-login` die angreiferkontrollierte
XFF-IP enthält, wächst sie mit jedem Request um einen Eintrag → Speicherleck /
langsamer DoS gegen den Web-Container.

**Szenario.** Ein Angreifer mit einer gültigen E-Mail-Adresse aus dem Ziel-Org
fährt Credential-Stuffing gegen `/api/auth/callback/credentials`. Dort greift
gar kein Limit. Weicht er auf `/api/v1/auth/admin-login` aus, rotiert er
`X-Forwarded-For` und erhält ebenfalls unbegrenzte Versuche — bei gleichzeitig
wachsender `inMemoryBuckets`-Map.

**Severity-Begründung.** High: unbegrenzter Brute-Force gegen den
Authentifizierungspfad, mit einer Umgehung, die aus einem einzigen
Request-Header besteht, und ohne die in der ADR unterstellte Infrastruktur-Ebene.

---

### S10-06 · **High** · `connector-schedule-runner` fabriziert bestandene Control-Test-Nachweise und läuft dabei in einer Endlosschleife

**Datei:** `apps/worker/src/crons/connector-schedule-runner.ts:21-104`

```ts
// apps/worker/src/crons/connector-schedule-runner.ts:77-88
await db.insert(connectorTestResult).values({
  orgId: connector.orgId,
  connectorId: connector.id,
  testDefinitionId: testDef.id,
  scheduleId: schedule.id,
  status: "pass", // Simulated — real impl would execute test logic
  result: { scheduled: true },
  findings: [],
  resourcesScanned: 1,
  resourcesFailed: 0,
  durationMs: Math.floor(Math.random() * 500) + 50,
});
```

Es wird kein Test ausgeführt. Jeder in `connector_test_definition` hinterlegte
automatisierte Kontrolltest wird als `pass` mit `resourcesFailed: 0` und einer
**per `Math.random()` erfundenen Laufzeit** in `connector_test_result`
geschrieben. `connector_test_result` ist genau die Tabelle, aus der ein
ISO-27001-/SOC-2-Prüfer den Nachweis kontinuierlicher Kontrollwirksamkeit zieht.

**Zweiter Defekt in derselben Datei.** Die Auswahl in Z. 24-29 filtert
`lte(connectorSchedule.nextRunAt, now)`; das Update in Z. 95-104 setzt
`lastRunAt`, `lastRunStatus`, `lastRunDurationMs`, `consecutiveFailures`,
`updatedAt` — **aber nicht `nextRunAt`**. Repo-weite Prüfung: `nextRunAt` bzw.
`next_run_at` wird für `connector_schedule` an **keiner** Stelle geschrieben
(die Schwesterjobs `agent-scheduler.ts:43`, `report-scheduler.ts:127` und
`bi-report-scheduler.ts:73` tun es korrekt). Ein einmal fälliger Zeitplan
bleibt dauerhaft fällig.

**Szenario.** Zeitplan mit `nextRunAt = gestern`, Connector mit 12
Testdefinitionen, Job alle 15 Minuten (Z. 14: `export const
connectorScheduleRunnerCron = "*/15 * * * *"` — selbst nur eine Konstante, die
niemand liest, vgl. S10-02). Ergebnis: 12 × 96 = **1.152 gefälschte
„pass"-Testergebnisse pro Tag und Zeitplan**, unbegrenzt wachsend. Das
Kontroll-Dashboard zeigt eine lückenlose Historie bestandener automatisierter
Tests, die nie stattgefunden haben.

Ergänzend: `failCount` (Z. 64) wird nirgends erhöht, daher ist
`lastRunStatus` in Z. 99 immer `"success"`; und der `catch` in Z. 105-115
schreibt zwar einen Fehlerstatus, protokolliert die Ursache aber nicht.

**Severity-Begründung.** High: Datenintegrität auf dem Nachweispfad eines
GRC-Produkts. Die Daten sind nicht nur falsch, sie sind in einer Form falsch,
die einen Prüfer aktiv in die Irre führt („1.152 bestandene Tests"), und der
Endlos-Insert ist zusätzlich ein Verfügbarkeitsrisiko.

---

### S10-07 · **High** · Eskalationen — auch Whistleblowing-Fälle — gehen an entzogene Org-Mitgliedschaften

**Dateien:** `apps/worker/src/crons/wb-deadline-monitor.ts:119-124` und
`:162-167`, `wb-retaliation-check.ts:53-56`,
`automation-engine-init.ts:35-40`, `calendar-digest.ts:37-40`,
`playbook-suggestion.ts:106-112`, `playbook-phase-escalation.ts:163-168`,
`risk-appetite-check.ts:117-124`, `fair-appetite-check.ts`
**Positiv-Referenz:** `kri-overdue-alert.ts:57-65`
**Reproduktion:** `/work/audit/evidence/S10/repro-queries.txt`, Abschnitt R2

```ts
// apps/worker/src/crons/wb-deadline-monitor.ts:119-124
const admins = await db.execute(
  sql`SELECT u.id FROM "user" u
            JOIN user_organization_role uor ON uor.user_id = u.id
            WHERE uor.org_id = ${row.org_id} AND uor.role = 'admin'
            AND u.is_active = true`,
);
```

```ts
// apps/worker/src/crons/kri-overdue-alert.ts:59-65   ← korrekt
          .from(userOrganizationRole)
          .where(
            and(
              eq(userOrganizationRole.orgId, overdueKri.orgId),
              inArray(userOrganizationRole.role, ["risk_manager", "admin"]),
              isNull(userOrganizationRole.deletedAt),
```

Der Entzug einer Org-Rolle ist ein Soft-Delete
(`apps/web/src/app/api/v1/users/[id]/roles/[roleId]/route.ts:78-80`:
`UPDATE user_organization_role SET deleted_at = now(), deleted_by = …`).
**8 von 9** Crons, die Empfänger über `user_organization_role` auflösen, filtern
`deleted_at` nicht.

**Reproduktion gegen die Audit-DB** (vollständig in R2): ein Nutzer mit
`user_organization_role.deleted_at = now()` und `user.is_active = true` wird von
der `wb-deadline-monitor`-Query zurückgegeben (1 Zeile), von der
`kri-overdue-alert`-Query nicht (0 Zeilen).

**Szenario.** Eine Compliance-Verantwortliche verlässt das Unternehmen; ihre
Admin-Rolle wird über die UI entzogen (Soft-Delete), ihr `user`-Datensatz
bleibt aktiv, weil sie in einer anderen Org noch Mitglied ist — der Regelfall
in einer Konzernstruktur mit `parent_org_id`. Danach erhält sie weiterhin
Notifications und (nach Behebung von S10-03/04) E-Mails aus der Org, die sie
verlassen hat: bei `wb-deadline-monitor` mit `case_number` und dem Hinweis auf
eine überschrittene HinSchG-Frist, bei `wb-retaliation-check` zu Verdachtsfällen
auf Repressalien. HinSchG §8 verlangt strikte Vertraulichkeit des
Meldeverfahrens gegenüber allen, die nicht mit der Bearbeitung betraut sind.

**Severity-Begründung.** High nach Rubrik „Privilegieneskalation innerhalb eines
Mandanten" bzw. „DSGVO-Verstoß mit Meldepflicht-Potenzial": Empfänger ohne
aktuelle Mitgliedschaft erhalten mandantenbezogene, teils besonders geschützte
Inhalte. Kein Critical, weil der Empfänger vorher legitimes Mitglied war und
kein fremder Mandant betroffen ist.

---

### S10-08 · **High** · `daily-audit-anchor`: eine einmal fehlgeschlagene Verankerung blockiert den Tag dauerhaft; ein Race stuft einen gültigen Anker auf `failed` herunter

**Datei:** `apps/worker/src/crons/daily-audit-anchor.ts:119-150`, `:153-191`,
`:196-229` · **Bezug:** ADR-011 rev.3 (Merkle-Verankerung des Audit-Trails)

```ts
// apps/worker/src/crons/daily-audit-anchor.ts:120-132
    const existing = await db
      .select({ id: auditAnchor.id })
      .from(auditAnchor)
      .where(
        and(
          eq(auditAnchor.orgId, orgId),
          eq(auditAnchor.anchorDate, dayIso),
          eq(auditAnchor.provider, "freetsa"),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
```

```ts
// apps/worker/src/crons/daily-audit-anchor.ts:213-228
  await db.insert(auditAnchor).values({ …, proof: "", proofStatus: "failed",
      lastError: msg.slice(0, 2000) })
    .onConflictDoUpdate({
      target: [auditAnchor.orgId, auditAnchor.anchorDate, auditAnchor.provider],
      set: { lastError: msg.slice(0, 2000), proofStatus: "failed" },
    });
```

**Defekt A — kein Retry nach einem Fehlschlag.** Die Existenzprüfung in
Z. 120-131 filtert nur auf `(orgId, anchorDate, provider)` und **nicht** auf
`proofStatus`. Sobald `logAnchorFailure` eine Zeile mit `proofStatus: 'failed'`
und `proof: ''` geschrieben hat, ist `existing.length === 0` bei jedem
weiteren Lauf falsch → der Anker wird nie wieder versucht. Der Kommentar in
Z. 210-212 („Record the failure so an operator can retry or investigate")
beschreibt eine Möglichkeit, die der Code ausschließt: es gibt keinen
Endpunkt, der `failed`-Anker zurücksetzt.

**Defekt B — Race stuft Erfolg zu Fehler herab.** `SELECT` + `INSERT` sind
nicht atomar und durch nichts serialisiert (kein Advisory Lock, keine
Transaktion). Zwei parallele Läufe sehen beide `existing.length === 0`, beide
fordern einen TSA-Zeitstempel an, beide fügen ein. Der zweite `INSERT`
verletzt den Unique-Index, landet im `catch` (Z. 148) und ruft
`logAnchorFailure` — dessen `onConflictDoUpdate` die **erfolgreiche** Zeile auf
`proofStatus: 'failed'` setzt, obwohl das `proof`-Feld einen gültigen
RFC-3161-Token enthält.

**Szenario.** FreeTSA ist in der Nacht zum 15.08. für zehn Minuten nicht
erreichbar. Der Lauf schreibt `('org-A','2026-08-14','freetsa', proof='',
status='failed')`. Ab dem 16.08. läuft der Job wieder normal — der 14.08.
bleibt aber für immer unverankert, und nichts alarmiert (der Fehler steht nur
im `errors`-Array eines HTTP-200-Bodys, S10-12). Der Audit-Trail hat eine
Tageslücke in seiner Manipulationssicherung, die bei einer späteren
Integritätsprüfung als „nicht verankert" auffällt, ohne dass jemand sagen kann,
ob das ein Ausfall oder eine Manipulation war.

**Severity-Begründung.** High: die Tamper-Evidence des Audit-Trails (ADR-011)
fällt lautlos und dauerhaft für einzelne Tage aus, und Defekt B kann einen
gültigen Nachweis als ungültig markieren. Kein Critical, weil der Audit-Trail
selbst nicht manipulierbar wird — nur seine externe Verankerung fehlt.

---

### S10-09 · **Medium** · Kein einziger Lock-Mechanismus in 128 Jobs; acht Queue-Prozessoren mit ungeschütztem read-then-claim und ohne Lease

**Dateien:** `apps/worker/src/crons/import-job-processor.ts:9-25`,
`evidence-review-processor.ts:16-33`, `agent-scheduler.ts:15-32`,
`var-calculation-runner.ts:25-38`, `marketplace-security-scanner.ts:16-32`,
`predictive-risk-trainer.ts:18-39`, `simulation-runner.ts:21-23`,
`connector-schedule-runner.ts:21-30`

```
$ grep -rn "advisory_lock\|advisory_xact\|FOR UPDATE\|SKIP LOCKED" apps/worker/
(keine Treffer)
```

```ts
// apps/worker/src/crons/import-job-processor.ts:9-25
    const pendingJobs = await db.select().from(importJob)
      .where(eq(importJob.status, "pending")).limit(5);

    for (const job of pendingJobs) {
      try {
        // Mark as running
        await db.update(importJob)
          .set({ status: "running", startedAt: new Date(), … })
          .where(eq(importJob.id, job.id));
```

Das `UPDATE` in Z. 18-25 hat **kein** `AND status = 'pending'` im `WHERE` und
wertet kein `RETURNING` aus. Zwischen `SELECT` und `UPDATE` liegt kein Lock.
Dasselbe Muster in allen acht Dateien. `simulation-runner.ts:21-23` ist der
Extremfall — es selektiert Zeilen, die bereits `status = 'running'` sind, und
verzichtet damit ganz auf einen Claim-Schritt.

**Szenario A (zwei Instanzen).** `deploy/ensure-tenant-worker.sh` erzeugt einen
Worker pro Tenant; skaliert ein Operator `docker compose up --scale worker=2`
oder läuft während eines Rolling-Updates kurz der alte und der neue Container
parallel, verarbeiten beide dieselben fünf `pending`-Import-Jobs.

**Szenario B (Retry nach Timeout, der realistischere Fall).** Der externe
Aufrufer (den es laut S10-02 zwar nicht gibt, den ein Operator aber anlegen
wird) bekommt bei einem langen Lauf ein Gateway-Timeout und wiederholt den
`POST`. Der erste Lauf arbeitet weiter, der zweite greift dieselben Zeilen.

**Szenario C (kein Lease).** Der Worker stirbt (OOM, Deploy), nachdem er
`status='running'` gesetzt hat. Es gibt in keiner der acht Dateien eine
Wiederaufnahme über ein Alter des `started_at`; die Zeile bleibt für immer
`running` / `training` / `scanning`. Der Nutzer sieht im UI einen Import, der
nie fertig wird, und kann ihn nicht neu starten.

**Severity-Begründung.** Medium nach Rubrik „Datenqualitäts-/Integritätsrisiko"
mit Angriffs- bzw. Fehlervoraussetzung (zweite Instanz oder Retry). Die Behebung
ist jeweils eine Zeile — `.where(and(eq(id, …), eq(status, "pending")))` plus
`.returning()` und `if (!claimed.length) continue;`, exakt so wie es
`risk-acceptance-expiry.ts:75-85` bereits vormacht.

---

### S10-10 · **Medium** · 69 von 128 Jobs sind nicht idempotent; 40 von 44 Notification-Crons haben keinen Dedup-Guard

**Dateien:** siehe `/work/audit/evidence/S10-cron-matrix.csv`, Spalte
`idempotent`; Beispiele unten
**Positiv-Referenzen:** `playbook-suggestion.ts:55-65`,
`dd-reminder.ts`, `document-review-reminder.ts`,
`process-review-reminder.ts`, `signature-due-reminder.ts`

```ts
// apps/worker/src/crons/risk-review-reminder.ts:31-37, 53-70
      .where(
        and(
          sql`${risk.reviewDate}::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'`,
          isNotNull(risk.ownerId),
          isNull(risk.deletedAt),
        ),
      );
    …
        await db.insert(notification).values({ userId: riskRow.ownerId!, … });
```

Kein Abgleich gegen bereits erzeugte Notifications, kein `onConflict`, kein
Merker am Risiko. Von den 44 Crons, die `insert(notification)` aufrufen,
enthalten **40** keinerlei Dedup-Signal (`onConflict`, Existenzprüfung,
`lastReminderAt`/`notifiedAt`/`escalatedAt`-Flag).

**Szenario.** `risk-review-reminder` läuft täglich. Ein Risiko mit
Review-Datum in 14 Tagen liegt an 15 aufeinanderfolgenden Tagen im Fenster →
15 identische „Risk review upcoming"-Notifications für denselben Owner. Bei
300 Risiken in einem Portfolio sind das 4.500 Zeilen und (nach Behebung von
S10-03/04) 4.500 E-Mails für ein und dieselbe Sachlage. Bei
`calendar-overdue-check.ts:53-67` ist der Effekt schärfer: eine überfällige
DSR erzeugt an jedem Tag, an dem sie überfällig bleibt, eine neue
`escalation`-Notification — das Eskalationssignal wird durch Wiederholung
entwertet.

Der Gegenbeleg im selben Repo, `playbook-suggestion.ts:55-65`:

```ts
const existingSuggestion = await db.execute(sql`
        SELECT id FROM notification
        WHERE org_id = ${incident.orgId} AND type = 'status_change'
          AND title LIKE '%Playbook recommended%' AND entity_id = ${incident.id}::uuid
        LIMIT 1`);
if (existingSuggestion.length > 0) continue;
```

**Severity-Begründung.** Medium: kein Sicherheitsdefekt, aber ein
Datenqualitätsproblem, das den Nutzwert des Benachrichtigungssystems zerstört
(Alert Fatigue) und die `notification`-Tabelle unbegrenzt wachsen lässt.

---

### S10-11 · **Medium** · 39 leere `catch`-Blöcke und 28 Zähler-only-`catch` — der begründende Kommentar ist nachweislich falsch

**Vollständige Liste:** `/work/audit/evidence/S10/silent-catches.txt`
**Belegdateien:** `apps/worker/src/lib/cron-instrument.ts:88-116`,
`apps/worker/src/crons/notification-digest.ts:124-126`,
`document-retention-purge.ts:124-130`, `wb-deadline-monitor.ts:59, 99, 143, 186`

```ts
// apps/worker/src/crons/notification-digest.ts:122-127
        emailsSent++;
      } catch {
        // Wrapper logs structured error; loop continues to next user.
      }
    }
```

Der Kommentar steht wortgleich in Dutzenden Dateien und ist falsch.
`withCronInstrumentation` (`lib/cron-instrument.ts:92-116`) loggt in seinem
`catch` nur, was aus dem Handler **entkommt** — ein `catch` innerhalb der
Schleife verhindert genau das:

```ts
// apps/worker/src/lib/cron-instrument.ts:99-116
    } catch (err) {
      …
      emit("error", { cron: cronName, phase: "error", … });
      throw err;
    }
```

Maschinelle Auswertung mit Klammer-Matching über `apps/worker/src`:
**39 catch-Blöcke mit vollständig leerem Rumpf**, **28 weitere**, deren Rumpf
ausschließlich aus `errors++` / `result.errors++` / `void err;` besteht.

**Szenario.** `document-retention-purge.ts:128-130` — der Löschauftrag für ein
Dokument scheitert, weil ein Fremdschlüssel ohne `ON DELETE CASCADE` blockiert.
Der leere `catch` verschluckt den Fehler, die Schleife läuft weiter, `purged`
wird nicht erhöht, der Rückgabewert ist `{scanned: 500, purged: 0,
filesDeleted: 0}` mit HTTP 200 und `success: true`. In den Logs steht nur die
`finish`-Zeile des Wrappers mit genau diesem Ergebnis. Es gibt keine
Fehlermeldung, keinen Stacktrace, keinen Tabellennamen — die DSGVO-Löschpflicht
bleibt unerfüllt und der Betreiber erfährt es nicht.

Besonders kritisch, weil es dort um gesetzliche Fristen geht:
`wb-deadline-monitor.ts` (4 leere `catch`), `isms-cap-overdue-monitor.ts` (2),
`process-review-reminder.ts` (2), `risk-appetite-check.ts` (2),
`document-retention-purge.ts` (2).

**Severity-Begründung.** Medium: keine direkte Ausnutzbarkeit, aber der
Ausfall jeder einzelnen dieser Funktionen ist per Konstruktion unsichtbar.
Zusammen mit S10-12 und dem nicht umgesetzten ADR-017 bedeutet das: der
Betriebszustand des Workers ist von außen nicht feststellbar.

---

### S10-12 · **Medium** · Fehlerhafte Läufe antworten mit HTTP 200 `success: true`

**Dateien:** `apps/worker/src/index.ts:200-209` (Muster, 139×),
`crons/calendar-digest.ts:116-122`, `crons/daily-audit-anchor.ts:67-77`,
`docs/ADR-017-monitoring.md` (nicht umgesetzt)

```ts
// apps/worker/src/index.ts:200-209
app.post("/crons/overdue-tasks", async (c) => {
  try {
    const result = await processOverdueTasks();
    return c.json({ success: true, ...result });
  } catch (err) {
    …
    return c.json({ success: false, error: message }, 500);
  }
});
```

Ein 500er entsteht nur, wenn der Handler wirft. Die 11 Jobs, die stattdessen
ein `errors`-Array zurückgeben, und die 19, die nur einen `errors`-Zähler
führen, werden durch `...result` in denselben `success: true`-Body gespreizt:

```json
{"success":true,"orgsProcessed":48,"anchorsCreated":0,
 "errors":["org a1…: FreeTSA status code 2", … 48 Einträge]}
```

`daily-audit-anchor` hat für **jede** Org versagt und meldet HTTP 200 mit
`success: true`. Jedes Monitoring, das — wie in ADR-017 Phase 1 vorgesehen —
auf den HTTP-Status pingt, sieht „grün".

ADR-017 ist nicht umgesetzt: kein Healthchecks.io-Setup in `deploy/`, kein
`promtail`, kein `postgres-exporter`, kein `/api/v1/metrics`-Endpunkt.

**Severity-Begründung.** Medium: der einzige maschinenlesbare Erfolgsindikator
des Systems ist systematisch falsch, und die in der ADR vorgesehene
Kompensation existiert nicht.

**Empfehlung.** `success: errors.length === 0` und HTTP 207/500 bei partiellem
bzw. vollständigem Fehlschlag; `errors`/`failed` zusätzlich als NDJSON-Feld in
die `finish`-Zeile von `withCronInstrumentation` aufnehmen.

---

### S10-13 · **Medium** · Nur 3 von 128 Jobs benutzen eine Transaktion; Teilerfolge hinterlassen inkonsistenten Zustand

**Dateien:** `apps/worker/src/crons/overdue-tasks.ts:44-119`,
`document-retention-purge.ts:78-127`, `continuous-audit-runner.ts:66-101`
**Transaktionen vorhanden nur in:** `document-retention-purge.ts`,
`process-mining-conformance.ts`, `risk-acceptance-expiry.ts`

```ts
// apps/worker/src/crons/overdue-tasks.ts:47-59
    try {
      await db.update(task).set({ status: "overdue", updatedAt: now })
        .where(and(sql`${task.id} = ANY(${taskIds}::uuid[])`, isNull(task.deletedAt)));
    } catch (err) { … return { processed: 0, errors }; }

    // Create notifications for each overdue task
    for (const overdueTask of overdueTasks) {   // Z. 69
```

Der Massen-Statuswechsel (Z. 48-59) und das Erzeugen der Notifications
(Z. 69-119) liegen in getrennten, nicht umschlossenen Operationen. Die
Auswahl in Z. 32-38 schließt `status = 'overdue'` aus.

**Szenario.** Der Worker wird zwischen Z. 59 und dem Ende der Schleife beendet
(Deploy, OOM, Container-Restart) — bei 5.000 überfälligen Tasks eine
realistische Fenstergröße. Alle 5.000 sind auf `overdue` gesetzt, ein Teil hat
keine Notification. Der nächste Lauf findet sie wegen `notInArray(task.status,
["done","cancelled","overdue"])` nicht mehr. Die Benachrichtigung ist dauerhaft
verloren, und der Zustand ist aus dem Datenmodell nicht rekonstruierbar.

Analog `continuous-audit-runner.ts:66-101`: `continuousAuditResult` (Z. 66-77),
`continuousAuditException` (Z. 81-91) und `lastExecutedAt` (Z. 98-101) sind
drei separate Schreibvorgänge; ein Abbruch dazwischen hinterlässt ein Ergebnis
ohne seine Exceptions oder ein Ergebnis, dessen Regel beim nächsten Lauf erneut
läuft und ein Duplikat erzeugt.

**Severity-Begründung.** Medium: Datenintegritätsrisiko mit realistischer
Auslösung (jeder Deploy), ohne Sicherheitswirkung.

---

### S10-14 · **Medium** · Das Setzen des Org-Kontexts ist in allen fünf Fundstellen wirkungslos oder fehlerhaft — inklusive Poisoning des geteilten Connection-Pools

**Dateien:** `apps/worker/src/crons/calendar-digest.ts:72-74`,
`calendar-overdue-check.ts:35-38`, `scheduled-export.ts:46-49`,
`document-retention-purge.ts:100-104`, `risk-acceptance-expiry.ts:45-48` (korrekt)
**Kontext:** `packages/db/src/index.ts:161-175` (Basispool, `max: 10`),
`packages/db/src/request-context.ts:37-47` (Warnung vor genau diesem Effekt)

**(a) Session-Scope auf einer Pool-Verbindung.**

```ts
// apps/worker/src/crons/calendar-digest.ts:71-74
// Set RLS context
await db.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, false)`);
```

Das dritte Argument `false` bedeutet _session-lokal_, nicht
transaktionslokal. `db.execute` entnimmt dem Basispool
(`packages/db/src/index.ts:171-175`, `postgres(RUNTIME_DATABASE_URL, {max: 10})`)
eine beliebige Verbindung, führt das Statement aus und gibt sie zurück. Zwei
Konsequenzen:

1. Die _nächste_ Abfrage (Z. 79-89) läuft mit hoher Wahrscheinlichkeit auf
   einer **anderen** Verbindung. Der Kontext gilt also nicht für die Abfrage,
   für die er gesetzt wurde — der Kommentar „Set RLS context" ist irreführend.
2. Der GUC bleibt dauerhaft auf der Verbindung stehen. `request-context.ts:37-45`
   beschreibt dieses Problem ausdrücklich und begründet damit die Existenz eines
   **separaten** Pools für Request-Verbindungen: _„once a custom GUC has been
   set on a connection, neither `RESET app.current_org_id` nor
   `set_config(..., NULL, ...)` restores it to NULL — it becomes the empty
   string ''. […] A reserved connection returned to the SHARED base pool would
   therefore poison later context-less queries."_ Genau das tun
   `calendar-digest` und `calendar-overdue-check` mit dem Basispool.

**(b) `SET LOCAL` außerhalb einer Transaktion = No-op.**

```ts
// apps/worker/src/crons/scheduled-export.ts:46-49
// Set org context for RLS
await db.execute(
  sql`SELECT set_config('app.current_org_id', ${schedule.org_id}, true)`,
);
```

`true` = transaktionslokal. `db.execute` läuft hier ohne umschließende
Transaktion, also gilt der Wert nur für die implizite Ein-Statement-Transaktion
und ist beim nächsten Statement wieder weg.

**(c) Reihenfolge.** `document-retention-purge.ts` setzt den Kontext in
Z. 100-103 — **nach** dem `INSERT INTO audit_log` in Z. 81-98, innerhalb
derselben Transaktion. Wäre RLS aktiv, liefe der Audit-Log-Eintrag ohne
Org-Kontext.

**(d) Korrekt** ist ausschließlich `risk-acceptance-expiry.ts:45-48`:
`db.transaction(async (tx) => { await tx.execute(sql\`SELECT
set_config('app.current_org_id', ${orgId}, true)\`); … })`.

**Wirkung heute.** Weil der Worker als Superuser läuft (`rolsuper = t`,
`row_security_active('risk') = f`, 460 RLS-Tabellen), hat der GUC aktuell
**keine** Filterwirkung — es entsteht heute kein Cross-Tenant-Zugriff. Der
Befund ist trotzdem relevant: (i) er dokumentiert eine Schutzmaßnahme, die
nicht existiert, und schafft damit falsche Sicherheit in Code-Reviews;
(ii) er macht genau den Migrationspfad kaputt, den die Remediation von
#SEC-F01b für den Worker nehmen müsste — würde der Worker auf `grc_app`
umgestellt, lieferten `calendar-digest` und `scheduled-export` sofort 0 Zeilen
bzw. die Zeilen der falschen Org, und die vergiftete Basispool-Verbindung
würde alle kontextlosen Abfragen mit `invalid input syntax for type uuid: ""`
abbrechen.

**Severity-Begründung.** Medium: keine heute ausnutzbare Wirkung (der
Superuser-Betrieb macht den GUC bedeutungslos), aber ein Integritäts- und
Wartbarkeitsdefekt, der die naheliegende Härtungsmaßnahme blockiert.

---

### S10-15 · **Medium** · Neun weitere Jobs schreiben erfundene oder leere Ergebnisse in Nachweistabellen und melden Erfolg

**Dateien und Zitate:**

| Datei:Zeile                             | Zitat / Wirkung                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketplace-security-scanner.ts:34-47` | `// In production: run static analysis, dependency scan, malware check` / `// For now: auto-pass with no findings` / `const passed = true;` → jedes Marketplace-Plugin erhält `scanStatus:"passed"`, `criticalCount:0`                                                                                                              |
| `connector-health-monitor.ts:27-40`     | `// Simulated health check — real implementation would ping the provider` / `const isHealthy = true;` → `connector_health_check` mit `status:"healthy"` ohne jeden Kontakt zum Provider                                                                                                                                             |
| `simulation-runner.ts:35-46`            | `// Insert placeholder results` / `meanValue: String(Math.random() * 1000000), medianValue: …, p5Value: …, p95Value: …` → Monte-Carlo-/VaR-Kennzahlen aus dem Zufallsgenerator, `unit: "EUR"`                                                                                                                                       |
| `continuous-audit-runner.ts:126-128`    | `// Built-in rule implementations would go here` / `// For now, return empty (pass)` / `return [];` → jede Builtin-Regel meldet „pass"                                                                                                                                                                                              |
| `import-job-processor.ts:37-39`         | `// Pre-existing stub: actual per-item processing not yet wired up, so we simply count the pack items as "processed"` → Job endet mit `status:"completed"`, ohne etwas zu importieren                                                                                                                                               |
| `scheduled-export.ts:52-56`             | führt nur `SELECT COUNT(*)` aus, aktualisiert `last_run_at`, zählt `exported++`; `recipient_emails` wird selektiert und nie benutzt → geplante Exporte werden nie erzeugt und nie versendet                                                                                                                                         |
| `automation-engine-init.ts:105-111`     | `sendEmail: async (params) => { console.log(…) }` → die E-Mail-Aktion der Automation-Engine ist ein `console.log`                                                                                                                                                                                                                   |
| `executive-kpi-snapshot.ts:119-121`     | `auditSlaCompliance: 0, // Placeholder for audit module` (3×) → Führungs-KPIs werden mit 0 persistiert                                                                                                                                                                                                                              |
| `lib/module-aware-cron.ts:18-104`       | 12 registrierte Modul-Hintergrundprozesse, jeder `return { processed: 0 }` mit `// TODO` — unter anderem `risk-review-reminders`, `dpia-review-reminders`, `consent-expiry-check`, `case-escalation-check`; erreichbar unter `POST /crons/modules/<name>` (`index.ts:939-950`), Antwort `{"success":true,"cron":"…","processed":0}` |

**Szenario.** Ein Betreiber verdrahtet seinen Scheduler gegen
`/crons/modules/consent-expiry-check` (der Name steht in `module_definition`
als Hintergrundprozess des DPMS-Moduls). Der Endpunkt antwortet dauerhaft
`{"success":true,"processed":0}`. Ablaufende Einwilligungen werden nie
geprüft, und weder Log noch Antwort weisen darauf hin, dass hinter dem
Endpunkt ein `// TODO` steht.

Ein Auditor, der `marketplace_security_scan` oder `connector_test_result`
prüft, findet lückenlose Bestanden-Historien. Nichts in den Daten
unterscheidet sie von echten Prüfergebnissen — die Kennzeichnung existiert nur
im Quellcode-Kommentar.

**Severity-Begründung.** Medium (S10-06 ist wegen Umfang und Endlosschleife
gesondert als High geführt): Datenintegritätsrisiko auf Nachweispfaden. Kein
High, weil die betroffenen Module Zusatzfunktionen sind und kein
Regulierungspfad unmittelbar davon abhängt — anders als bei S10-06.

---

### S10-16 · **Medium** · Automation-Engine `changeStatus` schreibt in eine frei wählbare Tabelle

**Datei:** `apps/worker/src/crons/automation-engine-init.ts:113-121`

```ts
  changeStatus: async (params) => {
    // Generic status update via raw SQL (entity type varies)
    try {
      await db.execute(
        sql`UPDATE ${sql.identifier(params.entityType)} SET status = ${params.newStatus}, updated_at = now() WHERE id = ${params.entityId}::uuid AND org_id = ${params.orgId}::uuid`,
      );
    } catch (err) {
      console.error("[AutomationServices] changeStatus failed:", err);
    }
  },
```

`sql.identifier()` quotet den Bezeichner korrekt — eine klassische
SQL-Injection liegt **nicht** vor, und der `org_id`-Filter verhindert
mandantenübergreifende Schreibzugriffe. Der Defekt ist ein anderer: der
Tabellenname stammt aus der Automation-Regel, die ein Org-Nutzer in der UI
anlegt, und wird gegen keine Allowlist geprüft. Damit kann eine Regel den
`status` **jeder** Tabelle setzen, die `id`, `org_id`, `status` und
`updated_at` hat — auch solcher, für die der Regelautor keine Route-Berechtigung
besitzt.

**Szenario.** Ein Nutzer mit Automation-Bearbeitungsrecht, aber ohne
DMS-Rechte, legt eine Regel `changeStatus(entityType: "document", newStatus:
"expired")` an. Das Dokument wird auf `expired` gesetzt und ist damit —
zusammen mit einem abgelaufenen `retention_until` — ein Kandidat für
`document-retention-purge.ts:36-46`, das nach `status IN ('archived',
'expired')` selektiert und hart löscht. Eine Automation-Regel wird so zum
Löschwerkzeug für Dokumente, an die der Autor sonst nicht herankäme.

Gleiche Datei, verwandter Defekt: `resolveOrgUserForRole` (Z. 31-41) filtert
`user_organization_role.deleted_at` nicht (siehe S10-07) und liefert
`role IN (<gewünscht>, 'admin')` — die Automation kann also immer einen
Admin als Aufgabenempfänger auswählen.

**Severity-Begründung.** Medium: Umgehung der Objektberechtigungen innerhalb
eines Mandanten mit realem Folgeschaden (Löschpfad), aber Voraussetzung ist
eine erhöhte Rolle (Automation-Regeln anlegen).

---

### S10-17 · **Medium** · Webhook-Retries verhungern hinter einem ungefilterten `LIMIT 50`

**Datei:** `apps/worker/src/webhooks/webhook-delivery.ts:272-302`

```ts
export async function processWebhookRetries(): Promise<{ processed: number }> {
  const pendingRetries = await db
    .select()
    .from(webhookDeliveryLog)
    .where(eq(webhookDeliveryLog.status, "retrying"))
    .limit(50);
  …
  for (const delivery of pendingRetries) {
    if (delivery.nextRetryAt && new Date(delivery.nextRetryAt) <= now) {
```

Das `LIMIT 50` steht in der Abfrage, das Fälligkeitskriterium
(`nextRetryAt <= now`) erst in JavaScript. Es gibt kein `orderBy`, die
Reihenfolge ist also die physische Heap-Reihenfolge.

**Szenario.** Ein Kundenendpunkt ist über Nacht nicht erreichbar; 400
Zustellungen stehen mit `status = 'retrying'` und einem `next_retry_at` in 30
Minuten. Jetzt scheitert eine wichtige Zustellung an einen anderen Empfänger
und wird ebenfalls `retrying` mit `next_retry_at` in 60 Sekunden. Die Abfrage
liefert 50 beliebige der 401 Zeilen; die Wahrscheinlichkeit, dass die fällige
dabei ist, liegt bei ~12 %. Solange der Rückstau besteht, werden fällige
Retries nicht abgearbeitet — der Rückstau baut sich nicht ab, weil er sich
selbst blockiert.

**Nebenbefund (Info, dokumentiert).** `processWebhookDispatch`
(Z. 234-266) selektiert `status='pending'` ohne Claim; die Doku in Z. 227-232
weist das explizit als At-least-once aus („consumers must deduplicate on their
side"). Das ist eine bewusste, vertretbare Entscheidung. Zu beachten ist, dass
`webhook-retry` sie in Z. 31 zusätzlich aufruft — sind beide Endpunkte
verplant, ist die Doppelzustellung nicht mehr Ausnahme, sondern Regel.

**Severity-Begründung.** Medium: Verfügbarkeits-/Zustellungsdefekt mit
konkreter, nicht selbstheilender Auslösung.

---

### S10-18 · **Medium** · Retention-Purge: Datei-Löschfehler werden verschluckt — personenbezogene Dateien überleben die DB-Löschung ohne Referenz

**Datei:** `apps/worker/src/crons/document-retention-purge.ts:117-130`
_Überschneidung mit S06 (DMS/Storage) und S07 (DSGVO)._

```ts
// 3. Physical files (best effort, after commit)
const storage = getFileStorage();
for (const relPath of filePaths) {
  try {
    if (await storage.delete(relPath)) {
      filesDeleted++;
    }
  } catch {
    // Already gone or not accessible — nothing to do.
  }
}
```

Die Reihenfolge (Z. 9-15 im Dateikopf dokumentiert) ist bewusst: erst
DB-Löschung committen, dann Dateien löschen. Damit ist die Datei nach einem
Fehlschlag aber **nicht mehr auffindbar** — die `document`- und
`document_file`-Zeilen mit dem `file_path` sind weg. Der `catch` in Z. 124-126
unterscheidet nicht zwischen „war schon weg" (harmlos) und „S3 antwortet mit
403 / Volume read-only / Netzwerkfehler" (Datenrest).

Der Purge-Job selbst läuft nach `docker-compose.production.yml:293-300` gegen
ein `read_only: true`-Root-Dateisystem mit `uploads:/app/uploads` als einzigem
beschreibbaren Volume — ein Konfigurationsfehler am Volume oder ein
S3-Credential-Ablauf erzeugt exakt dieses Szenario.

**Szenario.** Ein Betroffener macht sein Löschrecht nach DSGVO Art. 17 geltend;
der Retention-Purge löscht die Metadaten, das S3-Delete scheitert wegen eines
abgelaufenen `S3_SECRET_ACCESS_KEY`. Das Ergebnis meldet
`{"success":true,"scanned":40,"purged":40,"filesDeleted":0}`. Die Dokumente
mit den personenbezogenen Daten liegen weiter im Objektspeicher, ohne
DB-Referenz, ohne Log, ohne Möglichkeit sie zu finden. `filesDeleted: 0` neben
`purged: 40` wäre der einzige Hinweis — und steht in einem HTTP-200-Body, den
niemand liest (S10-12).

**Severity-Begründung.** Medium: DSGVO-Löschpflicht wird faktisch nicht erfüllt
und der Zustand ist nach Eintritt nicht mehr auflösbar; die Auslösung braucht
aber einen Storage-Fehler, ist also nicht der Regelfall.

**Empfehlung.** Datei-Löschung vor dem Commit versuchen oder eine
`pending_file_deletion`-Outbox schreiben, bevor die DB-Zeilen verschwinden;
Fehler zwingend protokollieren.

---

### S10-19 · **Low** · Latente SQL-Injection in `scheduled-export` (kompensiert durch Zod-Enum)

**Datei:** `apps/worker/src/crons/scheduled-export.ts:52-56`
**Kompensierende Kontrolle:** `packages/shared/src/schemas/import-export.ts:5-14`
und `:79`, angewandt in `apps/web/src/app/api/v1/export/schedules/route.ts` und
`…/[id]/route.ts:38`

```ts
await db.execute(
  sql.raw(
    `SELECT COUNT(*) as cnt FROM "${entityType}" WHERE org_id = '${schedule.org_id}'`,
  ),
);
```

`entityType` wird ohne jedes Escaping in einen doppelt-gequoteten Bezeichner
interpoliert; ein Anführungszeichen im Wert bricht aus. Ausgeführt würde das
auf dem Superuser-Pool (siehe S10-01).

**Warum nur Low:** `createExportScheduleSchema` und
`updateExportScheduleSchema` beschränken `entityTypes` auf
`z.array(z.enum(importEntityTypeValues))` mit acht festen Werten (`risk`,
`control`, `asset`, `vendor`, `contract`, `incident`, `process`,
`ropa_entry`); beide Routen validieren. Über die dokumentierte API ist der Wert
also nicht frei setzbar. Die Injektion bleibt als Härtungslücke bestehen:
Zeilen aus Seeds, Migrationen oder einem künftigen Import-Pfad umgehen die
Zod-Schicht, und der Worker validiert nicht erneut.

---

### S10-20 · **Low** · Drei unauthentifizierte Worker-Endpunkte (kompensiert durch fehlendes Port-Mapping)

**Datei:** `apps/worker/src/index.ts:146-165` (Middleware), `:171-178`
(`GET /health`), `:183-196` (`POST /events/auth`), `:1063-1071`
(`GET /automation/health`)

```ts
app.use("/crons/*", async (c, next) => {
  const secret = c.req.header("X-Cron-Secret");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return c.json({ error: "CRON_SECRET not configured on server" }, 500);
  }
  const secretBuf = Buffer.from(secret ?? "");
  const expectedBuf = Buffer.from(expected);
  if (
    secretBuf.length !== expectedBuf.length ||
    !require("crypto").timingSafeEqual(secretBuf, expectedBuf)
  ) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});
```

Die Middleware ist sauber gebaut: `timingSafeEqual`, fail-closed bei fehlendem
Secret (500 statt Durchlass), kein Fallback-Default. Sie deckt aber nur
`/crons/*`. `GET /health`, `GET /automation/health` und `POST /events/auth`
liegen außerhalb.

`POST /events/auth` (Z. 183-196) nimmt beliebiges JSON an, tut ausweislich der
`TODO`-Kommentare nichts außer `console.log`, und ein nicht-JSON-Body lässt
`c.req.json()` werfen → Hono-Default-500.

**Kompensierende Kontrolle geprüft und wirksam:**
`docker-compose.production.yml:352` — _„Kein Port exposed — nur intern via
Docker-Netzwerk erreichbar"_; auch `deploy/ensure-tenant-worker.sh:96-108`
mappt keinen Port. Erreichbar ist der Worker damit nur aus dem
`arctos`-Docker-Netz (web, postgres, redis, clamav, garage/minio). Restrisiko:
ein SSRF im Web-Container oder ein kompromittierter Sidecar erreicht
`http://worker:3001/events/auth` und `/automation/health`.

**Nebenbefund.** Der Längenvergleich vor `timingSafeEqual` verrät die Länge des
Secrets — bei einem 32-Zeichen-Hex-Secret praktisch irrelevant, aber der
Vollständigkeit halber erwähnt.

---

### S10-21 · **Low** · Kein Healthcheck für `web` und `worker`; `/health` prüft die Datenbank nicht

**Dateien:** `docker-compose.production.yml` (Healthchecks nur bei `postgres:41-45`,
`redis:54-58`, `garage:81-87`, `minio:117-122`, `clamav:162-168`),
`apps/worker/src/index.ts:171-178`, `Dockerfile.worker` (kein `HEALTHCHECK`)

```ts
app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "worker",
    timestamp: new Date().toISOString(),
  }),
);
```

Die Antwort ist eine Konstante — kein `SELECT 1`, keine Pool-Prüfung. Ein
Worker mit erschöpftem oder toter Verbindungspool antwortet weiterhin `"ok"`.
Da weder `web` noch `worker` einen Compose-Healthcheck haben, greift auch
`restart: unless-stopped` nur bei einem Prozessabbruch, nicht bei einem
hängenden Prozess.

---

### S10-22 · **Low** · Interne Fehlermeldungen im Antwort-Body der Cron-Endpunkte

**Datei:** `apps/worker/src/index.ts:204-208` (Muster, 139×)

```ts
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] overdue-tasks cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
```

`err.message` einer `postgres`-Fehlermeldung enthält Tabellen-, Spalten- und
Constraint-Namen sowie Ausschnitte des Statements. Kein Stacktrace (nur
`.message`), und der Aufrufer muss das `CRON_SECRET` kennen — deshalb Low, nicht
Medium. Gleiches gilt für die `errors`-Arrays in den 200er-Bodies
(z. B. `daily-audit-anchor.ts:69`: `errors.push(\`org ${orgId}: ${msg}\`)`),
die zusätzlich Org-UUIDs offenlegen.

---

### S10-23 · **Low** · Unbegrenzt wachsende Rate-Limit-Map

**Datei:** `apps/web/src/lib/rate-limit.ts:45-49, 51-78`

```ts
const inMemoryBuckets = new Map<
  string,
  { tokens: number; lastRefillMs: number }
>();
```

Es gibt keine Eviction und keine Größenbegrenzung; `inMemoryCheck` schreibt bei
jedem Aufruf (`set` in Z. 67 und Z. 72). Für die vier userbasierten Buckets ist
das durch die Nutzerzahl gedeckelt. Für `admin-login:${ip}` ist der Schlüssel
über `X-Forwarded-For` angreiferkontrolliert (S10-05c) — jeder Request erzeugt
einen neuen, nie freigegebenen Eintrag. Ergebnis: langsam wachsender
Speicherverbrauch des Web-Containers, der nur durch einen Neustart zurückgeht.

---

### S10-24 · **Low** · E-Mail-Adresse (PII) im stdout-Log

**Datei:** `packages/email/src/EmailService.ts:143-148`
**Bezug:** ADR-017, _„Logs landen bei Grafana Cloud — keine sensiblen Daten
dürfen geloggt werden (PII, secret tokens, Audit-Content)"_
_Überschneidung mit S07._

```ts
console.log(
  `[EmailService] disabled, skipping: ${params.templateKey} -> ${params.to}`,
);
```

Da `EMAIL_ENABLED` in `docker-compose.production.yml:236`/`:314` auf `false`
vorbelegt ist, ist das der **Standardpfad**: jede versuchte Zustellung schreibt
die Empfängeradresse nach stdout, wo sie vom Docker-Log-Treiber eingesammelt
und laut ADR-017 Phase 2 nach Grafana Cloud verschifft würde.

---

### S10-25 · **Low** · ADR-021 ist in 5 von 1.357 Routen umgesetzt; der Worker kennt das Format gar nicht

**Dateien:** `docs/ADR-021-error-handling.md:24-60`,
`apps/web/src/lib/api-errors.ts`, `apps/worker/src/index.ts`

Der `problem`-Helper wird in **5** von **1.357** `route.ts` verwendet — exakt
denselben fünf, die auch Rate-Limiting haben (die `problem.rateLimited()`-Aufrufe
sind der Grund). Die in ADR-021 Z. 11-18 aufgezählten uneinheitlichen Formen
(`{error: "…"}`, `{message: "…"}`, `{error, details}`) sind unverändert der
Normalfall — etwa in `apps/web/src/app/api/v1/audit-mgmt/continuous-rules/route.ts:44-47`
und `:54-60`. Der Worker liefert durchgängig `{success, error}` mit
`application/json` statt `application/problem+json` und ohne `requestId`.
Alle drei geprüften ADRs (017, 019, 021) stehen weiterhin auf Status
**Proposed** — die Doku behauptet die Umsetzung also nicht; der Befund ist
Doku-/Umsetzungs-Drift, kein Widerspruch.

---

### S10-26 · **Info** · Webhook-Signaturschlüssel wird in einer Spalte namens `secret_hash` im Klartext gehalten

**Dateien:** `packages/db/src/schema/event-bus.ts:82`,
`packages/events/src/webhook-signer.ts:32-36`,
`apps/worker/src/webhooks/webhook-delivery.ts:64`
_Gehört inhaltlich zu S08 — hier notiert, weil im Worker-Pfad gefunden._

```ts
// packages/events/src/webhook-signer.ts:32-36
export function signPayload(payload: string, secretHash: string): string {
  const hmac = createHmac("sha256", secretHash);
```

Der Wert wird direkt als HMAC-Schlüssel verwendet; der Empfänger muss
denselben Wert kennen, um zu verifizieren. Der Spaltenname `secret_hash`
suggeriert das Gegenteil und lädt bei einem Review dazu ein, die Spalte für
unkritisch zu halten.

---

### S10-27 · **Info** · Doku-Drift rund um den Worker

- `docs/STATUS.md:321`: „Worker hat 124 Cron-Job-Files" — tatsächlich 128
  (AUDIT_PLAN nennt 132 Dateien inkl. `lib/`, `webhooks/`, Tests/Configs).
- `docs/STATUS.md:350`: „`apps/worker` — 119 [Dateien] … gute Coverage".
- `docs/STATUS.md:92`: „kein Worker-Cron für Due-Date-Eskalation ausstehender
  Signaturen" — `apps/worker/src/crons/signature-due-reminder.ts` (227 LOC)
  existiert und ist unter `/crons/signature-due-reminder` registriert.
- `apps/worker/src/crons/academy-overdue-check.ts:2`: „marks overdue enrollments
  **and sends reminders**" — der Job schickt nichts.
- `apps/worker/src/crons/connector-schedule-runner.ts:14`:
  `export const connectorScheduleRunnerCron = "*/15 * * * *"` — eine Konstante,
  die kein Aufrufer liest (vgl. S10-02); dasselbe Muster in weiteren Dateien
  suggeriert einen Zeitplan, den es nicht gibt.
- `docs/ADR-019-rate-limiting.md:9-11, 31`: bezeichnet ein Caddy-Rate-Limit als
  „bestehend", das in `deploy/Caddyfile` nicht existiert (siehe S10-05d).

---

## 5. Priorisierte Empfehlungen

1. **S10-01 sofort**: `executeCustomSqlRule` deaktivieren; danach eigene
   `NOSUPERUSER`-Rolle + `SET ROLE` + `row_security = on` in einer echten
   Transaktion, Allowlist statt Denylist, Org-Filter serverseitig erzwingen.
2. **S10-03 / S10-04** zusammen beheben: die 36 fehlenden Templates ergänzen
   oder die `templateKey`s auf existierende mappen; `send()` auf
   `result.error` prüfen und werfen; `emailSentAt` nur bei nachgewiesenem
   Versand setzen; `null`-Rückgabe bei `EMAIL_ENABLED=false` als „nicht
   versendet" behandeln.
3. **S10-02**: Scheduler versioniert in `docker-compose.production.yml`
   aufnehmen (z. B. ein `ofelia`- oder `supercronic`-Sidecar mit
   `X-Cron-Secret`), Zeitpläne aus den `*Cron`-Konstanten der Job-Dateien
   ableiten und im Runbook dokumentieren.
4. **S10-05**: `getClientIp` auf den _letzten_ XFF-Eintrag bzw. auf
   `{remote_host}` per `header_up` in Caddy umstellen; Rate-Limit auf
   `/api/auth/**` als Middleware, nicht pro Route; Account-Lockout ergänzen.
5. **S10-06 / S10-15**: Alle Jobs, die Nachweisdaten fabrizieren, entweder
   implementieren oder den Schreibvorgang entfernen — ein fehlendes
   Testergebnis ist prüfbar, ein erfundenes nicht.
6. **S10-07**: `isNull(userOrganizationRole.deletedAt)` in den acht
   Empfänger-Abfragen ergänzen; besser eine gemeinsame
   `resolveOrgRecipients(orgId, roles)`-Funktion, damit der Filter nicht 9×
   einzeln richtig sein muss.
7. **S10-09 / S10-13**: Das Muster aus `risk-acceptance-expiry.ts` (Transaktion
   pro Org + `SET LOCAL` + guarded UPDATE mit `RETURNING`) als
   `withOrgJob()`-Helper extrahieren und in den 125 übrigen Jobs anwenden;
   Job-Claims auf `UPDATE … WHERE status='pending' RETURNING` umstellen und
   einen Lease-Timeout für hängengebliebene `running`-Zeilen ergänzen.
8. **S10-11 / S10-12**: Jeden leeren `catch` mindestens auf `emit("error", …)`
   heben; `success` aus der Fehlerzahl ableiten und den HTTP-Status
   entsprechend setzen; ADR-017 Phase 1 umsetzen.
