# WP9 — Worker, Cron, Rate Limiting, E-Mail · Umsetzungsprotokoll

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Welle 3** (parallel zu WP6/WP7/WP8)
**Branch:** `audit/full-2026-08-31` · **Umfang:** 28 Findings — `S10-01…S10-27`
(ohne `S10-16`, `S10-19`), `S14-02`, `S14-03`, `S14-04`
**Migrationsnummern:** 0435–0437 (reserviert war 0435–0439; 0438/0439 unbenutzt)

---

## 1. Kurzfassung

Der Worker war vor diesem Paket ein Prozess, der startete, `listening on
:3001` loggte und dann nichts tat. Es gab keinen Scheduler; die 128
Cron-Jobs waren ausschließlich HTTP-Endpunkte, und der Header
`X-Cron-Secret`, den sie verlangen, kam im gesamten Repository außer in der
Middleware, die ihn prüft, nicht vor. Kein Deploy-Skript legte einen Aufrufer
an. Das heißt konkret: keine DSGVO-Art.-33-Frist wurde überwacht, keine
HinSchG-Eingangsbestätigung angemahnt, nichts fristgebunden gelöscht, der
Audit-Trail nie verankert.

Darüber lag ein zweites Problem, das schwerer wiegt als der Ausfall: **vierzehn
Codepfade schrieben Prüfergebnisse, die nie gemessen wurden.** Bestandene
Connector-Control-Tests mit `Math.random()`-Laufzeit, „healthy"-Healthchecks
ohne einen einzigen Netzwerkkontakt, Monte-Carlo-VaR-Werte in Euro aus dem
Zufallsgenerator, `passRate: "100.00"` und `complianceRate: "95.00"` als
Konstanten im Quelltext — alles audit-trail-gestützt, zeitgestempelt und von
einem echten Nachweis nicht unterscheidbar. In einem Produkt, dessen Zweck der
Nachweis ist, ist das der Defekt erster Ordnung. Die Regel, nach der dieses
Paket sie alle behandelt: **kein Ergebnis ist besser als ein erfundenes.**
Jeder dieser Pfade meldet jetzt einen Fehler, persistiert nichts, und der
Zustand ist als „nicht geprüft" erkennbar — ein fehlender Nachweis fällt einem
Prüfer auf, ein erfundener nicht.

Umgesetzt wurde außerdem: ein echter In-Process-Scheduler mit 131 registrierten
Jobs, Advisory Locks und Transaktionen als Infrastruktur statt als 128
Einzelpatches, ein zentrales und fälschungssicheres Rate Limiting, ein
E-Mail-Pfad, der Zustellfehler als Fehler meldet, und die Umstellung des
Workers von der Superuser-Rolle `grc` auf `grc_worker`.

**Zahlen vorher → nachher**

| Metrik                              | Vorher                       | Nachher                                                  |
| ----------------------------------- | ---------------------------- | -------------------------------------------------------- |
| Scheduler                           | 0                            | 1 (131 Jobs, gestaffelt, UTC)                            |
| Jobs überhaupt per HTTP erreichbar  | 96 + 31 + 12 (uneinheitlich) | 131 + 12 Modul-Prozesse, eine Quelle                     |
| Advisory Locks / `SKIP LOCKED`      | 0 / 0                        | jeder Job unter `pg_try_advisory_lock`                   |
| Jobs mit Transaktion                | 3                            | Infrastruktur (`withOrgContext`) + 8 Jobs umgestellt     |
| Leere / Zähler-only `catch`         | 39 / 28                      | **0 / 0** (63 Stellen auf `reportJobError`, nachgezählt) |
| Notification-Crons ohne Dedup       | 40 von 44                    | 0 (51 Insert-Stellen über `insertNotification`)          |
| E-Mail-`templateKey`s ohne Renderer | 36 von 38                    | 0 von 75 (Test erzwingt es)                              |
| Rate-limitierte Routen              | 5 von 1.357                  | alle `/api/**` über die Middleware                       |
| Codepfade, die Nachweise erfinden   | 14                           | 0 (Test erzwingt es)                                     |
| DB-Rolle des Workers                | `grc` (SUPERUSER)            | `grc_worker` (BYPASSRLS, NOSUPERUSER)                    |

---

## 2. Umsetzung je Finding

### S14-02 (High) — Fünf Pfade erfinden Prüfergebnisse · **behoben**

**Änderung.**

- `apps/web/src/app/api/v1/cloud-connectors/executions/route.ts`: der Block, der
  eine vollständige, bestandene Ausführung schrieb (`status: "completed"`,
  `passCount = suite.totalTests`, `failCount: 0`, `passRate: "100.00"`,
  `durationMs: Math.random()…`) und anschließend `cloudTestSuite.lastPassRate =
"100.00"` setzte, ist entfernt. Der Endpunkt antwortet 501 und schreibt nichts.
- `apps/web/src/app/api/v1/connectors/[id]/test-run/route.ts`: dito für die
  Schleife, die pro Testdefinition ein `connector_test_result` mit
  `status: "pass"` und `result: { simulated: true }` anlegte. Der
  Simulations-Marker steckte in einem JSONB-Detailfeld, das die UI nicht
  rendert — er existierte nur für den, der die Datei öffnete.
- `apps/web/src/app/api/v1/identity-connectors/sync/route.ts`: dito für
  `status: "pass"`, `totalUsers: 100`, `compliantUsers: 95`,
  `complianceRate: "95.00"`. `syncStatus` bleibt unangetastet, damit die
  Konfiguration auch keinen Sync behauptet, der nicht stattfand.
- `apps/web/src/app/api/v1/connectors/[id]/health/route.ts`: `healthStatus`
  wurde aus `connector.status === "active"` abgeleitet — also aus einer Spalte
  in unserer eigenen Datenbank, mit `responseTimeMs` zwischen zwei
  benachbarten `Date.now()`-Aufrufen (immer 0). Entfernt, 501.
- `apps/worker/src/crons/connector-health-monitor.ts`: `const isHealthy = true`
  entfernt; der Job wirft jetzt `NotImplementedEvidenceError`, sobald es
  überhaupt aktive Connectoren gäbe, und schreibt nichts.

**Nachweis.** `apps/worker/tests/no-fabricated-evidence.test.ts` (16 Tests):
prüft je Datei, dass die konkreten Muster (`passRate: "100.00"`,
`status: "pass"`, `Math.random()`, `complianceRate: "95.00"`,
`connector.status === "active" ? "healthy"`) im ausführbaren Code nicht mehr
vorkommen, und dass alle vier Web-Pfade `status: 501` liefern.
`apps/worker/tests/crons/connector-health-monitor.test.ts`: der Job wirft und
ruft weder `insert` noch `update`.

**Status: geschlossen.**

---

### S10-06 (High) — `connector-schedule-runner`: gefälschte Nachweise + Endlosschleife · **behoben**

**Änderung.** `apps/worker/src/crons/connector-schedule-runner.ts` neu
geschrieben. Beide Defekte:

1. Der `connectorTestResult`-Insert ist weg. Der Job zählt, wie viele
   Testdefinitionen _anwendbar gewesen wären_ (`testsSkipped`), meldet den Lauf
   als Fehler und persistiert kein Ergebnis.
2. `next_run_at` wird jetzt geschrieben — aus dem `cron_expression` des
   Zeitplans selbst, über `nextRunAfter()` in `lib/scheduler.ts`. Repo-weit
   schrieb diese Spalte vorher **niemand**; ein einmal fälliger Zeitplan blieb
   dauerhaft fällig, was die 1.152 gefälschten „pass" pro Zeitplan und Tag
   überhaupt erst erzeugte. Der Status ist `failure` mit hochgezähltem
   `consecutive_failures` statt des konstanten `"success"` (`failCount` wurde
   in der alten Fassung deklariert und nie erhöht). Das Update läuft in einer
   Transaktion mit Org-Kontext.
3. Der bare `catch {}`, der die Ursache verschluckte, ist ein
   `report.fail(...)` mit strukturiertem Log.

**Nachweis.** `apps/worker/tests/crons/connector-schedule-runner.test.ts` —
ersetzt die vorherige Ein-Zeilen-Tautologie (`resolves.toBeUndefined()`, eine
der 103 aus S11-09) durch drei echte Prüfungen: kein `insert` bei fälligem
Zeitplan, `ok === false`, und ein `UPDATE`, das `nextRunAt` als `Date` setzt.

**Status: geschlossen.**

---

### S10-15 (Medium) — Neun weitere Jobs schreiben erfundene oder leere Ergebnisse · **behoben**

| Pfad                                    | Vorher                                                                                                 | Jetzt                                                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `marketplace-security-scanner.ts`       | `// For now: auto-pass`, `const passed = true` → jedes Plugin `scanStatus:"passed"`, `criticalCount:0` | Guarded Claim (S10-09), dann `failed` mit Begründung. Ein Security-Gate irrt in Richtung „blockiert", nicht „freigegeben".                                                                                                           |
| `connector-health-monitor.ts`           | siehe S14-02                                                                                           | wirft, schreibt nichts                                                                                                                                                                                                               |
| `simulation-runner.ts`                  | `meanValue/medianValue/p5/p95 = Math.random() * …`, `unit: "EUR"`, Lauf → `completed`                  | Atomarer Claim `running → failed` mit Begründung; kein `simulation_run_result` mehr                                                                                                                                                  |
| `continuous-audit-runner.ts`            | Builtin-Regeln `return []` = „pass"                                                                    | **WP5** — geprüft, siehe S10-01                                                                                                                                                                                                      |
| `import-job-processor.ts`               | zählte Pack-Items als „processed", Status `completed`                                                  | Claim + Lease; Job wird `failed` mit erklärendem `errorLog`, `processedItems: 0`                                                                                                                                                     |
| `scheduled-export.ts`                   | nur `SELECT COUNT(*)`, `exported++`                                                                    | **WP5** — geprüft, `sql.identifier` + Allowlist vorhanden                                                                                                                                                                            |
| `automation-engine-init.ts` `sendEmail` | `console.log`                                                                                          | schreibt eine echte Notification auf Kanal `email` mit dem Template-Key der Regel; `scheduled-notifications` stellt zu                                                                                                               |
| `executive-kpi-snapshot.ts`             | `auditSlaCompliance: 0` / `dsrSlaCompliance: 0` / `esgCompleteness: 0` „Placeholder"                   | Schlüssel entfallen; `notMeasured: [...]` benennt sie. Eine gespeicherte 0 liest ein Vorstandsdashboard als „null Prozent Compliance" — also als Katastrophe, wo „nicht berechnet" die Wahrheit war.                                 |
| `lib/module-aware-cron.ts`              | 12 × `// TODO; return { processed: 0 }`, Antwort `{"success":true,"processed":0}`                      | 4 delegieren an ihre echte Implementierung (`risk-review-reminders`, `vendor-reassessment-reminders`, `esg-data-collection`, `case-escalation-check`), 8 werfen `NotImplementedEvidenceError` → HTTP 500 + `job_run.status='failed'` |

Zusätzlich in derselben Klasse gefunden und mitbehoben (nicht in der
Findingliste, gleicher Defekt):

- `evidence-review-processor.ts`: `pending → running → completed` mit nichts
  dazwischen — jede Evidenzprüfung galt als erledigt, ohne dass ein einziges
  Evidenzobjekt angesehen wurde. Jetzt Claim + Lease + `failed` mit Begründung.
- `predictive-risk-trainer.ts`: `active → training → active` mit
  `lastTrainedAt = now` — jedes Modell meldete ein Training, das nie
  stattfand, und entwertete damit genau die Drift-/Retrain-Politik, die es
  überwachen soll. Jetzt Claim, Status `degraded`, `lastTrainedAt` bleibt
  unverändert: der ehrliche Zustand ist „überfällig", nicht „frisch trainiert".

**Nachweis.** `no-fabricated-evidence.test.ts` (Mustercheck je Datei + die acht
Modul-Prozesse, die werfen müssen). `connector-schedule-runner.test.ts`,
`connector-health-monitor.test.ts`.

**Status: geschlossen.**

---

### S10-02 / S13-14 (High) — Kein Scheduler · **behoben**

**Änderung.**

- **Neu: `apps/worker/src/lib/scheduler.ts`.** Fünf-Feld-Cron-Parser (`*`, `a`,
  `a-b`, `a,b`, `*/n`, `a-b/n`, 0 und 7 = Sonntag, Vixie-Semantik bei
  gleichzeitig eingeschränktem Tag-des-Monats und Tag-der-Woche), Tick einmal
  je Wall-Clock-Minute, alles UTC — bewusst ohne Zeitzone, damit eine
  Sommerzeitumstellung keine gesetzliche Frist verschiebt. Eine unparsbare
  Expression lässt den Boot scheitern, statt den Job stillschweigend fallen zu
  lassen.
- **Neu: `apps/worker/src/lib/job-registry.ts`.** Eine Liste mit Name, Zeitplan
  und Handler für **131** Jobs (128 Cron-Dateien ohne `automation-engine-init`,
  plus `job-run-retention`, plus die beiden von WP8 nachgemeldeten
  Retention-Jobs). Drei Verbraucher lesen sie: der Scheduler, die
  HTTP-Registrierung und die Tests.
- **`index.ts` von 1.589 auf ~380 Zeilen.** Die 96 kopierten Endpunktblöcke
  sind durch einen generierten Dispatcher ersetzt; 20 historische Pfadnamen
  (sechs pluralisierte, vierzehn aus dem früheren „Batch"-Block) bleiben als
  Aliase erreichbar, damit ein bestehendes `curl` oder eine Runbook-Zeile nicht
  stillschweigend 404 wird.
- **Warum in-process und nicht `ofelia`/`supercronic`-Sidecar:** die Jobs leben
  ohnehin in diesem Prozess, ein HTTP-Hop wäre ein zweiter Fehlermodus und ein
  zweiter Ort für das Secret — und, entscheidend, Szenario B von S10-09 war
  genau „der externe Aufrufer bekommt ein Gateway-Timeout und wiederholt". Ein
  Scheduler, der den Handler direkt unter Advisory Lock aufruft, hat kein
  Timeout, nach dem er wiederholen könnte. Die HTTP-Endpunkte bleiben; beide
  Wege nehmen denselben Lock und schließen einander aus.
- `CRON_SCHEDULER_ENABLED` (Default `true`) in Compose und `.env.example`.

**Zeitpläne.** Gestaffelt: Nachtfenster 00–06 für Wartung und Snapshots,
Geschäftsmorgen 06–09 für Erinnerungen und Eskalationen, Abend 20–23 für
Recomputes, Minutentakt nur für die Queue-Prozessoren. 131 Jobs um 00:00 wären
ein selbstverschuldeter Thundering Herd gegen eine Postgres-Instanz; ein Test
verhindert die Rückkehr dorthin. Fünf Job-Dateien exportieren eine eigene
`…Cron`-Konstante — die Registry liest jetzt **diese** Konstante, statt daneben
ein Literal zu führen (S10-27).

**Nachweis.** `apps/worker/tests/lib/job-registry.test.ts` (15 Tests): jede
Cron-Datei genau einmal registriert, kein Eintrag ohne Datei, jeder Zeitplan
parsebar, jeder Handler aufrufbar, die von S10-02 namentlich genannten
Fristenmonitore vorhanden, jeder Alias auflösbar, keine Minutenballung.
Live-Beleg: eine Sonde mit `* * * * *` feuerte innerhalb von 75 s genau einmal
und hinterließ `job_run(job_name='wp9-scheduler-probe', trigger_source='scheduler',
status='success')`.

**Status: geschlossen.**

---

### S10-03 (High) — 36 von 38 `templateKey`s existieren nicht · **behoben**

**Befund neu vermessen.** Über das ganze Repository (Worker + Web + Packages)
sind es nicht 38, sondern **75** distinkte Keys — 70 in der Form
`templateKey: "literal"` und fünf weitere, die in einem Ternär stecken
(`templateKey: isOverdue ? "document_signature_overdue" :
"document_signature_due_reminder"`). Die fünf hätte eine Suche nach der
Literalform nicht gefunden; sie sind genau so auch am ersten Durchgang dieses
Fixes vorbeigerutscht und erst durch einen bestehenden Test aufgefallen.

**Änderung.**

- **Neu: `packages/email/src/template-registry.ts`.** Einzige Quelle der
  Wahrheit: 27 Keys mit eigener React-Vorlage (unverändert erhalten) + 48
  generische Keys mit je eigener Betreffzeile in DE und EN und einer
  Schweregrad-Einstufung (`critical` für gesetzliche Meldefristen — DSGVO
  Art. 33, HinSchG §17, NIS2, DORA, AI Act —, `warning` für überfällige interne
  Pflichten, `action`, `info`).
- **Neu: `packages/email/src/templates/GenericNotification.tsx`.** Kein
  Platzhalter: rendert Titel, Nachricht, optionale Fakten und einen
  funktionierenden Deep Link mit farblichem Schweregrad-Akzent. Was die
  Notification nicht enthält, erfindet die Vorlage nicht.
- `EmailTemplateKey` wird aus der Registry **abgeleitet**; `renderTemplate` ist
  über denselben Typ erschöpfend. Die Union und die tatsächlich geschriebenen
  Keys können nicht mehr auseinanderlaufen.
- `isEmailTemplateKey()` prüft im Schreibpfad (`lib/notify.ts`): ein
  unbekannter Key wird dort gemeldet, wo der Fehler ist, statt nach drei
  Zustellversuchen zu verstummen. Die Notification bleibt als In-App-Eintrag
  erhalten, der Mail-Kanal fällt weg.
- `scheduled-notifications.ts`: der `as EmailTemplateKey`-Cast, der die
  Typprüfung aufhob, ist durch die Guard-Prüfung ersetzt.

**Nachweis.** `packages/email/tests/template-coverage.test.ts`: scannt
`apps/worker/src`, `apps/web/src/app/api` und `packages` nach jedem Key —
inklusive Ternären, mit Ausschluss der Drizzle-Spaltendefinitionen und der
Bedingung eines Ternärs — und schlägt fehl, sobald einer davon nicht
registriert ist. Zusätzlich: jeder registrierte Key rendert ohne Wurf, jeder
generische Key hat beide Sprachen, die sechs Fristen-Keys sind `critical`.

**Status: geschlossen.**

---

### S10-04 (High) — Zustellfehler als Erfolg, `emailSentAt` ohne Versand · **behoben**

**Teil A — der tote Retry-Block.** `EmailService.send()` prüft jetzt den
Rückgabewert des Resend-SDK auf `error` und auf eine fehlende `messageId` und
wirft `EmailDeliveryError`. Damit laufen die drei Retries erstmals wirklich; ein
422 („domain not verified"), 429, 401 oder DNS-Ausfall ist ein Fehler und nicht
mehr `{ messageId: "" }`.

**Teil B — der Aufrufer.**

- `scheduled-notifications.ts`: `emailSentAt` wird **nur** noch gesetzt, wenn
  eine `messageId` zurückkam. `result === null` (Zustellung abgeschaltet — der
  Compose-Default `EMAIL_ENABLED:-false`, also der Regelfall) zählt als
  `skipped`, schreibt `emailError` und lässt `retryCount` bewusst unverändert:
  die Nachricht ist nicht kaputt, der Mailer ist aus, sie muss nach dem
  Einschalten noch sendbar sein. Vorher stempelte diese Zeile 412
  Benachrichtigungen als zugestellt und schloss sie über `isNull(emailSentAt)`
  dauerhaft aus.
- `notification-digest.ts`: dieselbe Korrektur; ohne akzeptierte `messageId`
  wird keine der enthaltenen Notifications markiert.

**Nachweis.** `packages/email/tests/template-coverage.test.ts` (5 Tests zur
Zustellbuchführung). **Zwei bestehende Tests in
`packages/email/tests/email-service.test.ts` haben den Defekt festgeschrieben**
(„should return empty string messageId when data.id is null") — sie sind durch
Tests auf das korrekte Werfen ersetzt, mit Begründung im Kommentar.

**Status: geschlossen.**

---

### S10-05 (High) — Rate Limiting · **behoben** (mit benannter Grenze)

**Änderung** in `apps/web/src/lib/rate-limit.ts`, vollständig neu:

**(a) Abdeckung.** Eine Pfad→Policy-Tabelle plus `checkRequestRateLimit()`,
aufgerufen aus `apps/web/src/middleware.ts` — dem einzigen Punkt im
Request-Pfad, der jede Route sieht. Abgedeckt sind jetzt der Auth.js-Callback
(`/api/auth/callback/**`, der zuvor **überhaupt kein** Limit hatte),
Passwort-Reset, SSO, SCIM, Whistleblowing-Intake, Portal, Export, Import,
Upload, Audit-Integrity, Copilot und AI — die Pfade, die WP3, WP6 und WP8
angemeldet haben — sowie ein Default für alles übrige unter `/api/`.

**(b) `X-Forwarded-For`.** `getClientIp()` zählt jetzt die vertrauenswürdigen
Proxy-Hops von **rechts** (`TRUSTED_PROXY_HOPS`, Default 1 — dieselbe Variable,
die WP7 für S06-03 eingeführt hat). Caddy _hängt_ an, statt zu ersetzen; der
letzte Eintrag ist die Adresse, die der Proxy gesehen hat, und die kann der
Client nicht fälschen. Vorher nahm der Code `split(",")[0]`, also genau den vom
Client gelieferten Wert. `TRUSTED_PROXY_HOPS=0` ignoriert den Header
vollständig.

**(c) Fail-closed für Auth.** Anonyme Pfade (Auth, Portal, Intake) werden bei
einem Fehler im Limiter **abgewiesen**. „Der Limiter ist kaputt" darf nicht
„Brute Force ist unbegrenzt" bedeuten. Alles übrige bleibt fail-open, wie
ADR-019 es begründet.

**(d) ADR-019-Variablen.** `RATE_LIMIT_DEFAULT`, `_AUTH`, `_COPILOT`, `_AI`,
`_IMPORT`, `_EXPORT`, `_UPLOAD`, `_PORTAL`, `_INTAKE` im Format
`"<Anzahl>/<Sekunden>"` werden erstmals gelesen. In Compose und `.env.example`.

**(e) Speicher (S10-23).** Der Bucket-Store ist auf `RATE_LIMIT_MAX_BUCKETS`
(Default 50.000) gedeckelt und räumt zuerst volle, dann die ältesten Buckets ab.

**Bewusste Grenze, ehrlich benannt:** der Store bleibt prozesslokal. Bei mehr
als einem Web-Container ist das effektive Limit `N × capacity`. Ein
Redis-Backend ist der nächste Schritt (`REDIS_URL` liegt in Compose bereits
vor); die API hier ändert sich dadurch nicht. **An WP10 übergeben.**

**Dateihoheits-Hinweis.** `apps/web/src/middleware.ts` gehört WP3. Der
eingefügte Block ist auf die Verdrahtung begrenzt und als solcher kommentiert.
Ein nicht verdrahteter Limiter wäre genau der Placebo-Fix, den Abschnitt 1.2
des Remediationsplans verbietet — deshalb die Grenzüberschreitung statt einer
Übergabenotiz an ein bereits abgeschlossenes Paket.

**Nachweis.** `apps/web/src/__tests__/lib/rate-limit.test.ts`, 19 Tests. **Vier
bestehende Tests haben die Schwachstelle festgeschrieben** („returns first
entry from X-Forwarded-For") — ersetzt durch: ein gefälschtes XFF-Präfix wird
ignoriert; 50 verschiedene gefälschte Präfixe landen in **einem** Bucket;
`TRUSTED_PROXY_HOPS=2` und `=0` verhalten sich wie dokumentiert; ein
Auth-Bucket bleibt adressgebunden, auch wenn 20 verschiedene Subjekte
behauptet werden; der Bucket-Store bleibt unter seiner Obergrenze.

**Status: geschlossen** (Redis-Backend als Betriebsaufgabe offen).

---

### S10-07 (High) — Eskalationen an entzogene Mitgliedschaften · **behoben**

**Änderung.** Neu: `apps/worker/src/lib/recipients.ts` mit
`resolveOrgRecipients(orgId, roles, opts)` — filtert
`user_organization_role.deleted_at IS NULL`, `user.is_active = true`,
`user.deleted_at IS NULL` und dedupliziert. Der Entzug einer Org-Rolle ist ein
Soft-Delete, und `user.is_active` bleibt wahr, solange die Person in
_irgendeiner_ Org Mitglied ist — der Regelfall im Konzern mit `parent_org_id`.

Die acht fehlerhaften Fundstellen sind korrigiert:
`wb-deadline-monitor.ts` (2×, die vom Audit gegen die Live-Datenbank
reproduzierte Query — sie versendet Fallnummern und HinSchG-Fristverstöße,
§8 verlangt strikte Vertraulichkeit gegenüber allen, die nicht mit der
Bearbeitung betraut sind), `wb-retaliation-check.ts`,
`playbook-phase-escalation.ts`, `playbook-suggestion.ts`,
`risk-appetite-check.ts`, `automation-engine-init.ts`
(`resolveOrgUserForRole` delegiert jetzt an den Resolver),
`calendar-digest.ts`. `fair-appetite-check.ts` importiert
`userOrganizationRole`, benutzt es aber nirgends — dort war nichts zu
korrigieren. `kri-overdue-alert.ts` war schon richtig und diente als Vorlage.

**Status: geschlossen.**

---

### S10-08 / S03-10 (High) — `daily-audit-anchor` · **Scheduler-Anteil geliefert**

WP4 hat Retry-Fenster, Alarm und die Datumskorrektur gebaut; offen war der
Scheduler. Geliefert:

- `daily-audit-anchor` → `5 0 * * *`, `audit-chain-verify` → `0 2 * * *`, exakt
  wie WP4 in Abschnitt 4 angefordert. Ein Test friert beide Zeiten ein, damit
  sie nicht versehentlich verschoben werden.
- `POST /crons/audit-chain-verify` registriert; antwortet **503**, wenn
  `healthy === false`, damit ein Monitor „Kette gebrochen" als Ausfall sieht und
  nicht als 200 mit einem Feld, das niemand liest.
- `AUDIT_SEAL_KEY`, `AUDIT_SEAL_KEY_ID`, `FREETSA_CA_PEM`,
  `AUDIT_ANCHOR_RETRY_DAYS` in `docker-compose.production.yml` (Worker **und**
  Web) und `.env.example`. `AUDIT_SEAL_KEY` ist als
  `${AUDIT_SEAL_KEY:?…}` gesetzt: ein Deploy ohne den Schlüssel startet nicht,
  statt unsignierte Siegel zu erzeugen.
- Migration **0437** vergibt `grc_worker` die Rechte auf `audit_anchor`,
  `audit_chain_verification` und `audit_anchor_seal` — ohne sie hätte die
  Rollenumstellung (S01-09) die Verankerung mit `42501` lahmgelegt, dasselbe
  Loch wie S10-08, nur mit anderer Ursache.

Die Datei `daily-audit-anchor.ts` selbst wurde nicht angefasst (WP4).

**Status: WP9-Anteil geschlossen.**

---

### S10-09 (Medium) — Kein Lock, ungeschütztes read-then-claim, kein Lease · **behoben**

**Infrastruktur** in `apps/worker/src/lib/job-runtime.ts`:

- `withJobLock(name, fn)` — `pg_try_advisory_lock` auf **einer reservierten**
  Verbindung (Session-Lock, kein Transaktions-Lock: diese Jobs committen
  mehrfach). Wird der Lock gehalten, läuft `fn` nicht und der Lauf ist
  `skipped_locked` → HTTP 409. **Jeder** Job läuft darunter, weil `runJob()`
  ihn nimmt — Scheduler und HTTP-Aufruf gleichermaßen.
- `claimRow({table, id, expectedStatus, nextStatus, touchColumns})` — guarded
  `UPDATE … WHERE status = <erwartet> RETURNING`.
- `reclaimStaleRows({…, staleAfterMinutes})` — Lease-Ablauf für Zeilen, die ein
  abgestürzter Worker auf `running` festgenagelt hat (Szenario C: der Nutzer
  sah einen Import, der nie fertig wurde, und konnte ihn nicht neu starten).

**Angewandt** auf alle acht Queue-Prozessoren: `import-job-processor`
(+ Lease), `evidence-review-processor` (+ Lease), `agent-scheduler`,
`var-calculation-runner`, `marketplace-security-scanner`,
`predictive-risk-trainer`, `simulation-runner` (dort ist der Claim die
terminale Transition selbst — das Enum hat keinen Zwischenzustand und ein Lauf
entsteht direkt als `running`), `connector-schedule-runner`. Migration 0435
legt die `(status, started_at)`-Indizes für den Reclaim-Scan an.

**Nachweis.** `apps/worker/tests/lib/job-runtime.db.test.ts` gegen echtes
PostgreSQL: zwei parallel gestartete Läufe desselben Jobs führen den Rumpf
**genau einmal** aus, und genau einer meldet `skipped`; der Lock wird
freigegeben, ein späterer Lauf bekommt ihn.
`apps/worker/tests/crons/overdue-tasks.test.ts`: verliert ein Lauf den Claim,
wird **nicht** benachrichtigt.

**Status: geschlossen.**

---

### S10-10 (Medium) — 69 von 128 Jobs nicht idempotent, 40 von 44 ohne Dedup · **behoben**

**Änderung.** Der Guard gehört in die Datenbank, nicht in 44 Dateien:

- Migration **0435**: `notification.dedupe_key` + UNIQUE-Index
  `(org_id, dedupe_key)`. Bewusst **nicht** partiell — PostgreSQL leitet einen
  partiellen Index nur dann als ON-CONFLICT-Arbiter ab, wenn das INSERT sein
  Prädikat wörtlich wiederholt; die Dedup-Zusage hinge dann an einer
  Formulierung im ORM. `NULL` kollidiert nie mit `NULL`, das genügt.
- Neu: `apps/worker/src/lib/notify.ts` mit `insertNotification()` — leitet den
  Schlüssel aus `(type, entityType, entityId, userId, Titel-Hash, Zeitfenster)`
  ab und schreibt mit `ON CONFLICT DO NOTHING`.
- **51 Insert-Stellen in 40 Cron-Dateien** mechanisch auf diesen Pfad
  umgestellt (Skript + Syntaxprüfung jeder Datei), plus die vier Stellen, die
  ich von Hand umgebaut habe.

**Zeitfenster nach Typ**, weil „wie oft soll das wiederkommen" für eine
Erinnerung etwas anderes heißt als für eine Eskalation:
`escalation` → ein Tag (eine versäumte gesetzliche Frist soll weiter
auftauchen, bis sie bearbeitet ist); alles andere → eine Woche. Das Beispiel
des Audits — ein Risiko mit Review-Datum in 14 Tagen erzeugte an 15
aufeinanderfolgenden Tagen 15 identische Zeilen, bei 300 Risiken 4.500 — ergibt
damit zwei statt fünfzehn. Jobs mit eigener Kadenz (Wochendigest,
zweistufige Eskalation) übergeben `dedupeWindow` oder `dedupeKey` explizit.

**Nachweis.** `job-runtime.db.test.ts`: fünf Läufe derselben Erinnerung
schreiben genau eine Zeile; mit `dedupeWindow: "none"` schreiben zwei Läufe
zwei Zeilen.

**Status: geschlossen.**

---

### S10-11 (Medium) — 39 leere und 28 Zähler-only `catch` · **behoben**

**Änderung.** `emitCronEvent()` aus `cron-instrument.ts` exportiert, damit
`reportJobError()` in `job-runtime.ts` dieselbe NDJSON-Form für Fehler
schreiben kann, die _innerhalb_ einer Schleife gefangen werden — genau die, die
den Wrapper nie erreichen. Der Kommentar „Wrapper logs structured error", der
wortgleich in Dutzenden Dateien stand, war nachweislich falsch und ist überall
entfernt.

**63 Fundstellen in 48 Dateien** maschinell umgestellt: `catch {` → `catch
(err) {` plus `reportJobError({ job, scope }, err)`; `void err;`-Zeilen, die nur
den Linter beruhigten, entfernt; die vorhandenen Zähler bleiben erhalten. Das
`scope`-Label wird aus dem nächstliegenden vorangehenden Kommentar oder der
Schleifenvariable abgeleitet, damit vier `catch` in derselben Datei
unterscheidbar bleiben.

Die vom Audit als besonders kritisch benannten Dateien
(`wb-deadline-monitor.ts` 4×, `isms-cap-overdue-monitor.ts` 2×,
`process-review-reminder.ts` 2×, `risk-appetite-check.ts` 2×) sind darunter.
Die zwei in `document-retention-purge.ts` waren von meiner Umstellung
ausgenommen (WP8-Datei) — WP8 hat sie parallel selbst behoben.

**Nachweis.** Nachgezählt über `apps/worker/src` mit demselben
Klammer-Matching, das der Audit benutzt hat: **0 leere und 0 Zähler-only
`catch`-Blöcke** verbleiben. Der Live-Boot-Probelauf zeigt die neue Zeile:
`{"level":"error","cron":"connector-schedule-runner","phase":"item-error","scope":"schedule …","message":"…","errorName":"Error"}`.

**Status: geschlossen.**

---

### S10-12 (Medium) — Fehlläufe antworten HTTP 200 `success: true` · **behoben**

**Änderung.**

- `createRunReport()` sammelt Fehler je Element und leitet `ok` daraus ab.
- `runJob()` in `scheduler.ts` klassifiziert das Ergebnis
  (`success` / `partial` / `failed` / `skipped_locked`) und schreibt **je Lauf
  eine Zeile in `job_run`** (Migration 0435) mit Start, Ende, Dauer, Status,
  Fehlerzahl und einem gekürzten Ergebnis. „Lief der Job, und hat er etwas
  getan?" ist damit erstmals beantwortbar — auch für das Monitoring aus
  ADR-017 / S13-11.
- Der HTTP-Status trägt das Urteil: 200 / **207** (partiell) / **409** (Lock) /
  **500**. Ein Lauf, der für alle 48 Orgs versagt, antwortet nicht mehr grün.
- `job-run-retention` räumt das Protokoll nach 90 Tagen (Fehlläufe: 180).

**Status: geschlossen.**

---

### S10-13 (Medium) — Nur 3 von 128 Jobs mit Transaktion · **behoben**

**Infrastruktur.** `withOrgContext(orgId, fn)` und `withTransaction(fn)` in
`job-runtime.ts` — eine Transaktion pro Org bzw. pro Element, mit
transaktionslokalem Org-Kontext. Das ist das Muster aus
`risk-acceptance-expiry.ts`, das als einziges richtig war, als Funktion
extrahiert.

**Angewandt** auf `overdue-tasks` (der Fall aus dem Finding: 5.000 Tasks auf
`overdue` gesetzt, ein Teil ohne Notification, und der nächste Lauf findet sie
nie wieder, weil die Auswahl `status='overdue'` ausschließt — jetzt ein
guarded UPDATE **plus** die Notifications in derselben Transaktion),
`calendar-digest`, `calendar-overdue-check`, `connector-schedule-runner`,
`resilience-score-snapshot` sowie über `insertNotification({tx})` überall dort,
wo ein Job bereits eine Transaktion hat.

**Nachweis.** `job-runtime.db.test.ts`: ein Job, der nach dem ersten Schreiben
scheitert, hinterlässt **null** Zeilen (vorher hätte die erste überlebt).

**Status: geschlossen** für die benannten Pfade; die Infrastruktur steht für
den Rest bereit.

---

### S10-14 (Medium) — Org-Kontext in allen fünf Fundstellen wirkungslos · **behoben**

| Fundstelle                            | Defekt                                                                                                                                                                                                                                                                                | Jetzt                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `calendar-digest.ts:72-74`            | `set_config(…, false)` auf dem geteilten Basispool: Session-Scope, beliebige Pool-Verbindung, und der GUC bleibt auf ihr stehen — `request-context.ts:37-45` beschreibt genau, dass er nie wieder auf NULL, sondern nur auf `''` zurückgeht, und `''::uuid` wirft in den RLS-Policies | `withOrgContext()`, eine Transaktion je (Nutzer, Org) |
| `calendar-overdue-check.ts:35-38`     | dito                                                                                                                                                                                                                                                                                  | `withOrgContext()`, eine Transaktion je Org           |
| `scheduled-export.ts:46-49`           | `SET LOCAL` außerhalb einer Transaktion = No-op                                                                                                                                                                                                                                       | **WP5** — geprüft                                     |
| `document-retention-purge.ts:100-104` | Kontext **nach** dem `INSERT INTO audit_log` derselben Transaktion                                                                                                                                                                                                                    | **WP8** — übergeben                                   |
| `risk-acceptance-expiry.ts:45-48`     | war korrekt                                                                                                                                                                                                                                                                           | Vorlage für `lib/org-context.ts`                      |

`apps/worker/src/lib/org-context.ts` ist der benannte Einstiegspunkt (und die
Datei, die WP6 in `regulatory-relevance-scorer.ts` importiert — sie fehlte, der
Worker war deswegen nicht übersetzbar; jetzt vorhanden).

**Nachweis.** `job-runtime.db.test.ts`: innerhalb von `withOrgContext` liefert
`current_setting('app.current_org_id')` die Org, auf einer frischen Verbindung
danach ist sie leer — kein Pool-Poisoning.

**Status: geschlossen** (bis auf die WP8-Datei).

---

### S10-17 (Medium) — Webhook-Retries verhungern hinter `LIMIT 50` · **behoben**

**Änderung.** `apps/worker/src/webhooks/webhook-delivery.ts`,
`processWebhookRetries()`: Fälligkeit (`next_retry_at <= now`) steht jetzt in
**SQL** statt in JavaScript nach dem `LIMIT`, plus
`ORDER BY next_retry_at ASC`. Vorher lieferte die Abfrage 50 beliebige Zeilen
aus der physischen Heap-Reihenfolge; bei 400 gestauten Retries lag die
Wahrscheinlichkeit, die eine fällige zu erwischen, bei ~12 %, und der Stau
blockierte sich selbst. Der Rückgabewert nennt zusätzlich `due`.

**Status: geschlossen.**

---

### S10-18 (Medium) — Retention-Purge verschluckt Datei-Löschfehler · **an WP8 übergeben**

`apps/worker/src/crons/document-retention-purge.ts` liegt laut Auftrag bei WP8
(„nur registrieren"). Der Job **ist** registriert (`30 1 * * *`, versetzt zu den
beiden neuen WP8-Retention-Jobs). Der inhaltliche Fix — Datei-Löschung vor dem
Commit versuchen oder eine `pending_file_deletion`-Outbox schreiben, bevor die
DB-Zeilen mit dem `file_path` verschwinden, und den Fehler zwingend
protokollieren — steht in Abschnitt 4 an WP8.

**Status: registriert, inhaltlich übergeben.**

---

### S10-20 (Low) — Drei unauthentifizierte Worker-Endpunkte · **behoben**

Die `CRON_SECRET`-Middleware war gut gebaut (`timingSafeEqual`, fail-closed bei
fehlendem Secret, kein Fallback-Default) — sie deckte nur `/crons/*` ab. Jetzt
`/crons/*`, `/events/*` und `/automation/*`; ausgenommen bleibt `/health`, das
ein Container-Healthcheck ohne Secret erreichen muss. `POST /events/auth`
validiert seinen Body (kein Hono-Default-500 mehr bei Nicht-JSON) und loggt
keinen angreiferkontrollierten Inhalt mehr wörtlich.

**Nebenbefund akzeptiert und dokumentiert:** der Längenvergleich vor
`timingSafeEqual` verrät die Länge des Secrets. Bei einem 32-Zeichen-Hexwert
ist das keine relevante Preisgabe; ein Hash beider Seiten würde auch das
beseitigen und ist als bewusste Nicht-Änderung im Code vermerkt.

**Status: geschlossen.**

---

### S10-21 (Low) — Kein Healthcheck, `/health` prüft die DB nicht · **behoben**

`GET /health` führt `SELECT 1` aus und antwortet bei einem Fehler **503**
`status: "degraded"`; im Erfolgsfall liefert es DB-Latenz, Scheduler-Zustand
und Zahl der registrierten Jobs. `docker-compose.production.yml` hat für den
Worker einen `healthcheck` (30 s Intervall, 40 s `start_period`), damit
`restart: unless-stopped` auch auf einen hängenden Prozess reagiert und nicht
nur auf einen Abbruch. **Der Healthcheck für den `web`-Service fehlt weiterhin
— an WP10 übergeben**, weil der Service-Block dort nicht zu meiner Dateihoheit
gehört.

**Status: Worker geschlossen, Web übergeben.**

---

### S10-22 (Low) — Interne Fehlermeldungen im Antwort-Body · **behoben**

Der Body enthält Jobname, Urteil, Dauer und `requestId`. Die Treibermeldung —
Tabellen-, Spalten- und Constraint-Namen, Statement-Fragmente — geht in das
strukturierte Fehlerlog und nach `job_run.error`, nicht an den Aufrufer. Auch
die `errors[]`-Arrays der Jobs führen nur noch `scope` und Fehlerklasse
(`createRunReport`), nicht die Rohmeldung, und sind auf 20 Einträge gedeckelt.

**Status: geschlossen.**

---

### S10-23 (Low) — Unbegrenzt wachsende Rate-Limit-Map · **behoben**

Siehe S10-05 (e). Gedeckelt auf `RATE_LIMIT_MAX_BUCKETS`, Eviction zuerst der
vollen, dann der ältesten Buckets. Ein Test schreibt 500 Buckets bei einer
Obergrenze von 100 und prüft, dass die Größe eingehalten wird.

**Status: geschlossen.**

---

### S10-24 (Low) — E-Mail-Adresse im stdout-Log · **behoben**

`EmailService` schreibt beim deaktivierten Versand — dem Standardpfad, weil
`EMAIL_ENABLED` in Compose auf `false` vorbelegt ist — nur noch
`e***@domain.tld`. Der Diagnosewert (welche Domain, welches Template) bleibt,
die personenbezogene Angabe verlässt den Prozess nicht mehr Richtung Grafana
Cloud (ADR-017).

**Nachweis.** Test: die Empfängeradresse taucht nicht im Log auf, die Domain
schon.

**Status: geschlossen.**

---

### S10-25 (Low) — ADR-021 im Worker nicht umgesetzt · **Worker-Anteil behoben**

Alle Fehlerantworten des Workers (400/404/409/500) sind jetzt RFC-7807
`application/problem+json` mit `type`, `title`, `status`, `detail`, `instance`
und `requestId`. Die 2xx-Antworten behalten `success` plus Jobergebnis, weil
genau das der Operator und das Laufprotokoll lesen. Die Ausbreitung von
`problem()` über die 1.352 übrigen Web-Routen ist **an WP12/WP10 übergeben**.

**Status: Worker geschlossen, Web übergeben.**

---

### S10-26 (Info) — `secret_hash` enthält keinen Hash · **teilweise behoben, Umbenennung übergeben**

Migration **0436** setzt einen `COMMENT ON COLUMN` auf
`webhook_registration.secret_hash`, der in jedem `\d+` und jedem Schema-Dump
sagt, was der Wert wirklich ist: der HMAC-Schlüssel der Webhook-Signatur, im
Klartext, dem Empfänger bekannt — also ein geteiltes Geheimnis, das wie ein
Secret zu behandeln ist. Die eigentliche Behebung ist die **Umbenennung** nach
`signing_secret`; sie berührt `packages/db/src/schema/event-bus.ts`,
`packages/events/src/webhook-signer.ts` und
`apps/web/src/app/api/v1/webhooks/**` — alle außerhalb der Dateihoheit von WP9
und in Welle 3 in Bearbeitung. **An WP10 übergeben** (das Finding ist
ausdrücklich als zu S08 gehörig markiert).

**Status: teilweise — Kennzeichnung in der Datenbank steht, Umbenennung offen.**

---

### S10-27 (Info) — Doku-Drift rund um den Worker · **teilweise behoben**

| Punkt                                                                  | Status                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `academy-overdue-check.ts:2` „and sends reminders"                     | **behoben** — der Job verschickt nichts; der Kopfkommentar sagt das jetzt und verweist auf den offenen Punkt |
| `connectorScheduleRunnerCron` u. a. — Konstanten, die niemand liest    | **behoben** — die Registry liest genau diese fünf Konstanten                                                 |
| `docs/STATUS.md:321` „124 Cron-Job-Files" (tatsächlich 128, jetzt 131) | **an WP10/WP12 übergeben** (`docs/**`)                                                                       |
| `docs/STATUS.md:350`, `:92` (Signatur-Cron existiert doch)             | **an WP10/WP12 übergeben**                                                                                   |
| `docs/ADR-019` behauptet ein Caddy-Limit, das es nicht gibt            | **an WP10 übergeben** — der Code liefert die Ebene jetzt, die ADR muss die Behauptung korrigieren            |

**Status: Code-Anteil geschlossen, Doku-Anteil übergeben.**

---

### S10-01 (Critical) — bestätigt, aus Worker-Sicht nichts offen

WP5 hat `executeCustomSqlRule` in `continuous-audit-runner.ts` abgesichert:
`SET LOCAL ROLE grc_app` als erste Anweisung der Transaktion, danach
`set_config('app.current_org_id', …, true)`, ein `statement_timeout` als
eigenes Statement, die Query in `SELECT * FROM (…) LIMIT 1000` gekapselt und
eine Allowlist statt der Sieben-Wort-Denylist. Fail-closed geprüft.

**Zwei Punkte aus Worker-Sicht, beide von mir geschlossen:**

1. `SET LOCAL ROLE grc_app` funktionierte, _weil_ der Worker Superuser war —
   ein Superuser darf jede Rolle annehmen. Unter `grc_worker` braucht es die
   **Mitgliedschaft**: Migration 0437 vergibt `GRANT grc_app TO grc_worker`.
   Ohne sie wäre jede Custom-SQL-Regel fehlgeschlagen — fail-closed, also nicht
   unsicher, aber ein stiller Funktionsausfall, den die Rollenumstellung
   verursacht hätte.
2. Die Rollenumstellung selbst (siehe S01-09 unten) verkleinert den
   Wirkungsradius eines vergleichbaren Defekts auf diesem Pool erheblich:
   `COPY … TO PROGRAM`, `pg_read_file()` und `ALTER SYSTEM` sind für
   `grc_worker` nicht mehr erreichbar.

**Status: bestätigt geschlossen** (WP5) **+ zwei Folgearbeiten geliefert.**

---

### S10-16, S10-19 — durch WP5 erledigt, bestätigt

- **S10-16** (`changeStatus` in freie Tabelle): `AUTOMATION_STATUS_TABLES` als
  Allowlist in `automation-engine-init.ts` vorhanden, `document` ist bewusst
  **nicht** darin — genau der im Finding beschriebene Löschpfad. Bestätigt.
  Den in derselben Fundstelle erwähnten Nebendefekt (`resolveOrgUserForRole`
  ohne `deleted_at`-Filter) habe ich als Teil von S10-07 behoben.
- **S10-19** (latente Injection in `scheduled-export`): `sql.identifier()` plus
  `ALLOWED_EXPORT_ENTITY_TYPES` im Worker; die Zod-Ebene ist damit nicht mehr
  die einzige Kontrolle. Bestätigt.

---

### S14-03 (Medium) — Evidenz-Frische-Cron benachrichtigt niemanden · **behoben**

`evidence-freshness-check.ts` berechnete die Veralterung korrekt und schrieb das
Ergebnis nach `stdout`. `maxAgeDays = 90` hatte damit keinerlei Wirkung: an
Tag 91 erschien eine Logzeile, kein Control-Owner erfuhr etwas, und die
veraltete Evidenz blieb in der Kontrollprüfung als gültig gelistet.

Jetzt: Benachrichtigung der `control_owner`, `risk_manager` und `admin` der Org
— über den gemeinsamen Resolver (S10-07) und den deduplizierenden Schreibpfad
(S10-10, ein Eintrag je Connector, Empfänger, Stufe und Tag). Neu ist eine
dritte Stufe: ein Connector **ohne jedes** Testergebnis wurde vorher von
`if (!latestResult) continue` stillschweigend übersprungen — „nie geprüft" ist
genau der Zustand, den eine Evidenz-Frischeprüfung sichtbar machen soll, und mit
den Fixes aus S14-02/S10-06 wird es davon mehr geben, nicht weniger. Hat eine
Org niemanden mit passender Rolle, ist das ein gemeldeter Fehler, kein
Stillschweigen.

**Status: geschlossen.**

---

### S14-04 (Low) — Resilience-Score aus überwiegend nicht berechneten Faktoren · **behoben, Befund erweitert**

Das Finding nannte drei dauerhaft auf `0` stehende Faktoren. Gegen die
laufende Datenbank gemessen war es schlimmer: die drei SQL-Statements, die der
Job überhaupt ausführte, referenzieren `bc_process`, `crisis_contact_tree` und
`recovery_procedure` — **keine dieser Tabellen existiert**. Jede Org warf also
bei der ersten Abfrage, der leere `catch` verschluckte es, und der Job lieferte
`{processed: N, snapshots: 0}` als HTTP 200 `success: true`. Es wurde **nie ein
einziger Snapshot geschrieben**, und nichts wies darauf hin.

Neu geschrieben: alle sieben Faktoren aus tatsächlich existierenden Tabellen
(`bcp`, `bcp_procedure`, `bc_exercise`, `crisis_scenario`,
`crisis_team_member`, `vendor`, `vendor_exit_plan`). Ein Faktor ohne Nenner
liefert `null`, nicht `0`, und die Org wird **übersprungen** statt mit einem
niedrigen Wert persistiert: „es gibt noch keinen BCP" und „alle BCPs sind
veraltet" dürfen in einer Resilienz-Zeitreihe nicht gleich aussehen. Fehler
werden gemeldet.

**Status: geschlossen.**

---

### S01-09 (aus WP2) — Worker auf `grc_worker` · **umgesetzt und live geprüft**

**Änderung.**

- `docker-compose.production.yml`: `DATABASE_URL` zeigt auf `grc_worker`
  (`${GRC_WORKER_PASSWORD:?…}`), `ARCTOS_ALLOW_PRIVILEGED_DB=true` bleibt
  gesetzt — die Startup-Assertion aus WP2 verlangt die Zustimmung für **jede**
  privilegierte Rolle, also auch für BYPASSRLS ohne Superuser. Genau so ist sie
  gemeint: die Entscheidung steht sichtbar und einzeln widerrufbar im
  Deployment.
- **Neu: `apps/worker/src/lib/db-role-guard.ts`.** In Produktion beendet sich
  der Worker, wenn er als **SUPERUSER** verbindet — unabhängig von
  `ARCTOS_ALLOW_PRIVILEGED_DB`, denn diese Flagge erlaubt BYPASSRLS, und das
  ist eine andere, viel kleinere Zusage. Fehlt BYPASSRLS ganz, gibt es eine
  Warnung (die Systemjobs sähen dann keine Zeilen — eine funktionale
  Entscheidung des Betreibers, kein Sicherheitsdefekt).
- Migration **0437** vergibt `grc_worker` alles, was bisher implizit aus dem
  Superuser-Status folgte: DML im Schema, `GRANT grc_app TO grc_worker` für das
  `SET LOCAL ROLE` aus S10-01, die Audit-Tabellen von WP4 (deren `relacl` durch
  0407 von NULL auf eine Liste ging, was für jede andere Nicht-Eigentümerrolle
  „kein Zugriff" bedeutet), die zugehörigen Funktionen und Sequenzen. `session`,
  `account` und `verification_token` bleiben auch dem Worker entzogen — sie
  tragen seit 0392 deny-all-RLS, und BYPASSRLS würde die Policy sonst gerade
  aushebeln. Auf `audit_log` nur `SELECT`.

**Braucht jeder Job BYPASSRLS?** Geprüft: nein — die Mehrheit der 131 Jobs
läuft über eine Org-Schleife oder ohne Org-Bezug und käme mit
`withOrgContext()` unter `grc_app` aus. Aber 62 Jobs beginnen mit „für jede
Org" und lesen die Org-Liste selbst; unter `grc_app` sähen sie null Orgs, und
`organization` trägt seit S01-12 FORCE RLS. Eine Umstellung auf `grc_app`
setzt also voraus, dass die Org-Aufzählung über eine `SECURITY DEFINER`-Funktion
läuft. Das ist ein sinnvoller nächster Schritt, aber ein eigener Umbau —
**als Empfehlung an WP10 notiert**, nicht in diesem Paket versteckt.

**Nachweis (live gegen die laufende Datenbank).**
`deploy/provision-grc-app.sh` mit `GRC_WORKER_PASSWORD` ausgeführt →
`grc_worker | rolsuper=f | rolbypassrls=t`. Migration 0437 angewandt. Danach
als `grc_worker`: `notification` und `job_run` les- und schreibbar, `audit_log`
und `audit_anchor` lesbar, `BEGIN; SET LOCAL ROLE grc_app;` → `current_user =
grc_app`, `pg_try_advisory_lock` erfolgreich. Die DB-Integrationstests laufen
unter `grc_worker` durch (6/6). Ein Boot des Workers unter dieser Rolle mit
`NODE_ENV=production`: Start ohne Abbruch, Logzeile
`{"cron":"startup","phase":"db-role","role":"grc_worker","superuser":false,"bypassRls":true}`,
`/health` 200 mit `database: "ok"`, `/crons` meldet 131 Jobs, ein Cron-Aufruf
ohne Secret 401, ein unbekannter Job 404.

**Status: geschlossen.**

---

## 3. Abnahme

| Kriterium                                                                               | Beleg                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kein Job persistiert ein Ergebnis, das er nicht gemessen hat                            | `apps/worker/tests/no-fabricated-evidence.test.ts` (16 Tests über 13 Pfade + die Modul-Prozesse), `connector-schedule-runner.test.ts`, `connector-health-monitor.test.ts`                      |
| Zwei parallele Läufe desselben Jobs führen ihn genau einmal aus                         | `tests/lib/job-runtime.db.test.ts` — `executions === 1`, genau ein `skipped`; Logzeile `phase:"skipped", reason:"lock-held-elsewhere"`                                                         |
| Ein Job, der mitten in einer Menge scheitert, hinterlässt keinen inkonsistenten Zustand | `job-runtime.db.test.ts` (Zeilenzahl vor/nach identisch), `overdue-tasks.test.ts`                                                                                                              |
| `X-Forwarded-For`-Spoofing umgeht das Rate-Limit nicht                                  | `apps/web/src/__tests__/lib/rate-limit.test.ts` — 50 gefälschte Präfixe → ein Bucket; 20 behauptete Subjekte auf einer Adresse → gesperrt                                                      |
| E-Mail-Zustellfehler wird als Fehler gemeldet, `emailSentAt` bleibt leer                | `packages/email/tests/template-coverage.test.ts` + die zwei umgeschriebenen Tests in `email-service.test.ts`; `scheduled-notifications.ts` setzt `emailSentAt` nur bei vorhandener `messageId` |
| Alle referenzierten `templateKey`s existieren                                           | `template-coverage.test.ts` scannt drei Bäume inklusive Ternäre: 0 unbekannte von 75                                                                                                           |
| Der Worker startet unter `grc_worker` ohne Superuser-Rechte                             | live geprüft, siehe S01-09                                                                                                                                                                     |
| Migrationen grün                                                                        | 0435, 0436, 0437 gegen `grc_platform` angewandt, fehlerfrei                                                                                                                                    |
| `tsc --noEmit` fehlerfrei                                                               | `apps/worker` Exit 0; `apps/web` Exit 0, keine Ausgabe                                                                                                                                         |
| Bestehende Tests grün                                                                   | `packages/email` 174/174; `apps/worker` 130 von 131 Testdateien, 269 von 272 Tests — die eine rote Datei (`control-embedding-sync.test.ts`) ist ein WP6-Stand, siehe Abschnitt 5               |

**Testlauf-Zusammenfassung**

```
packages/email                        4 Dateien, 174 Tests  ✓
apps/worker (gesamt)                131 Dateien, 272 Tests  → 130 / 269 ✓
  davon neu: tests/lib/job-registry.test.ts        15 Tests ✓
             tests/lib/job-runtime.db.test.ts       6 Tests ✓ (echtes PostgreSQL, als grc_worker)
             tests/no-fabricated-evidence.test.ts  16 Tests ✓
  einzige rote Datei: tests/crons/control-embedding-sync.test.ts (WP6-Stand)
apps/web  rate-limit + ai-assist      2 Dateien,  47 Tests  ✓
apps/web  middleware-public-paths     1 Datei,    37 Tests  ✓
tsc --noEmit  apps/worker ✓   apps/web ✓
```

---

## 4. Bedarf an andere Pakete

### An WP10 (Betrieb, CI/CD, Doku) — der größte Block

1. **CI braucht eine Datenbank für die Worker-Integrationstests.**
   `apps/worker/tests/lib/job-runtime.db.test.ts` beweist die drei
   Kernzusagen dieses Pakets (Lock, Atomarität, Dedup) und läuft nur mit
   gesetztem `DATABASE_URL`/`APP_DATABASE_URL`. Ohne die Variable meldet
   `describe.skip` — und ein stiller Skip ist S11-02. Bitte in `ci.yml` gegen
   die frisch migrierte Testdatenbank setzen, sinnvollerweise als
   `grc_worker`.
2. **`.github/workflows/ci.yml` auf `grc_worker` umstellen.** WP2 hat es für
   `grc_app` angemerkt; die Worker-Hälfte ist jetzt fällig, sonst testet CI
   eine Rolle, die es in Produktion nicht mehr gibt.
3. **`deploy/provision-grc-app.sh` in den Deploy-Weg aufnehmen** mit gesetztem
   `GRC_WORKER_PASSWORD`. Ohne die Rolle startet der Worker-Container nicht
   mehr (`${GRC_WORKER_PASSWORD:?…}`) — das ist beabsichtigt, muss aber in
   `setup-hetzner.sh` / `update-all.sh` / `create-tenant.sh` und im Runbook
   stehen. Migration 0437 ist ein No-op, solange die Rolle fehlt, und meldet
   das als `NOTICE`.
4. **Neue Pflicht-Secrets:** `GRC_WORKER_PASSWORD`, `AUDIT_SEAL_KEY` (beide
   `:?`-erzwungen), optional `AUDIT_SEAL_KEY_ID`, `FREETSA_CA_PEM`. In die
   Secret-Rotation aufnehmen.
5. **Healthcheck für den `web`-Service** in `docker-compose.production.yml` —
   der Worker hat jetzt einen, `web` nicht (S10-21). Der Service-Block gehört
   nicht zu meiner Dateihoheit.
6. **`deploy/Caddyfile`:** `header_up X-Forwarded-For {remote_host}` wäre die
   sauberere Variante zu `TRUSTED_PROXY_HOPS`; solange Caddy anhängt, ist der
   Default 1 richtig. Und: ADR-019 behauptet ein Caddy-Rate-Limit von
   „100 req/s pro IP", das es ohne Plugin nicht gibt — entweder Plugin
   installieren oder die Behauptung streichen (S10-05d).
7. **Doku:** `docs/ADR-019` (Variablen sind jetzt implementiert, die
   Caddy-Ebene nicht), `docs/ADR-017` (`job_run` ist die maschinenlesbare
   Grundlage für Phase 1 des Monitorings), `docs/runbook.md` (Scheduler,
   `GET /crons`, `job_run`, `CRON_SCHEDULER_ENABLED`, die 20 Pfad-Aliase),
   `docs/STATUS.md` (S10-27: 131 statt „124" Cron-Dateien; der
   Signatur-Cron existiert).
8. **Alarm** auf `job_run.status IN ('failed','partial')` und auf `healthy =
false` aus `audit-chain-verify` (WP4 hat dasselbe angefordert). Die Daten
   liegen jetzt vor; der Alarm fehlt (S13-11/-12).
9. **Umbenennung `webhook_registration.secret_hash` → `signing_secret`**
   (S10-26). Betrifft `packages/db/src/schema/event-bus.ts`,
   `packages/events/src/webhook-signer.ts`,
   `apps/web/src/app/api/v1/webhooks/**`. Migration 0436 kennzeichnet die
   Spalte bis dahin in der Datenbank.
10. **Redis-Backend für das Rate Limiting.** Der Store ist prozesslokal; bei
    mehreren Web-Containern ist das effektive Limit `N × capacity`. `REDIS_URL`
    liegt bereits in Compose. Die API in `lib/rate-limit.ts` ändert sich nicht.
11. **Empfehlung, kein Auftrag:** die 62 Jobs, die mit „für jede Org" beginnen,
    lesen die Org-Liste selbst und brauchen deshalb BYPASSRLS. Führt man diese
    Aufzählung über eine `SECURITY DEFINER`-Funktion, könnte der Worker
    vollständig auf `grc_app` laufen. Eigener Umbau, bewusst nicht in WP9
    versteckt.

### An WP8 (Datenschutz, DSGVO)

1. **S10-18 —** `document-retention-purge.ts:117-130`: der `catch` um
   `storage.delete()` unterscheidet nicht zwischen „war schon weg" und
   „S3 antwortet 403 / Volume read-only". Weil die `document`- und
   `document_file`-Zeilen mit dem `file_path` vorher committet wurden, ist die
   Datei danach nicht mehr auffindbar — personenbezogene Daten überleben die
   DSGVO-Art.-17-Löschung ohne Referenz, und `{"success":true,"purged":40,
"filesDeleted":0}` ist der einzige Hinweis. Empfehlung: Datei-Löschung vor
   dem Commit versuchen oder eine `pending_file_deletion`-Outbox schreiben,
   bevor die DB-Zeilen verschwinden; Fehler zwingend protokollieren
   (`reportJobError` aus `lib/job-runtime.ts` steht bereit).
2. **S10-14 (c) —** dieselbe Datei, Zeile 100-104: der Org-Kontext wird
   **nach** dem `INSERT INTO audit_log` derselben Transaktion gesetzt. Mit
   `withOrgContext()` aus `lib/org-context.ts` ist das eine Zeile.
3. **Zwei leere `catch`** in derselben Datei (S10-11) — von der mechanischen
   Umstellung ausgenommen, weil die Datei euch gehört.
4. **Registriert, wie zugesagt:** `retention-access-logs` (`0 2 * * *`),
   `retention-whistleblowing` (`40 2 * * *`), `document-retention-purge`
   (`30 1 * * *`) und `retention-monitoring` (`45 1 * * *`). Wenn ihr andere
   Zeiten wollt, ändert die Registry-Einträge — sie sind bewusst nachts und
   gegeneinander versetzt, damit die Löschläufe nicht gleichzeitig auf
   denselben Tabellen arbeiten.
5. Die Rate-Limit-Policies für `/api/v1/export/**`, `/api/v1/portal/**` und
   `/api/v1/whistleblowing/intake` sind gesetzt (Intake fail-closed, 5/600 s).
   Sagt Bescheid, wenn ihr andere Budgets braucht — sie stehen in einer Tabelle
   und in `.env`.

### An WP6 (AI, Copilot)

1. **`apps/worker/src/lib/org-context.ts` existiert jetzt.**
   `regulatory-relevance-scorer.ts` importierte es, es gab die Datei aber
   nicht — `tsc` auf `apps/worker` schlug dadurch fehl. Der Export ist
   `withOrgContext(orgId, fn)` mit `tx` als Argument, wie ihr ihn benutzt.
2. **`apps/worker/src/crons/regulatory-relevance-scorer.ts:213`** hatte
   zwischenzeitlich `'err' is of type 'unknown'` (TS18046); beim letzten Lauf
   war das behoben — vermutlich von euch. Zur Kenntnis, nichts zu tun.
3. **`apps/worker/tests/crons/control-embedding-sync.test.ts`** ist rot: der
   `@grc/ai`-Mock des Tests exportiert `providerPlacements` nicht, das eure
   neue Fassung von `control-embedding-sync.ts:99` importiert. Drei Tests.
4. Rate-Limit-Policies für `/api/v1/ai/**` (10/60 s), `/api/v1/copilot/**`
   (30/60 s) und `/api/v1/processes/generate-bpmn` sind gesetzt.
   `copilot-rag-indexer` und `control-embedding-sync` sind registriert
   (`30 20 * * *` bzw. `0 20 * * *`), inhaltlich unverändert.

### An WP4 (Audit-Integrität)

Beide angeforderten Punkte sind geliefert: `daily-audit-anchor` 00:05 UTC,
`audit-chain-verify` 02:00 UTC, der Endpunkt registriert (503 bei
`healthy === false`), `AUDIT_SEAL_KEY` als Pflichtvariable in Compose und
`.env.example`. Zusätzlich: Migration 0437 gibt `grc_worker` die Rechte auf
`audit_anchor`, `audit_chain_verification` und `audit_anchor_seal` — ohne sie
hätte die Rollenumstellung eure Verankerung mit `42501` stillgelegt. Die
Runbook-Zeile zur Datumssemantik (`{"date":"2026-04-15"}` verankert jetzt den
15.) ist in Abschnitt 4 an WP10 weitergegeben.

### An WP3 (Auth)

`apps/web/src/middleware.ts` — eine Datei in eurer Hoheit — hat einen
klar abgegrenzten, kommentierten Block bekommen, der
`checkRequestRateLimit()` **vor** der Authentifizierungsprüfung aufruft (Brute
Force passiert unauthentifiziert). `getClientIp()` ist auf
Trusted-Proxy-Hop-Zählung umgestellt, Auth-Pfade sind fail-closed. Der von euch
gebaute kontobasierte Lockout und dieses IP-basierte Limit ergänzen sich: das
Limit fängt das Sprühen eines Passworts über viele Konten, der Lockout den
Angriff auf ein einzelnes.

### An WP11 (Testfundament)

Drei bestehende Testdateien haben den **defekten** Zustand festgeschrieben und
sind mit Begründung umgeschrieben:
`packages/email/tests/email-service.test.ts` (2 Fälle: „should return empty
string messageId when data.id is null"),
`apps/web/src/__tests__/lib/rate-limit.test.ts` („returns first entry from
X-Forwarded-For") und `apps/worker/tests/crons/overdue-tasks.test.ts` (Batch-
Update-Semantik). Zwei der aus S11-09 bekannten Ein-Assertion-Tautologien
(`connector-schedule-runner`, `connector-health-monitor`) sind durch echte
Prüfungen ersetzt — als Muster für die übrigen 101.

---

## 5. Restrisiko und offene Punkte

1. **Das Rate Limiting ist prozesslokal.** Bei mehreren Web-Containern ist das
   effektive Limit `N × capacity`. Für den Login-Pfad ist das trotzdem eine
   Größenordnung besser als vorher (unbegrenzt), aber es ist keine harte
   Schranke. Redis ist an WP10 übergeben.
2. **Die generische E-Mail-Vorlage ist kein Ersatz für 48 fachliche
   Vorlagen.** Sie rendert echten Inhalt mit korrektem Betreff und
   Schweregrad, aber eine DSGVO-Art.-33-Warnung verdient auf Dauer dieselbe
   Sorgfalt wie die 27 handgeschriebenen. Was sie leistet: keine Mail stirbt
   mehr am `default: throw`.
3. **„Nicht implementiert" ist kein Ersatz für „implementiert".** Vierzehn
   Pfade melden jetzt ehrlich, dass sie nichts messen — die Connector-Tests,
   die Identity-Prüfungen, der Marketplace-Scanner, die Simulation, der
   Import, die Evidenzprüfung, das Modelltraining und acht Modul-Prozesse
   existieren dadurch nicht. `CLAUDE.md`, `docs/STATUS.md` und
   `docs/feature-catalog.md` führen mehrere davon als „✅ Done"; diese Zusagen
   sind jetzt nachweislich falsch und gehören korrigiert (S14-02 nennt die
   Fundstellen). Der Fix stellt die Ehrlichkeit her, nicht die Funktion.
4. **Der Dedup-Schlüssel enthält einen Hash des Titels.** Ändert ein Job seinen
   Titeltext, gilt die Benachrichtigung als neu und wird einmal zusätzlich
   zugestellt. Das ist die bewusst gewählte Seite des Kompromisses: lieber
   einmal zu viel als eine unterdrückte Fristmeldung.
5. **Der In-Process-Scheduler teilt das Schicksal des Prozesses.** Stirbt der
   Worker, laufen die Jobs nicht — dagegen hilft der neue Compose-Healthcheck
   plus `restart: unless-stopped`, aber ein Job, dessen Minute in einem
   Neustartfenster lag, wird nicht nachgeholt. Für die täglichen Jobs ist das
   unkritisch (der nächste Lauf holt auf, `daily-audit-anchor` hat sein
   Retry-Fenster aus WP4), für die Minutentakt-Queues ebenfalls. Ein
   „missed run"-Nachholmechanismus über `job_run` wäre der nächste Ausbau.
6. **`job_run` ist Betriebsprotokoll, kein Nachweis.** Es hängt bewusst nicht
   an der Audit-Kette und wird nach 90 Tagen gelöscht. Wer aus ihm eine
   Compliance-Aussage ableiten will, muss das gesondert begründen.
7. **Fremde Stände in Welle 3.** Beim Abschluss steht genau eine rote
   Testdatei: `apps/worker/tests/crons/control-embedding-sync.test.ts`
   (3 Tests, WP6 — der `@grc/ai`-Mock des Tests exportiert
   `providerPlacements` nicht, das die neue Fassung des Jobs importiert).
   Während meiner Läufe kamen und gingen zusätzlich ein TS18046 in
   `regulatory-relevance-scorer.ts` (WP6) und ein TS2352 in
   `document-retention-purge.ts` (WP8); beim abschließenden `tsc`-Lauf über
   `apps/worker` und `apps/web` trat keiner von beiden mehr auf. Alle liegen
   außerhalb meiner Dateihoheit und sind in Abschnitt 4 gemeldet.

---

## 6. Aufräumen

**Hinweis zur Formatierung.** Am Ende lief ein `prettier --write` über
`apps/worker/src/**`, `apps/worker/tests/**`, `packages/email/**` und die
einzeln benannten Web-Dateien. Das erfasst auch Dateien, die anderen Paketen
gehören. `apps/worker/src/crons/audit-chain-verify.ts` (WP4, bereits
committet) war dadurch rein formatierend geändert und ist **zurückgesetzt**.
Die noch unfertigen Stände von WP6 (`control-embedding-sync.ts`,
`copilot-rag-indexer.ts`, `regulatory-relevance-scorer.ts`) und WP8
(`document-retention-purge.ts`, `retention-monitoring.ts`) sind bewusst NICHT
zurückgesetzt worden — ein `checkout` hätte deren laufende Arbeit gelöscht.
Falls dort eine Formatierungsänderung von mir stammt: sie ist semantisch
folgenlos und entspricht dem `npm run format` des Repos.

Angelegt und wieder entfernt: die Boot- und Scheduler-Sonden
(`apps/worker/wp9-boot-probe.ts`, `wp9-sched-probe.ts`) und ihre
`job_run`-Zeilen. In der Datenbank verbleiben aus dem Integrationstest die
Fixtures `organization('ARCTOS WP9 test fixture')` und
`user('wp9-fixture@example.invalid')` — beide werden bei wiederholten Läufen
wiederverwendet und **nicht** gelöscht, weil WP4 `audit_log` append-only gemacht
hat und der INSERT-Trigger eine Zeile mit Fremdschlüssel auf die Organisation
schreibt: eine einmal angelegte Org ist nicht mehr entfernbar. Der Test räumt
alles auf, was er sonst schreibt (seine Notifications). Die Rolle `grc_worker`
wurde in der lokalen Datenbank angelegt — beabsichtigt, sie ist ab jetzt die
Laufzeitrolle des Workers.
