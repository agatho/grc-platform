# Welle 5b — OP-104: die Doku führte fertig, was der Code als fehlend meldet

**Grundlage:** `docs/OFFENE-PUNKTE-REGISTER.md` · `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §7
**Punkte:** OP-104 (Kern) · OP-106, OP-115, OP-117, OP-130, OP-133, OP-134, OP-151,
OP-159, OP-051, OP-053, OP-100, OP-112, OP-114, OP-145 · verifiziert und
geschlossen befunden: OP-131, OP-132, OP-138
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `2f716205`
**Gebiet:** `docs/**` (ohne Register und Umsetzungsplan), Wurzeldokumente,
`.github/workflows/**`, `.env.example`, neue Tests

---

## 1. Ergebnis in einem Satz

Die Zahl aus OP-103 stimmt nicht: es sind nicht vierzehn Pfade, die sich ehrlich
als „nicht implementiert" melden, sondern **19 in 12 Dateien** — und **fünf
Sprint-Zeilen in `CLAUDE.md`, vier in `docs/STATUS.md` und drei in
`docs/feature-catalog.md`** führten genau diese Fähigkeiten als fertig. Das ist
korrigiert, und ein Test hält die drei Dokumente ab jetzt am Quellcode fest,
statt die Liste an drei Stellen zu pflegen.

Nebenbei gefunden, und der schwerere Befund dieser Welle: **ein neuntes Tor, das
nicht auslösen konnte.** `.github/workflows/secret-scanning.yml:123` rief den
repo-eigenen Secret-Scanner mit `continue-on-error: true` **und** `|| true` auf.
Neu gemessen meldet er zwei CRITICAL-Treffer — eingeschleppt von **Welle 4b-2
dieses Audits**, zwei Wellen lang unsichtbar.

| Messgröße                                                      |                 vorher |                nachher |
| -------------------------------------------------------------- | ---------------------: | ---------------------: |
| Pfade, die „nicht implementiert" melden (Register: „vierzehn") |                 **14** |                 **19** |
| Sprint-Zeilen mit falschem ✅ in den drei Statusdokumenten     |                 **12** |                  **0** |
| Zahlen in `CLAUDE.md`, die dieser Datei selbst widersprechen   |                  **4** |                  **0** |
| Zeilen der Zähltabelle in `CLAUDE.md`, die überholt waren      |           **8 von 12** |                  **0** |
| Tore in `.github/workflows/`, die nicht auslösen können        |                  **1** |                  **0** |
| Secret-Scan-Report: Stand / Dateien / Funde                    | 2026-09-01 / 3.901 / 0 | 2026-09-05 / 4.420 / 2 |
| Von Migration 0439 versprochene, nicht existierende Testdatei  |                  **1** |                  **0** |

---

## 2. Zuerst messen

### 2.1 Die „vierzehn" aus OP-103 ist eine Fähigkeits-, keine Pfadzahl — und auch als solche falsch

`WP9.md` §5.3 schreibt: „Vierzehn Pfade melden jetzt ehrlich, dass sie nichts
messen — die Connector-Tests, die Identity-Prüfungen, der Marketplace-Scanner,
die Simulation, der Import, die Evidenzprüfung, das Modelltraining und acht
Modul-Prozesse." Sieben benannte plus acht ergibt fünfzehn, nicht vierzehn. Der
Kopfkommentar von `apps/worker/tests/no-fabricated-evidence.test.ts` nennt
ebenfalls „fourteen code paths" und zählt darunter dreizehn auf.

Selbst gezählt am 2026-09-05 gegen `2f716205`, aus dem Quellcode abgeleitet über
die drei Formen, in denen dieses Repo „ich habe nichts gemessen" sagt
(`NotImplementedEvidenceError`, HTTP 501 mit `error: "Not implemented"`, und
`failed` mit der Begründung „not implemented in this build"):

```
501          apps/web/src/app/api/v1/cloud-connectors/executions/route.ts
501          apps/web/src/app/api/v1/connectors/[id]/health/route.ts
501          apps/web/src/app/api/v1/connectors/[id]/test-run/route.ts
501          apps/web/src/app/api/v1/identity-connectors/sync/route.ts
throw        apps/worker/src/crons/connector-health-monitor.ts
mark         apps/worker/src/crons/connector-schedule-runner.ts
mark         apps/worker/src/crons/evidence-review-processor.ts
mark         apps/worker/src/crons/import-job-processor.ts
mark         apps/worker/src/crons/marketplace-security-scanner.ts
mark         apps/worker/src/crons/predictive-risk-trainer.ts
mark         apps/worker/src/crons/simulation-runner.ts
throw        apps/worker/src/lib/module-aware-cron.ts   (8 Prozesse)
TOTAL FILES: 12
```

**19 adressierbare Pfade in 12 Dateien.** Das ist die Zahl, die jetzt in
`docs/feature-catalog.md` steht, und der Test rechnet sie bei jedem Lauf neu
aus.

Nicht mitgezählt: `GET /api/v1/isms/soa/diff` antwortet 501, wenn
`fromRunId`/`toRunId` gesetzt sind. Das ist eine Teilverweigerung eines
vorhandenen Endpunkts (die SoA ist mandantenglobal, nicht je Lauf versioniert),
keine fehlende Fähigkeit.

### 2.2 Zwölf Zeilen führten fertig, was verweigert

| Datei                     | Zeile | Behauptung                           | Wirklichkeit                                                                          |
| ------------------------- | ----: | ------------------------------------ | ------------------------------------------------------------------------------------- |
| `CLAUDE.md`               |   105 | `16–19 … Bulk Import/Export ✅ Done` | `import-job-processor.ts` importiert nichts, `processedItems` bleibt 0                |
| `CLAUDE.md`               |   110 | `34–37 … GRC Agents (MCP) ✅ Done`   | MCP kommt im Anwendungscode nicht vor (s. u.)                                         |
| `CLAUDE.md`               |   116 | `62–66 … Connectors ✅ Done`         | vier Endpunkte antworten 501, zwei Crons melden Fehlschlag                            |
| `CLAUDE.md`               |   117 | `67–71 … ✅ Done`                    | AI Evidence Review, Control Testing und Predictive Risk verweigern                    |
| `CLAUDE.md`               |   120 | `82–86 … Simulation Engine ✅ Done`  | `simulation-runner.ts` rechnet nichts, `marketplace-security-scanner.ts` prüft nichts |
| `docs/STATUS.md`          |   321 | `10–37 ✅`                           | enthält Bulk-Import und die GRC-Agents                                                |
| `docs/STATUS.md`          |   325 | `62–66 ✅`                           | dito Connectors                                                                       |
| `docs/STATUS.md`          |   326 | `67–71 ✅`                           | dito                                                                                  |
| `docs/STATUS.md`          |   329 | `82–86 ✅`                           | dito                                                                                  |
| `docs/feature-catalog.md` |    52 | `16–19 ✅`                           | Bulk-Import                                                                           |
| `docs/feature-catalog.md` |    57 | `34–37 ✅`                           | GRC-Agents (MCP)                                                                      |
| `docs/feature-catalog.md` |    67 | `82–86 ✅`                           | Simulation Engine, Marketplace                                                        |

Zwei Zeilen standen schon auf ⚠️, sagten aber das Falsche:

- `docs/feature-catalog.md:63` (62–66) schrieb „…erfanden bis 2026-09-01 ihre
  Ergebnisse … **(S14-02, behoben durch WP9)**". WP9 hat die **Erfindung**
  entfernt, nicht die Funktion gebaut. Für einen Leser, der die Zeile im
  Kontext einer Statustabelle sieht, liest sich „behoben" als „tut jetzt, was
  der Name sagt".
- `docs/feature-catalog.md:64` (67–71) nannte als einzigen Mangel die
  MCP-Agents aus der 34–37-Zeile — also einen Mangel, der gar nicht in dieser
  Zeile steht — und ließ die drei tatsächlich fehlenden Fähigkeiten dieser
  Zeile unerwähnt.

**Nachweis für die MCP-Behauptung:**

```
$ grep -rn "MCP" --include='*.ts' --include='*.tsx' apps packages | grep -v node_modules
packages/db/src/schema/agents.ts:1:// Sprint 35: GRC Monitoring Agents (MCP-based)
```

Ein Treffer, und der ist ein Kommentar.

### 2.3 `CLAUDE.md` widersprach sich an vier Stellen selbst

Die WP12-Korrektur vom 2026-09-01 hat die Zähltabelle im Kopf der Datei
erneuert und die Aussagen weiter unten stehen lassen.

| Zeile | Steht dort                                   | Steht in derselben Datei                                              | Gemessen 2026-09-05                                         |
| ----: | -------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
|   135 | `31 catalog frameworks (~2,100 entries)`     | Zeile 21: `catalog frameworks \| 46`                                  | **46** (`ls packages/db/sql/seed_catalog_*.sql`)            |
|   136 | `401 cross-framework mappings`               | Absatz nach der Tabelle: die Zahl sei „removed rather than corrected" | **943** `insert_mapping`-Aufrufe in den fünf Seeds          |
|    63 | `SQL migrations (0001–0361, 340 files)`      | Zeile 18: `SQL migration files \| 402`                                | **428**, zuletzt `0478_op089_matviews_to_invoker_views.sql` |
|   249 | `seed_cross_framework_mappings*.sql (v1…v4)` | —                                                                     | **fünf** Dateien (v5 existiert)                             |

Und die Zähltabelle selbst, „re-measured 2026-09-01", war nach den Wellen 0
bis 5a in **acht von zwölf** Zeilen überholt — die Migrationen um 26, die
Testdateien um 116, die Routen um 10. Alle acht sind auf den Stand von
`2f716205` gezogen; der Messbefehl steht wie bisher je Zeile daneben.

### 2.4 Die Anleitung zum Nachzählen zeigte auf eine Tabelle, die es nicht gibt

`docs/feature-catalog.md:130` schloss den Korrekturhinweis zu den
Cross-Framework-Mappings mit: „Wer die Zahl braucht, zählt sie in der Datenbank:
`SELECT count(*) FROM cross_framework_mapping;`"

```
$ psql -d grc_v4c -c 'SELECT count(*) FROM cross_framework_mapping'
ERROR:  relation "cross_framework_mapping" does not exist
```

Die Tabelle heißt `framework_mapping` (Migration
`0107_sprint66_framework_mapping_tables.sql`); `catalog_entry_mapping` ist der
UUID-Vorgänger, den `0106` hinüberbrückt. **Die Korrektur der Doku-Drift hatte
selbst gedriftet** — und zwar in derselben Zeile, die erklärt, warum man Zahlen
messen statt schätzen soll.

---

## 3. Was gebaut wurde

### 3.1 Ein Inventar an einer Stelle, und ein Test, der es hält

`docs/feature-catalog.md` hat einen neuen Abschnitt „Was sich ehrlich als
‚nicht implementiert' meldet": zwölf Zeilen mit Pfad, Antwortverhalten und dem
Satz, was es nicht gibt, plus ein Marker `<!-- OP-104:refusal-paths=19 -->`.
`CLAUDE.md` und `docs/STATUS.md` verweisen dorthin, statt die Liste zu
wiederholen.

`apps/worker/tests/docs-vs-honest-refusals.test.ts` (15 Prüfungen) leitet die
Liste bei jedem Lauf **aus dem Quellcode** ab und fällt in drei Richtungen:

- ein neuer verweigernder Pfad steht nicht im Inventar,
- ein Pfad wird gebaut, bleibt aber im Inventar stehen,
- jemand setzt eine der elf betroffenen Sprint-Zeilen zurück auf ein blankes ✅.

Dazu eine Negativkontrolle (`refusals.length >= 10`): wäre das Ableitungsmuster
kaputt, liefe die Suite mit einer leeren Liste grün durch und prüfte nichts —
genau die Form der acht Tore, die dieser Audit gefunden hat.

**Fallnachweis gegen den alten Stand.** Vor den Doku-Korrekturen, bei
unverändertem Code:

```
$ npx vitest run tests/docs-vs-honest-refusals.test.ts
      Tests  14 failed | 1 passed (15)
AssertionError: Nicht im Inventar: apps/worker/src/crons/connector-health-monitor.ts, … (12 Dateien)
AssertionError: docs/feature-catalog.md fuehrt keinen Marker `<!-- OP-104:refusal-paths=N -->`
AssertionError: CLAUDE.md fuehrt "62–66" als fertig, obwohl Connector-Test, -Health und Identity-Sync antworten 501.
…
```

Nach den Korrekturen: `Tests 15 passed (15)`.

### 3.2 Der Test, den Migration 0439 seit Monaten behauptet (OP-051)

`packages/db/drizzle/0439_work_item_type_catalog_gaps.sql:38-40` schreibt, dass
`packages/db/tests/unit/work-item-type-registry.test.ts` die Gegenprobe
dauerhaft hält. Die Datei existierte nicht. Sie existiert jetzt: sie liest die
`INSERT INTO work_item_type`-Anweisungen aller Migrationen und die
`typeKey: "…"`-Literale in `apps/web/src` und `apps/worker/src` und verlangt,
dass jeder geschriebene Schlüssel registriert ist. Keine Datenbank nötig —
beide Seiten stehen im Repository.

**Fallnachweis:** mit temporär geleerter Migration 0439 (danach unverändert
zurückgespielt, `git status` sauber):

```
AssertionError: Katalogeintrag 'data_breach' fehlt: expected false to be true
AssertionError: Diese typeKey werden in work_item geschrieben, aber von keiner
  Migration in work_item_type angelegt … expected [ …(5) ] to deeply equal []
      Tests  2 failed | 2 passed (4)
```

Genau die fünf Schlüssel, die 0439 nachgetragen hat.

Beim Schreiben fiel ein Muster auf, das eine Lehre wert ist: die erste Fassung
trennte die SQL-Anweisung am Semikolon und entfernte danach die Kommentare.
0439 enthält in einem Erklärkommentar mitten in der Anweisung ein `;`
(„… Tabelle audit_finding); diese hier hängt an …"). Die Anweisung wurde dort
abgeschnitten, fünf Schlüssel fehlten — und ohne die Stichprobe im ersten Test
(„liest überhaupt Katalogeinträge") wäre das als **echter Befund** durchgegangen.

### 3.3 Ein Tor, das nicht auslösen konnte — und was es verdeckt hat

```yaml
# .github/workflows/secret-scanning.yml:121-123, vorher
- name: Repo secret scanner (scripts/audit-secrets.mjs)
  continue-on-error: true
  run: node scripts/audit-secrets.mjs || true
```

`scripts/audit-secrets.mjs:569` beendet sich mit Exit 1, sobald ein
CRITICAL-Treffer übrig bleibt. Beide Abschaltungen zusammen verwarfen das.

Der eingecheckte Report stammte vom **2026-09-01** und meldete „Files scanned: 3901. Findings: 0." Ein Artefakt aus einem früheren Lauf ist keine Messung —
neu erzeugt am 2026-09-05:

```
$ node scripts/audit-secrets.mjs
Scanning 4420 files...
→ Wrote /work/repo/docs/security/secret-scan-report.md
  Findings: 2
  Critical: 2
$ echo $?
1
```

Beide Treffer stehen in `packages/shared/tests/logger-scrubbing.test.ts:100` —
dem PEM-Header `-----BEGIN RSA PRIVATE KEY-----` ohne jedes Schlüsselmaterial,
Testgegenstand einer Scrubbing-Prüfung. Die Datei kam mit
`08a4ae4f fix(welle-4b-2): OP-152 — Log-Scrubbing, und die Ausnahmeliste davor`
— also aus **diesem Audit** — und wurde nicht in `KNOWN_TEST_FIXTURES`
aufgenommen. Wegen `|| true` fiel es zwei Wellen lang niemandem auf.

**Der Schritt ist jetzt scharf**, und der Report steht auf dem gemessenen Stand.
Er bleibt rot, bis die Fundstelle als bewertete Ausnahme in
`scripts/audit-secrets.mjs` eingetragen ist — eine Zeile, Muster wie die neun
Einträge davor. `scripts/**` liegt außerhalb der Dateihoheit dieser Welle; die
genaue Änderung steht in §5.

Die restlichen `|| true` in den Workflows sind geprüft und legitim
(Kommandosubstitutionen, die eine leere Liste liefern dürfen, und Aufräumzeilen);
die beiden `continue-on-error` in `secret-scanning.yml:68/76` hängen am
Herunterladen des gitleaks-Binaries und sind an Ort und Stelle begründet.

### 3.4 Der Rückweg für eine Migration, die durchlief (OP-133)

ADR-023 §2 und §5 beschließen Kompensationsmigrationen seit 2026-09-01 als
**Normalfall**, `migration-policy.yml:71` erzwingt dafür den Header
`-- Compensating-Required:` in jeder neuen Migration — und der Ablauf stand
nirgends. `docs/runbook.md` §5.1 beschreibt ihn jetzt: die drei Fragen, die
zwischen Restore und Kompensation entscheiden, die nächste freie Nummer mit
`-- Compensates:`, Idempotenz gegen zwei Datenbankzustände, die Probe in einer
Transaktion mit `ROLLBACK`, und die Grenze — eine Migration, die Zeilen oder
Spaltenwerte gelöscht hat, ist nicht kompensierbar.

Der Umsetzungsplan in ADR-023 stand komplett auf offen, obwohl **alle vier
Phasen** umgesetzt sind. Nachgemessen und abgehakt, mit einer Abweichung, die
festgehalten gehört: Phase 3 existiert nicht als `migration-rehearsal.yml`, wie
§3 sie beschreibt, sondern als Job `migration-rehearsal` in
`migration-policy.yml:117`.

### 3.5 Ein `grep` im Runbook, das vor einem Breaking-Rollout Entwarnung gab

`docs/runbook.md` §5 nennt dem Betreiber den Befehl, mit dem er feststellt, ob
ein Release ein Wartungsfenster braucht:

```
$ grep -l '^-- Breaking: *true' packages/db/drizzle/*.sql
(nichts)
```

Der Header nach ADR-023 §4 schreibt `yes-breaking` bzw. `yes-backfill`, niemals
`true`. Der dokumentierte Befehl hätte einem Operator unmittelbar vor dem
Rollout von `0383`, `0385` und `0386` gemeldet, es gebe keine Breaking-Migration.
Korrigiert auf `grep -lE '^-- Breaking: *yes'` — der findet die drei.

Im selben Abschnitt stand „`0387` legt **450 Indizes** an". Die Migration legt
sie **dynamisch** über zwei `DO $$ … LOOP`-Blöcke an; die Zahl steht nicht in
der Datei. Gegen die voll migrierte `grc_v4c` gemessen tragen **509** Indizes
ihre Namensmuster (439 `idx_*_fk`, 70 `idx_*_org_id`).

### 3.6 Schutzgrenzen: was die Prüfungen leisten und was nicht (OP-115, OP-114, OP-112, OP-117)

Neu: `docs/security/schutzgrenzen.md`. Für jede der drei Schranken steht dort,
was sie garantiert und was ausdrücklich nicht:

- **Magic Bytes sind eine Formatprüfung.** Eine Datei mit `%PDF`-Header und
  beliebigem Rest passiert. Und die Instanz, die dafür zuständig wäre, ist
  standardmäßig aus: ohne `CLAMAV_HOST` wird gar nicht gescannt
  (`scan_status = 'skipped'`), und Scanfehler sind ohne `CLAMAV_FAIL_CLOSED=1`
  fail-open. Der Satz „Uploads werden auf Schadsoftware geprüft" ist für eine
  Standardinstallation **nicht wahr**.
- **Die ZIP-Vorprüfung glaubt dem Zentralverzeichnis.** Im Import-Pfad fangen
  Streaming-Leser und Zeilenobergrenzen das ab. Im BPMN-Excel-Pfad
  (`packages/shared/src/lib/excel-to-bpmn.ts:43`) gibt es **nur** diese eine
  Schicht: Zeile 54 ruft `wb.xlsx.load()`, also genau den nicht-streamenden
  Aufruf, den `#S04-04` mit 2,26 GB RSS gemessen hat. Der Registereintrag
  OP-114 („Zweite und dritte Schicht fangen es ab") gilt für einen der beiden
  Aufrufer.
- **Die SSRF-Schranke hat ein TOCTOU-Fenster** (OP-112), und
  `WEBHOOK_ALLOW_HTTP=1` öffnet Klartext-HTTP für **alle** ausgehenden Aufrufe,
  nicht nur für Webhooks.

OP-117 ist zusätzlich als Upgrade-Hinweis in `CHANGELOG.md` unter `[Unreleased]`
gelandet — mit der Abfrage, die ein Betreiber vor dem Rollout gegen seine
Datenbank fährt (gegen `grc_v4c` ausgeführt, beide Tabellennamen und
Spaltennamen geprüft):

```sql
SELECT 'webhook' AS art, id, url     FROM webhook_registration WHERE url      LIKE 'http://%'
UNION ALL
SELECT 'feed',          id, feed_url FROM threat_feed_source   WHERE feed_url LIKE 'http://%';
```

### 3.7 `job_run` ist Betriebsprotokoll, kein Nachweis (OP-106, OP-100)

`docs/runbook.md` §8 hat einen Abschnitt dazu: nicht an der Audit-Kette, keine
Hash-Prüfung, Löschung nach 90 Tagen (Fehlläufe 180,
`JOB_RUN_RETENTION_DAYS`), und — das ist der Teil, den ein Prüfer am ehesten
falsch liest — **nicht lückenlos**. Verpasste Läufe werden nicht nachgeholt
(OP-100). Dazu die beiden Abfragen, die ein Betreiber tatsächlich braucht,
beide gegen `grc_v4c` ausgeführt.

### 3.8 Required Checks: die Liste, die bisher nirgends stand (OP-151)

OP-151 nennt zwei Tore, die „erst wirken, wenn sie required sind". Das ist eine
Entscheidung des Eigentümers — sie scheiterte aber auch daran, dass die exakten
Check-Namen nirgends standen. GitHub verlangt den **Job-Namen**, nicht den
Dateinamen. `docs/ADR-016-cicd-pipeline.md` führt jetzt alle 20 Checks mit dem
Namen, unter dem sie in der Branch-Protection erscheinen, und markiert die drei
fehlenden.

Dazu die Falle, die den Eigentümer sonst am selben Tag zurückwerfen würde: vier
der Workflows sind pfadgefiltert. Ein als required markierter Check, der nicht
startet, lässt die PR in GitHub **dauerhaft hängen** — nicht durchfallen,
warten. Wer diese vier required macht, braucht vorher einen zusammenfassenden
Job oder einen `paths`-losen Aufruf mit frühem `if`-Abbruch. Das ist ein Umbau
der Workflows, keine Einstellung in der Oberfläche.

### 3.9 Drei Abkürzungen, die ein Review ablehnt (OP-159)

`CONTRIBUTING.md` §Review-Process nennt sie jetzt beim Namen:
`ARCTOS_BUILD_IGNORE_TS_ERRORS=1` als Weg um einen roten Typecheck, ein Tor mit
`|| true` oder `continue-on-error: true`, und eine Ratsche, die man beim Reißen
höher stellt. Alle drei sind während dieses Audits im Code gefunden worden.

### 3.10 Kleinere Korrekturen

- **OP-130:** `docs/STATUS.md:136` führte „kein Worker-Cron für Due-Date-
  Eskalation ausstehender Signaturen" als offen. Es gibt ihn:
  `apps/worker/src/crons/signature-due-reminder.ts`, registriert in
  `apps/worker/src/lib/job-registry.ts:713`, mit gestuften Erinnerungen und
  einmaliger Eskalation ab drei Tagen Überfälligkeit. Das war die letzte offene
  Fundstelle aus S10-27.
- **OP-053:** `docs/DEVELOPER_GUIDE.md` beschreibt jetzt, dass der
  Produktionsbau `.next/standalone` leert und `.next/static`, `public` **und
  `.env.local`** zurückkopiert werden müssen — mit dem Symptom, an dem man es
  sonst nicht erkennt (`MissingSecret`/`UntrustedHost`, jede Anmeldung auf
  `/api/auth/error`). Der Docker-Pfad ist nicht betroffen; das Problem trifft
  nur den lokalen Standalone-Lauf, also den E2E-Pfad. Es hat dort zwei
  Vollläufe gekostet.
- **ADR-016:** die Kennzahlen der DB-Integritätsbaseline waren alle vier
  überholt — „594 Tabellen, 2.624 Policies, 547 FORCE-RLS, 283 Audit-Trigger"
  gegen gemessene **606 / 2.639 / 558 / 291**.

---

## 4. Was geprüft und bereits geschlossen war

Drei Registereinträge beschreiben Zustände, die es nicht mehr gibt. Nachgemessen
gegen `2f716205`:

| Punkt      | Registertext                                                          | Befund                                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OP-131** | `deploy/update-all.sh` fährt `sort` und `\|\| true`, ruft kein Backup | **Erledigt (WP10).** Zeile 253 ruft `db-backup.sh --pre-migration` blockierend; der Migrationslauf benutzt `migrate-all.ts` mit Ledger; die beiden `sort`-Treffer stehen in Erklärkommentaren |
| **OP-132** | `docs/ADR-023` steht auf _Proposed_                                   | **Erledigt.** Zeile 3: `**Status:** **Accepted** (2026-09-01)`. Offen war nur die Umsetzungsliste — jetzt gemessen und abgehakt                                                               |
| **OP-138** | Veralteter Kommentar in `packages/db/src/index.ts:157`                | **Erledigt.** `grep -n create-missing-tables packages/db/src/index.ts` ist leer; die zwei verbliebenen Treffer im Repo beschreiben den historischen Defekt korrekt im Präteritum              |

Und eine weitere Registerzahl, die nicht stimmt: **OP-145** nennt „acht
überholte `dependabot/*`-Branches auf origin". `git branch -r | grep -c
dependabot` → **10**. Das bleibt eine Entscheidung des Eigentümers (GitHub-Zugriff),
aber mit der richtigen Zahl.

**OP-136** bestätigt: `dashboard_widget_config` und `notification_template`
existieren in der migrierten Datenbank **überhaupt nicht**
(`information_schema.tables` leer für beide), während
`packages/db/drizzle/0124_seed_isms_bcm_dashboards.sql` und
`packages/db/src/seeds/{erm,isms-bcm}-dashboards.ts` dagegen schreiben. Die
Seeds sind No-Ops. Was daraus folgt, ist eine fachliche Entscheidung
(org-gebundenes Zielmodell oder Seeds entfernen) und keine Doku-Arbeit.

---

## 5. Codeänderungen, die nötig sind und hier nicht gemacht wurden

`apps/**/src/**`, `packages/**/src/**` und `scripts/**` liegen außerhalb der
Dateihoheit dieser Welle. Fünf Änderungen mit Datei und Zeile:

1. **`scripts/audit-secrets.mjs`, nach Zeile 275 — blockiert die CI.**
   `KNOWN_TEST_FIXTURES` um einen Eintrag ergänzen, Form wie die neun davor:

   ```js
   {
     path: "packages/shared/tests/logger-scrubbing.test.ts",
     reason:
       "Testgegenstand der Scrubbing-Pruefung: der PEM-Header ohne " +
       "Schluesselmaterial. Kam mit Welle 4b-2 (OP-152).",
   },
   ```

   Danach meldet `node scripts/audit-secrets.mjs` wieder 0 Funde und der in §3.3
   scharf gestellte Schritt ist grün. **Ohne diese Zeile bleibt
   `secret-scanning.yml` rot.**

2. **`packages/shared/src/lib/excel-to-bpmn.ts:54` (OP-114).**
   `await wb.xlsx.load(Buffer.from(buffer) as any)` durch den streamenden
   `WorkbookReader` ersetzen, wie in
   `apps/web/src/lib/import-export/file-parser.ts`, plus eine Zeilenobergrenze
   analog `MAX_IMPORT_ROWS`. Heute hängt dieser Pfad allein an der
   Selbstauskunft des ZIP-Zentralverzeichnisses.

3. **`packages/shared/src/lib/url-safety-server.ts` (OP-112).** Undici-Dispatcher
   mit IP-Pinning: die in `checkResolvedHostIsPublic` aufgelöste Adresse für
   genau diesen Aufruf festnageln, statt `fetch` erneut auflösen zu lassen. Das
   ändert das Verhalten **aller** ausgehenden Aufrufe und gehört in eine eigene
   Runde mit eigenem Testlauf — nicht als Nebenwirkung einer Doku-Welle.

4. **`scripts/` — Re-Seal-Skript für `WB_ENCRYPTION_KEY` (OP-128).** Analog
   `scripts/encrypt-connector-secrets.mjs` (idempotent, `--dry-run`). Ohne es
   ist Schlüsselrotation nur mit einem dauerhaft gesetzten
   `WB_ENCRYPTION_KEY_PREVIOUS` möglich — also mit einem zweiten gültigen
   Schlüssel, der nie abläuft.

5. **`apps/worker/src/lib/job-registry.ts` (OP-100).** Ein Abgleich zwischen
   Soll-Zeitplan und `job_run` beim Worker-Start: Jobs, deren letzter
   erfolgreicher Lauf länger zurückliegt als ihr Intervall, einmal nachholen.
   Die Ersatzabfrage steht in `docs/runbook.md` §8, aber sie findet nur Jobs,
   die schon einmal liefen.

Zwei Kommentarkorrekturen, klein, aber sie tragen die falsche Zahl weiter:

- `apps/worker/tests/no-fabricated-evidence.test.ts:11` — „a pattern repeated
  across **fourteen** code paths", darunter dreizehn aufgezählt. Es sind 19 in
  12 Dateien (§2.1).
- `apps/worker/src/crons/job-run-retention.ts:4` — „**129** jobs" gegen
  gemessene 132 Cron-Dateien.

---

## 6. Was offen bleibt, und in welcher Reihenfolge

Nach denselben drei Fragen wie der Umsetzungsplan.

**Zuerst — etwas ist gerade kaputt:**

1. **`scripts/audit-secrets.mjs`**, §5 Punkt 1. Eine Zeile, und die CI ist
   wieder grün. Alles andere wartet dahinter.

**Dann — es trifft einen Nutzer oder ein Deployment:**

2. **OP-114** (`excel-to-bpmn.ts`) — ein Aufrufer ohne zweite Schicht,
   authentifiziert erreichbar, gemessene Wirkung 2,26 GB RSS.
3. **OP-128** (Re-Seal-Skript) — solange es fehlt, ist Rotation keine Rotation.
4. **OP-112** (IP-Pinning) — eigene Runde, weil es jeden ausgehenden Aufruf
   berührt.
5. **OP-100** (Nachholmechanismus) — ein Job, dessen einzige tägliche Minute in
   ein Neustartfenster fiel, läuft heute gar nicht, und niemand erfährt es.

**Danach — es blockiert anderes oder ist eine Entscheidung:**

6. **OP-136** — fachliche Entscheidung: org-gebundenes Zielmodell für die 13
   System-Dashboards und 3 RCSA-Vorlagen, oder die Seeds entfallen. Heute liegt
   totes Gewicht im Seed und zwei Tabellen fehlen ganz.
7. **OP-151/OP-150** — Required Checks. Die Liste liegt vor (§3.8); der Umbau
   für die pfadgefilterten Workflows ist die eigentliche Arbeit.
8. **OP-145** — zehn (nicht acht) `dependabot/*`-Branches schließen. GitHub,
   Eigentümer.
9. **OP-102** (48 fachliche E-Mail-Vorlagen), **OP-101** (Redis-Rate-Limiting),
   **OP-055** (einheitliche Routenpfade), **OP-048** (Mandanten-Regel in
   `db:create-admin`), **OP-135** (vier Migrationen mit zweitem Pass) — alle
   unberührt, alle außerhalb der Dateihoheit dieser Welle.

**Nicht messbar in dieser Umgebung:** **OP-143** (Containerstand von
`grc_platform`) braucht Zugriff auf den laufenden Container. Hier läuft nur
`grc_v4c`, und die steht auf Branch-Stand: 428/428 Migrationen, 606 Tabellen
gegen die Baseline, Integritätsprüfung ohne Regression.

---

## 7. Abnahme

Alle gegen `2f716205` plus die Änderungen dieser Welle, am 2026-09-05:

```
$ npx prettier --check .
All matched files use Prettier code style!

$ node scripts/lint-ratchet.mjs
  [root] …: 283 Befunde (Baseline 283), 1230 Dateien.
  [apps/web] …: 0 Befunde (Baseline 0), 2287 Dateien.
✓ Keine Lint-Regression.

$ node scripts/check-gate-inputs.mjs
✓ 9 Tor-Eingaben sind vorhanden, verfolgt und nicht ignoriert;
  package-lock.json stimmt mit allen Workspace-Manifesten überein.

$ node scripts/audit-dead-exports.mjs --check
Dead-Exports-Ratsche: 2765 tote Exporte in 470 Dateien (Baseline 2765 in 470).
✓ Keine Regression bei toten Exporten; Report ist aktuell.

$ DATABASE_URL=… APP_DATABASE_URL=… node scripts/verify-db-integrity.mjs
  tables 606/606 · rlsPolicies 2639/2639 · rlsForcedTables 558/558
  auditTriggers 291/291 · securityDefinerFns 54/54
✓ Keine Regression gegenüber der gemessenen Baseline.

$ node scripts/check-env-example.mjs
.env.example: 121 Variablen deklariert, 99 im Quellcode gelesen.
✓ Alle gelesenen Variablen dokumentiert, alle Pflichtvariablen
  unauskommentiert, kein Platzhalter, der wie ein Wert aussieht.

$ cd apps/worker && npx vitest run
 Test Files  136 passed | 1 skipped (137)
      Tests  418 passed | 6 skipped (424)

$ cd packages/db && npx vitest run --config vitest.config.ts
 Test Files  10 passed (10)
      Tests  126 passed (126)

$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/secret-scanning.yml'))"
YAML OK
```

Der geänderte Workflow ist YAML-gültig. Er ist bewusst **nicht** grün: er meldet
die zwei CRITICAL-Treffer aus §3.3, bis die Zeile aus §5 Punkt 1 in
`scripts/audit-secrets.mjs` steht. Ein Tor, das nicht auslösen kann, ist
schädlicher als eines, das etwas Bekanntes meldet — dieses hier hat zwei Wellen
lang eine Regression aus dem eigenen Audit verdeckt.

Nicht committet, nicht gepusht.
