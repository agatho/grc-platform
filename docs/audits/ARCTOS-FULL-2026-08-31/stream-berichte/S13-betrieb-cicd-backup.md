# S13 — Betrieb: CI/CD, Deployment, Backup, Monitoring, Logging

**Audit:** ARCTOS-FULL-2026-08-31 · Repo `/work/repo` @ `a8d1414f`
**Stream:** S13 · **Auditor:** Claude Opus 5
**Abgrenzung:** Secret-Scan der Historie, npm-Advisories, Lizenzen, Action-Pinning,
`pull_request_target`, Docker-Base-Image-CVEs und SBOM sind Gegenstand von S08 und
werden hier nicht wiederholt. Cron-Job-Fachlogik (Idempotenz, Nebenläufigkeit,
Worker-Auth) gehört S10; wo Betrieb und S10 sich berühren (S13-14), ist das vermerkt.

---

## 1. Zusammenfassung

Die Betriebsschicht von ARCTOS ist an drei Stellen strukturell defekt:

**(1) CI validiert nicht das Artefakt, das ausgeliefert wird.** Alle drei
DB-Jobs in `ci.yml` fahren die 354 Migrationen mit `|| true` und reparieren das
Ergebnis anschließend mit `packages/db/src/create-missing-tables.ts` — einem
Skript, das fehlende Tabellen direkt aus dem Drizzle-Schema erzeugt, laut eigener
Dokumentation "Foreign keys and complex defaults are omitted". Das erklärt
BASE-002 vollständig: CI ist grün, weil das Schema in CI _nicht das Produkt der
Migrationen_ ist. Die Produktion (`scripts/docker-entrypoint.sh`) kennt
`create-missing-tables.ts` nicht und startet stattdessen mit den ~43 fehlenden
Tabellen — der Entrypoint zählt die Fehler und fährt trotzdem hoch. Die
Schema-Assertions der CI (`≥10` Tabellen bei 576 erwarteten, `≥6` RLS-Policies,
`≥4` Audit-Trigger) liegen bei ~2 % der Realität und können den Defekt nicht
sehen.

**(2) Der Deploy hat kein Netz und keinen Rückweg.** `deploy/update-all.sh`
fährt alle Migrationen gegen alle Produktiv-DBs mit `>/dev/null 2>&1 || true`,
ohne vorheriges Backup, ohne Abbruchbedingung, ohne Health-Gate (der abschließende
`curl` gibt den Statuscode aus, wertet ihn aber nie aus). Ein Rollback-Pfad
existiert nur auf dem Papier: die drei dokumentierten Rollback-Kommandos in
`dr-playbook.md` und `RELEASE_RUNBOOK.md` referenzieren eine Env-Variable
(`ARCTOS_IMAGE_TAG`), eine Datei (`db-<timestamp>.sql`) und eine Compose-Datei
(`docker-compose.yml`), die es in dieser Form nicht gibt. Der Image-Rollback
scheitert dabei _still_ — er läuft durch und startet erneut `:latest`.

**(3) Backup, Restore und Monitoring halten die Zusagen des Produkts nicht.**
Gesichert wird ausschließlich PostgreSQL. Der DMS-Objektspeicher (Garage/MinIO-
Volumes, `uploads`-Volume) — also die signierten Dokumente, deren Integrität das
Produkt als eIDAS-Merkmal verkauft — ist in keinem Backup-Pfad und in keiner
Zeile des DR-Playbook-Inventars enthalten. Die Off-Site-Kopie nach Backblaze B2
wird entgegen ADR-015 §1 **unverschlüsselt** hochgeladen. Der Restore-Drill
prüft genau eine, zufällig ausgewählte Datenbank, ist seit dem 2026-05-01
überfällig, und meldet sein Ergebnis entgegen dem eigenen Kopfkommentar _nicht_
ins BCMS. Monitoring existiert nicht: ADR-017 ist seit 4,5 Monaten "Proposed",
und im gesamten Repository gibt es null Referenzen auf Healthchecks.io,
Prometheus, Loki, Alertmanager oder Sentry. Es gibt daher auch keinen einzigen
Alarm auf ein sicherheitsrelevantes Ereignis — nicht auf fehlgeschlagene Logins,
nicht auf Massenexporte, nicht auf einen Bruch der Audit-Hash-Kette.

**Gesamturteil:** Das System ist in seinem dokumentierten Ist-Zustand nicht
reproduzierbar deploybar (BASE-002 bestätigt und ursächlich erklärt), nicht
nachweisbar wiederherstellbar und nicht überwacht. Für ein GRC-Produkt, das
Mandanten Verfügbarkeits- und Integritätszusagen macht, sind das drei
eigenständige, gravierende Befunde.

**Severity-Verteilung:** 9 High · 13 Medium · 6 Low · 2 Info (30 Findings).

---

## 2. Methodik-Protokoll

Die sieben Punkte aus Abschnitt 5/S13 des Audit-Plans, abgearbeitet:

| #   | Methodik-Punkt         | Vorgehen                                                                                                                                                                                                                                                                                 | Ergebnis                                                         |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | CI-Vollständigkeit     | Alle 10 Workflows Zeile für Zeile gelesen; `turbo`-Tasks gegen die 12 Workspace-`package.json` abgeglichen; `grep -rnE "\|\| true\|continue-on-error"` über `.github/workflows/`                                                                                                         | Deckungsmatrix Abschnitt 3; S13-01, -02, -17, -18, -25, -26, -30 |
| 2   | BASE-002 belegen       | `ci.yml` Zeilen 143-154 / 266-277 / 419-433 gegen `create-missing-tables.ts` und `docker-entrypoint.sh` gestellt                                                                                                                                                                         | **Belegt** — S13-01 (Ursache), S13-03 (Prod-Folge)               |
| 3   | Deployment             | `deploy/update-all.sh`, `docker-compose.production.yml`, `deploy/docker-compose.yml`, `scripts/docker-entrypoint.sh`, `RELEASE_RUNBOOK.md`, `dr-playbook.md` gelesen; Rollback-Kommandos gegen die tatsächlichen Variablen-/Dateinamen geprüft                                           | S13-04, -05, -09, -19, -20, -21, -22                             |
| 4   | Backup/Restore         | `db-backup.sh`, `backup-cron-install.sh`, `offsite-sync.sh`, `offsite-sync-setup.sh`, `dr-restore-drill.sh` gelesen; Backup-Scope gegen die Volume-Liste der Produktions-Compose gehalten; ADR-015-Zusagen gegen Implementierung                                                         | S13-06, -07, -08, -23, -24                                       |
| 5   | Monitoring/Alerting    | `grep -rn "healthchecks.io\|alertmanager\|prometheus\|promtail\|loki\|sentry"` über `apps packages deploy scripts .github docker-compose.production.yml` → **0 Treffer**; Health-Endpunkte gelesen; Worker-„Alerts" klassifiziert                                                        | S13-11, -12, -13                                                 |
| 6   | Logging-Hygiene        | `apps/web/src/lib/logger.ts` + `apps/worker/src/lib/cron-instrument.ts` gelesen; `console.*`-Aufrufe gezählt (58 web / 164 worker vs. 13 Dateien mit Logger-Import); gezielte Suche nach `body`/`token`/`password`/`email` in Log-Aufrufen; Log-Driver-Konfiguration der Compose geprüft | S13-15, -16; **kein** Fund von Passwort-/Token-Leaks im Code     |
| 7   | Konfigurations-Härtung | `.env.example` (16 aktive Variablen) maschinell gegen die 60 in `apps/*/src` und `packages/*/src` tatsächlich gelesenen `process.env.*` diffed; Startup-Validierung in `packages/db/src/index.ts` geprüft                                                                                | S13-10, -28                                                      |

**Falsch-Positiv-Abgrenzung (durchgeführt, Findings verworfen oder herabgestuft):**

- _Verworfen:_ „`turbo test` läuft in CI im Watch-Mode" — Vitest schaltet
  `watch` bei gesetztem `CI` selbst ab. Bleibt als Low (S13-26) nur wegen des
  lokalen Verhaltens.
- _Verworfen:_ „`db-backup.sh --pre-deploy` (runbook.md:57) ist ein
  undefiniertes Flag" — der `--*`-Zweig in `db-backup.sh:39` fängt es ab und
  setzt `LABEL=pre-deploy`. Funktioniert.
- _Verworfen:_ „`pg_restore`-Fehler im DR-Drill werden von der Pipe maskiert" —
  `set -o pipefail` (Zeile 29) propagiert den Exit-Code korrekt.
- _Herabgestuft:_ Fehlende Log-Rotation (S13-16) von High auf Medium — Caddy
  rotiert seinen eigenen Log (`deploy/Caddyfile:46-49`), und `runbook.md:165`
  benennt Out-of-Disk als bekanntes Thema mit manueller Prozedur. Kompensierende
  Kontrolle vorhanden, aber manuell.
- _Kompensation geprüft und NICHT gefunden:_ für S13-10 (fehlende
  Startup-Validierung) wurde `packages/db/src/index.ts`, `apps/web/src/lib/db.ts`
  und der Entrypoint auf einen Produktions-Guard geprüft. Es existiert keiner —
  nur ein `console.error` bei fehlgeschlagenem Prewarm (`index.ts:213`), das den
  Start nicht blockiert.

---

## 3. CI-Deckungsmatrix

**Was CI wirklich tut** (`.github/workflows/ci.yml`, 810 Zeilen, 7 Jobs):

| Prüfung                     | Läuft?             | Wo                                      | Blockierend?    | Anmerkung                                                                                                                                                                             |
| --------------------------- | ------------------ | --------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                      | **teilweise**      | `ci.yml:48-50`                          | ✅              | Nur `apps/web`. **1 von 12 Workspaces** hat überhaupt ein `lint`-Skript; `turbo lint` wird in CI gar nicht aufgerufen                                                                 |
| Prettier                    | ✅                 | `ci.yml:52-53`                          | ✅              | repo-weit                                                                                                                                                                             |
| Typecheck web               | ✅                 | `ci.yml:55-58`                          | ✅              |                                                                                                                                                                                       |
| Typecheck worker            | ✅                 | `ci.yml:60-61`                          | ✅              |                                                                                                                                                                                       |
| Typecheck `packages/*`      | ❌                 | —                                       | —               | Keine eigenen `tsconfig`-Läufe; nur indirekt über web/worker-Imports                                                                                                                  |
| Unit-Tests                  | **teilweise**      | `ci.yml:81-82` (`npx turbo test`)       | ✅              | `packages/ai` und `packages/ui` haben **kein** `test`-Skript → aus `turbo test` ausgeschlossen. `@grc/db`, `@grc/reporting`, `@grc/worker`, `@grc/web` laufen mit `--passWithNoTests` |
| Coverage-Schwelle           | ❌                 | `coverage.yml:50-51`                    | ❌              | `continue-on-error: true`; kein Threshold-Gate, nur Report + PR-Kommentar                                                                                                             |
| Integration-Tests           | ✅                 | `ci.yml:179-183`                        | ✅              | `packages/db`                                                                                                                                                                         |
| RLS-Tests (db)              | ✅                 | `ci.yml:185-194`                        | ✅              | gegen `grc_app`                                                                                                                                                                       |
| RLS-Tests (route-chain)     | ✅                 | `ci.yml:196-209`                        | ✅              | `apps/web`                                                                                                                                                                            |
| E2E                         | **1 von 20**       | `ci.yml:314-316`                        | ✅              | `npx playwright test e2e/ci-smoke.spec.ts` — die übrigen 19 Specs laufen in keinem Workflow                                                                                           |
| k6-Perf-Baseline            | ✅                 | `ci.yml:333-338`                        | ✅              |                                                                                                                                                                                       |
| **Migrationen von Null**    | ❌                 | `ci.yml:143-154, 266-277, 419-433`      | ❌              | `psql … \|\| true` + `create-missing-tables.ts` — siehe S13-01                                                                                                                        |
| Schema-Verifikation         | ✅ (wirkungslos)   | `ci.yml:442-454`                        | ✅              | Schwelle `≥10` Tabellen bei 576 erwarteten                                                                                                                                            |
| RLS-Policy-Zählung          | ✅ (wirkungslos)   | `ci.yml:456-465`                        | ✅              | Schwelle `≥6`                                                                                                                                                                         |
| Audit-Trigger-Zählung       | ✅ (wirkungslos)   | `ci.yml:467-477`                        | ✅              | Schwelle `≥4`                                                                                                                                                                         |
| Append-Only-Rules           | ✅ (wirkungslos)   | `ci.yml:479-503`                        | ✅              | Schwelle `≥5`                                                                                                                                                                         |
| Hash-Chain-Integrität       | ✅                 | `ci.yml:509-528`                        | ✅              | Sinnvoller Check                                                                                                                                                                      |
| RLS-Isolationskanarie       | ✅                 | `ci.yml:530-563`                        | ✅              | Gut gebaut (prüft beide Richtungen)                                                                                                                                                   |
| Docker-Build + Push         | ✅                 | `ci.yml:592-621`                        | ✅              | nur `push` auf `main`                                                                                                                                                                 |
| Worker-Image-Smoke          | ✅                 | `ci.yml:623-652`                        | ✅              |                                                                                                                                                                                       |
| Trivy Image-Scan            | ✅                 | `ci.yml:659-679`                        | ✅              | (S08)                                                                                                                                                                                 |
| Pilot-Readiness-Gate        | **self-skipping**  | `ci.yml:693-714`                        | ❌ faktisch     | `exit 0` ohne `STAGING_URL`; prüft ohnehin Staging, nicht den PR (S13-30)                                                                                                             |
| `npm audit`-Gate            | ✅                 | `ci.yml:736-739`                        | ✅              | (S08)                                                                                                                                                                                 |
| RLS-Request-Context-Ratchet | ✅                 | `ci.yml:741-746`                        | ✅              |                                                                                                                                                                                       |
| trufflehog / gitleaks       | ✅                 | `ci.yml:748-751`, `secret-scanning.yml` | ✅              | (S08)                                                                                                                                                                                 |
| `.env`-Datei-Check          | ✅                 | `ci.yml:753-766`                        | ✅              |                                                                                                                                                                                       |
| Lizenz-Check                | ✅                 | `ci.yml:768-771`                        | ✅              | (S08)                                                                                                                                                                                 |
| `grc_app`-Compose-Assertion | ✅ (unvollständig) | `ci.yml:785-809`                        | ✅              | Prüft **nur** `docker-compose.production.yml`, nicht `deploy/docker-compose.yml` (S13-09)                                                                                             |
| CodeQL                      | ✅                 | `codeql.yml`                            | ❌ laut ADR-016 |                                                                                                                                                                                       |
| i18n-Parity                 | ✅                 | `i18n-coverage.yml`                     | ✅              | **pfadgefiltert** auf `apps/web/messages/**`                                                                                                                                          |
| Schema-Drift/RLS-Coverage   | ✅                 | `schema-drift.yml`                      | ✅              | **pfadgefiltert** auf `packages/db/**`; Baseline 131 Tabellen ohne RLS akzeptiert                                                                                                     |
| Migration-Policy            | ✅                 | `migration-policy.yml`                  | ✅              | **pfadgefiltert**, nur PR                                                                                                                                                             |
| Lockfile-Check              | ✅                 | `lockfile-check.yml`                    | ✅              | **pfadgefiltert** auf `package*.json`                                                                                                                                                 |
| **Deployment**              | ❌                 | —                                       | —               | **Kein CD-Workflow existiert.** Deploy ist `git pull` auf dem Host (S13-19)                                                                                                           |

**Pfadfilter-Konsequenz:** Vier der zehn Workflows (`i18n-coverage`,
`schema-drift`, `migration-policy`, `lockfile-check`) laufen nur bei Änderungen
in ihren jeweiligen Pfaden. Ein PR, der z. B. `scripts/audit-rls-coverage.mjs`
unverändert lässt, aber über einen anderen Weg RLS-Coverage beeinflusst, wird
nicht geprüft. Das ist vertretbar, aber es bedeutet: der als „required" gedachte
Satz an Checks ist pro PR unterschiedlich groß, und ein leerer Check-Satz ist
nicht von einem grünen zu unterscheiden.

**`|| true` / `continue-on-error` — vollständige Liste:**

```
ci.yml:148   psql … -f "$f" 2>&1 || true      # custom SQL migrations, integration-tests job
ci.yml:271   psql … -f "$f" 2>&1 || true      # custom SQL migrations, e2e-smoke job
ci.yml:427   psql … -f "$f" 2>&1 || true      # custom SQL migrations, database job
ci.yml:368   kill … 2>/dev/null || true       # Cleanup, unkritisch
ci.yml:643f  docker logs / rm -f … || true    # Cleanup, unkritisch
ci.yml:760   git ls-files … || true           # leeres Ergebnis erlaubt, korrekt
ci.yml:790   grep -cE … || true               # leeres Ergebnis erlaubt, korrekt
ci.yml:804   awk … || true                    # leeres Ergebnis erlaubt, korrekt
coverage.yml:51  continue-on-error: true      # Testfehler blockieren Coverage-Job nicht
migration-policy.yml:37  git diff … || true   # leeres Ergebnis erlaubt, korrekt
```

Drei davon (148/271/427) sind die betriebskritischen: sie sind der Grund, warum
BASE-002 in CI unsichtbar bleibt.

---

## 4. Backup- und DR-Bewertung

| Kriterium                              | Ist-Zustand                                                                                                                                                                                                                                           | Bewertung       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Automatisierte DB-Sicherung            | Ja — `deploy/backup-cron-install.sh` installiert `/etc/cron.d/arctos-backup`, täglich 03:00 UTC                                                                                                                                                       | ✅              |
| Umfang: alle Tenant-DBs                | Ja — Regex `^grc_` über `pg_database` (`db-backup.sh:70`)                                                                                                                                                                                             | ✅              |
| Format                                 | `pg_dump --format=custom` + `--format=plain \| gzip` + SHA-256-Sidecar                                                                                                                                                                                | ✅              |
| **Objektspeicher (DMS-Dateien)**       | **Nein.** Kein Pfad sichert `uploads`, `branding`, `garagedata`, `garagemeta`, `miniodata`                                                                                                                                                            | ❌ **S13-06**   |
| Off-Site-Kopie                         | Ja — `offsite-sync.sh` nach Backblaze B2                                                                                                                                                                                                              | ⚠️              |
| **Off-Site verschlüsselt**             | **Nein.** `rclone copyto … --immutable` gegen ein `type = b2`-Remote ohne `crypt`-Wrapper. ADR-015 §1 behauptet GPG-symmetric                                                                                                                         | ❌ **S13-07**   |
| Off-Site-Cron installiert              | Nein — `backup-cron-install.sh` installiert nur DB-Backup + Rotation; der Off-Site-Cron muss manuell aus einem Doku-Snippet übernommen werden                                                                                                         | ⚠️ **S13-23**   |
| Off-Site-Reihenfolge                   | Doku sagt 02:30, Backup läuft 03:00 → Sync läuft **vor** dem Backup                                                                                                                                                                                   | ⚠️ **S13-23**   |
| Off-Site-Fehler → Exit-Code            | Nein — fehlgeschlagene Uploads werden nur in die Logdatei geschrieben, das Skript endet mit 0                                                                                                                                                         | ⚠️ **S13-23**   |
| Retention konsistent                   | Nein — `db-backup.sh:121` löscht > 30 Tage, `backup-rotate.sh` (KEEP_DAYS=14) > 14 Tage; `runbook.md:69` behauptet 30, `runbook.md:168` empfiehlt 14                                                                                                  | ⚠️ **S13-24**   |
| Backup-Verschlüsselung at rest (lokal) | Nein — Klartext-Dumps unter `/opt/arctos/backups/`, `chown arctos:arctos`                                                                                                                                                                             | ⚠️ Teil S13-07  |
| **Restore je getestet**                | **Nein.** `dr-playbook.md:130` terminiert den monatlichen Drill auf 2026-05-01; `dr-restore-drill.sh:26-27` bestätigt selbst „currently overdue". Heute ist 2026-08-31 → **4 Monate überfällig**, kein Nachweis eines je durchgeführten Laufs im Repo | ❌ **S13-08**   |
| Drill-Abdeckung                        | Genau **eine** DB — `ls -1t "$BACKUP_DIR"/*.dump \| head -n 1` (Zeile 42), also die zeitlich letzte Dump-Datei, unabhängig davon welche DB das ist. Verglichen wird sie dann gegen `SOURCE_DB=grc_platform` (Zeilen 77-83)                            | ❌ **S13-08**   |
| Drill: Objektspeicher                  | Nein                                                                                                                                                                                                                                                  | ❌ **S13-06**   |
| Drill: Ergebnis-Protokollierung        | Nein — Kopfkommentar Zeile 12-13 verspricht „Records the result via the BCMS bc_exercise endpoint", Zeile 179 gibt nur `log "Record this run in BCMS bc_exercise"` aus                                                                                | ❌ **S13-08**   |
| Drill: Kettenbruch-Toleranz            | Bis zu 10 Hash-Chain-Mismatches werden als „bekannt" durchgewinkt (Zeilen 160-168)                                                                                                                                                                    | ⚠️ **S13-08**   |
| Application-Restore geprüft            | Nein — der Drill prüft Tabellenzahl, 4 Sentinel-Spalten und ein 1000-Zeilen-Chain-Sample. Kein Start der App gegen die restaurierte DB, kein Login, kein Read                                                                                         | ⚠️ **S13-08**   |
| PITR / WAL-Archiv                      | Nein — nur nächtliche Dumps. RPO faktisch 24 h, wie in `dr-playbook.md:11-17` auch deklariert                                                                                                                                                         | Info **S13-29** |
| DR-Dokument aktuell                    | Teilweise — `dr-playbook.md:80` verweist auf `deploy/offsite-sync.sh --download latest`; dieses Flag existiert nicht                                                                                                                                  | ⚠️ **S13-05**   |

**Kernaussage:** Es gibt ein Backup. Es gibt keinen bewiesenen Restore, und das
Backup ist unvollständig — die Dokumente, deren Unveränderlichkeit das Produkt
als Kernmerkmal führt, sind nicht darin.

---

## 5. Findings

---

### S13-01 — CI baut das DB-Schema nicht aus den Migrationen; `create-missing-tables.ts` maskiert BASE-002

**Severity:** High
**Kategorie:** Nicht reproduzierbares Deployment (Rubrik High)
**Datei:** `.github/workflows/ci.yml:143-154`, `:266-277`, `:419-433`; `packages/db/src/create-missing-tables.ts:1-12`

Alle drei Jobs, die eine Datenbank aufbauen (`integration-tests`, `e2e-smoke`,
`database`), verwenden dasselbe Muster:

```yaml
- name: Run custom SQL migrations
  run: |
    for f in $(ls packages/db/drizzle/0*.sql | sort); do
      IDX=$(basename "$f" .sql | grep -oP '^\d+' | sed 's/^0*//')
      if [ "$IDX" -gt 24 ]; then
        PGPASSWORD=grc_test_password psql -h localhost -U grc -d grc_platform -f "$f" 2>&1 || true
      fi
    done

- name: Create missing schema tables
  working-directory: packages/db
  run: DATABASE_URL="…" npx tsx src/create-missing-tables.ts
```

_(`ci.yml:419-433`, identisch in `:143-154` und `:266-277`)_

`create-missing-tables.ts` beschreibt sich selbst:

```
 * This script introspects the Drizzle schema exports and compares them against
 * pg_tables. Any table defined in schema but not in the DB gets created with
 * basic column types. Foreign keys and complex defaults are omitted for simplicity —
 * the tables will be fully functional for Drizzle ORM reads/writes.
```

_(`packages/db/src/create-missing-tables.ts:6-9`)_

**Szenario (Eingabe → Wirkung):** Eine Migration `0303_ai_transparency.sql`
schlägt fehl, weil ein Vorgängerobjekt fehlt (BASE-002: 43 solcher Fälle).
`|| true` verschluckt den Fehler; der Job läuft weiter. `create-missing-tables.ts`
findet `ai_transparency_entry` im Drizzle-Schema, aber nicht in `pg_tables`, und
legt sie an — **ohne Foreign Keys, ohne CHECK-Constraints, ohne Defaults, ohne
`ENABLE ROW LEVEL SECURITY`, ohne Audit-Trigger**. Die nachfolgenden Tests
finden eine Tabelle vor und laufen grün. Die Produktion, deren
`docker-entrypoint.sh` dieses Skript **nicht** aufruft, hat die Tabelle nicht.

**Wirkung:** CI validiert ein Schema, das in keiner Umgebung real existiert.
Jede Aussage von „CI ist grün" über Datenintegrität, RLS-Deckung oder
Constraint-Wirksamkeit ist damit unbelegt. BASE-002 ist nicht ein Zufallsbefund,
sondern die logische Folge dieser Konstruktion — und war für die CI per Bauart
unsichtbar.

**Zusätzlich:** In den Jobs `integration-tests` (`ci.yml:156-165`) und
`e2e-smoke` (`ci.yml:279-284`) werden nach `create-missing-tables.ts` die
RLS-Gap-Closure-Migrationen `0286`/`0288` erneut eingespielt, um die fehlende RLS
nachzuziehen. Im Job `database` — genau dem Job, der `Verify RLS policies`
ausführt — **fehlt dieser Schritt**. Die dort erzeugten Tabellen haben also
garantiert keine RLS, und die Assertion prüft `≥6` Policies (siehe S13-02).

**Severity-Begründung:** High nach Rubrik („nicht reproduzierbares Deployment").
Kein Critical, weil kein unmittelbarer Datenzugriff daraus folgt — die Wirkung
ist der Verlust der Prüfaussage, nicht ein direkter Angriffspfad.

---

### S13-02 — DB-Integritäts-Gates der CI liegen bei ~2 % der erwarteten Werte

**Severity:** High
**Kategorie:** Fehlende negative Tests auf Sicherheitspfaden
**Datei:** `.github/workflows/ci.yml:442-503`

```yaml
          echo "Tables found: $TABLES"
          if [ "$TABLES" -lt 10 ]; then
            echo "::error::Expected at least 10 tables, found $TABLES"
```

_(`ci.yml:450-453`)_

```yaml
          echo "RLS policies: $POLICIES"
          if [ "$POLICIES" -lt 6 ]; then
```

_(`ci.yml:461-462`)_

```yaml
          echo "Audit triggers: $TRIGGERS"
          if [ "$TRIGGERS" -lt 4 ]; then
```

_(`ci.yml:473-474`)_

```yaml
          echo "Append-only rules: $RULES"
          if [ "$RULES" -lt 5 ]; then
```

_(`ci.yml:490-491`)_

**Gegenüberstellung** (im Repo nachgezählt, `/work/audit/evidence/S13/ci-gates.txt`):

| Assertion         | Schwelle | Erwartungswert                                                    | Schwelle in % |
| ----------------- | -------- | ----------------------------------------------------------------- | ------------- |
| Tabellen          | ≥ 10     | 576 `pgTable`                                                     | 1,7 %         |
| RLS-Policies      | ≥ 6      | 445 Tabellen mit RLS laut `schema-drift.yml`-Baseline (576 − 131) | 1,3 %         |
| Audit-Trigger     | ≥ 4      | dutzende laut `ADR-011`                                           | —             |
| Append-Only-Rules | ≥ 5      | 5 (Zeile 484-486 zählt sie namentlich auf)                        | 100 %         |

**Szenario:** Ein Commit bricht 500 der 576 Tabellen. `TABLES` = 76 ≥ 10 → grün.
Ein Commit entfernt RLS von 400 Tabellen. `POLICIES` = 45 ≥ 6 → grün. Die Gates
detektieren ausschließlich den Totalausfall der Datenbank, nicht Regressionen.

**Kompensation geprüft:** `schema-drift.yml:42-52` hat eine echte Ratchet-Logik
(`BASELINE=131`, darf nur sinken). Diese greift aber nur bei Änderungen unter
`packages/db/**` (Pfadfilter Zeile 12-15) und ist statisch — sie liest
`docs/security/rls-coverage-report.csv`, nicht die laufende DB. Die Lücke bleibt.

---

### S13-03 — Produktions-Entrypoint startet die App nach fehlgeschlagenen Migrationen; stderr wird verworfen

**Severity:** High
**Kategorie:** Nicht reproduzierbares Deployment / Integritätsrisiko
**Datei:** `scripts/docker-entrypoint.sh:37-59`

```sh
  # Files are sorted numerically by the leading digits so ALTER-on-
  # earlier-tables runs after the corresponding CREATE. stderr is
  # redirected to /dev/null because ~37 files fail with schema-drift
  # errors that are documented in packages/db/MIGRATIONS_KNOWN_ISSUES.md —
  # the app tolerates those tables being missing for now.
  MIGRATED_COUNT=0
  MIGRATED_FAILED=0
  if [ -d "/app/packages/db/drizzle" ]; then
    for f in $(ls /app/packages/db/drizzle/0*.sql 2>/dev/null | sort -V); do
      if PGPASSWORD="$DB_PASS" psql … -v ON_ERROR_STOP=0 -f "$f" >/dev/null 2>&1; then
        MIGRATED_COUNT=$((MIGRATED_COUNT + 1))
      else
        MIGRATED_FAILED=$((MIGRATED_FAILED + 1))
      fi
    done
  fi
  echo "Applied $MIGRATED_COUNT migration files ($MIGRATED_FAILED failed; see MIGRATIONS_KNOWN_ISSUES.md)."
```

**Drei Defekte in einem Block:**

1. **`ON_ERROR_STOP=0`** — innerhalb einer Migrationsdatei laufen die Statements
   nach einem Fehler weiter. Eine Migration mit 5 `ALTER TABLE` kann teilweise
   greifen. Das Ergebnis ist nicht „Migration angewendet oder nicht", sondern ein
   undefinierter Zwischenzustand pro Datei.
2. **`>/dev/null 2>&1`** — die Fehlermeldung selbst wird vernichtet. Der Operator
   erfährt eine Zahl (`37 failed`), aber nie _welche_ Datei mit _welchem_ Fehler.
   Post-Mortem-Analyse eines Deploy-Problems ist damit unmöglich, obwohl
   `runbook.md:78` genau das anweist („Wenn ‚relation does not exist' →
   Schema-Drift").
3. **Kein Abbruch** — nach der Schleife läuft `exec "$@"` (Zeile 98)
   unbedingt. Der Container meldet sich „gestartet", `/api/v1/health` liefert 200
   (S13-13), und die Routen, deren Tabellen fehlen, liefern 500 an Endnutzer.

**Szenario:** Deploy eines Release, in dem eine neue Migration `0355` fehlschlägt.
Entrypoint zählt `38 failed` statt `37`, startet, Health ist grün, Monitoring
existiert nicht (S13-11). Der Defekt wird erst durch einen Nutzerreport sichtbar.

**Weiterer Nebeneffekt:** Der Entrypoint läuft in **jedem** Web-Container. Bei
mehreren Tenant-Containern (`web`, `web-daimon`, …), die
`docker compose up -d --force-recreate` gleichzeitig startet, führen mehrere
Prozesse dieselbe DDL-Sequenz nebenläufig gegen dieselbe DB aus. Es gibt keinen
Advisory Lock. Deadlocks und Teil-Anwendungen sind möglich.

---

### S13-04 — `update-all.sh`: Produktiv-Migrationen ohne Backup, ohne Fehlerauswertung, ohne Health-Gate

**Severity:** High
**Kategorie:** Nicht reproduzierbares Deployment / Datenverlustpotenzial
**Datei:** `deploy/update-all.sh:126-147`, `:352-372`

```bash
# Main DB
echo "  DB: grc_platform (main)"
for f in $(ls /opt/arctos/packages/db/drizzle/0*.sql 2>/dev/null | sort); do
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U grc -d grc_platform -f "/dev/stdin" < "$f" >/dev/null 2>&1 || true
done
```

_(`update-all.sh:130-134`; identisch für jede Tenant-DB, Zeilen 143-145)_

Das Skript trägt `set -euo pipefail` (Zeile 15) — das `|| true` hebelt es für
genau den kritischen Teil aus.

**(a) Kein Pre-Deploy-Backup.** ADR-016 begründet den manuellen Deploy
ausdrücklich damit:

> „DB-Migrations können nicht einfach ‚rolled back' werden (data loss)"
> „Pre-Migration-Backup (ADR-014) muss manuell gestartet werden"
> _(`docs/ADR-016-cicd-pipeline.md:70-71`)_

`deploy/db-backup.sh` unterstützt genau dafür `--pre-migration` (Zeile 11, 38).
`update-all.sh` ruft es **nie** auf. Die Absicherung existiert als Skript und ist
im Deploy-Pfad nicht verdrahtet — sie hängt vollständig daran, dass der Operator
`runbook.md:57` gelesen hat und daran denkt.

**(b) Fehler werden nicht gezählt.** Anders als der Entrypoint (der wenigstens
`MIGRATED_FAILED` ausgibt) verwirft `update-all.sh` jeden Migrationsfehler
vollständig und schweigend.

**(c) Der Health-Check am Ende wertet nichts aus.**

```bash
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/login 2>/dev/null)
printf "  %-40s HTTP %s\n" "main (127.0.0.1:3000)" "$CODE"
```

_(`update-all.sh:358-359`)_

`$CODE` wird ausgegeben und nie verglichen. Ein Deploy, nach dem die Anwendung
HTTP 500 liefert, endet mit:

```
  main (127.0.0.1:3000)                    HTTP 500
=============================================
  Update abgeschlossen: <sha>
=============================================
```

und Exit-Code 0.

**(d) `provision-grc-app.sh`-Fehler sind folgenlos.** Zeile 276-278: schlägt die
Provisionierung der Nicht-Superuser-Rolle fehl, wird `WARNUNG:` gedruckt und die
Container werden trotzdem mit `APP_DATABASE_URL=grc_app:…` neu gestartet — die
App kann sich dann nicht verbinden. Fehlt `GRC_APP_PASSWORD`, wird die Rolle gar
nicht provisioniert (Zeile 262-263), ebenfalls nur mit Warnung.

**Szenario:** Deploy um 22:00, Migration `0355` bricht auf DB `grc_daimon` ab,
Zwischenzustand bleibt. Skript meldet Erfolg. Kein Backup von vorher existiert
außer dem Nacht-Dump von 03:00 → **bis zu 19 Stunden Datenverlust**, falls
zurückgerollt werden muss.

---

### S13-05 — Kein funktionierender Rollback-Pfad; alle drei dokumentierten Rollback-Kommandos sind falsch

**Severity:** High
**Kategorie:** Nicht reproduzierbares Deployment / Doku-Drift mit Fehlbedienungsrisiko
**Datei:** `docs/dr-playbook.md:43-44`, `docs/RELEASE_RUNBOOK.md:163-171`, `docker-compose.production.yml:173`, `deploy/update-all.sh:120-124`

**(a) Der Image-Rollback im DR-Playbook nutzt eine Variable, die niemand liest.**

```
4. Bei persistentem Fehler: rollback auf vorherige Image-Version via
   `ARCTOS_IMAGE_TAG=vX.Y.Z docker compose up -d`
```

_(`docs/dr-playbook.md:43-44`)_

Die Compose liest:

```yaml
image: ghcr.io/${GITHUB_REPOSITORY:-arctos}/grc-web:${IMAGE_TAG:-latest}
```

_(`docker-compose.production.yml:173`)_

Die Variable heißt `IMAGE_TAG`, nicht `ARCTOS_IMAGE_TAG`. Das dokumentierte
Kommando läuft ohne Fehlermeldung durch und startet erneut **`:latest`** — also
exakt das defekte Image. Das ist ein Rollback, der _still_ nichts tut, im
Incident-Fall die gefährlichste Klasse von Doku-Fehler.

**(b) Es gibt gar kein Vorgänger-Image auf dem Host.** `update-all.sh:120-124`
_baut_ die Images lokal (`docker compose build web worker`) statt getaggte Images
aus GHCR zu ziehen. Der Build überschreibt das Tag, auf das `image:` zeigt. Ein
SHA-getaggtes Vorgänger-Image existiert nur in GHCR (aus `ci.yml:598-600`) und
wird auf dem Host nie gepullt. Selbst mit korrekter Variable wäre der Rollback
also ein Netzwerk-Pull, dessen Existenz niemand geprüft hat.

**(c) Der DB-Rollback im Release-Runbook zeigt auf eine Datei, die nicht existiert.**

```bash
# 7.2 DB-Rollback nur wenn die Migration selbst das Problem war:
#     dann über das Backup aus Schritt 4.
docker compose down
psql -U grc -d grc_platform -f /opt/arctos/backups/db-<timestamp>.sql
```

_(`docs/RELEASE_RUNBOOK.md:168-171`)_

`db-backup.sh:89` erzeugt `${BACKUP_DIR}/${DB}-${TIMESTAMP}${SUFFIX}` — also
`grc_platform-20260831-030000.dump` und `…​.sql.gz`. Eine Datei
`db-<timestamp>.sql` gibt es nie: falsches Präfix, falsche Endung, und das
`.sql.gz` müsste erst dekomprimiert werden. Zusätzlich ist ein `psql -f` eines
Plain-Dumps **über eine bestehende DB** kein Rollback, sondern erzeugt hunderte
`duplicate key`-Fehler; korrekt wäre `DROP DATABASE` + `pg_restore`, wie
`db-backup.sh:13-24` es im eigenen Kopfkommentar richtig beschreibt.

**(d) Zeile 165 desselben Runbooks** editiert `docker-compose.yml` und ersetzt
einen `@sha256:`-Digest — die Produktions-Compose heißt
`docker-compose.production.yml` und enthält keinen Digest.

**(e) `dr-playbook.md:80`** ruft `deploy/offsite-sync.sh --download latest` auf.
`offsite-sync.sh` wertet **kein einziges Argument** aus (Zeilen 19-25). Der
Download-Pfad aus B2 im Host-Ausfall-Szenario ist nicht implementiert.

**(f) DB-Rollback grundsätzlich:** `ADR-023-migration-rollback.md` ist seit
2026-04-18 **„Proposed"**, es existiert kein einziges `down`-/Rollback-SQL im
Repo (`find . -name "*down*.sql"` → leer). ADR-023 benennt den Defekt selbst
korrekt: „**ON_ERROR_STOP=0 maskiert Fehler**", „Kein Rollback-Skript je
Migration", „Keine Atomizitaet zwischen Migrations" (Zeilen 20-27).

**Szenario:** Migration bricht die Produktion. Ops folgt dem Playbook. Das
Image-Rollback tut nichts, das DB-Rollback-Kommando bricht mit „No such file or
directory" ab. Die dokumentierte RTO von 15 min (`RELEASE_RUNBOOK.md:199`) ist
nicht haltbar.

---

### S13-06 — Backup deckt den DMS-Objektspeicher nicht ab (signierte Dokumente sind nicht gesichert)

**Severity:** High
**Kategorie:** Totalverlust von Daten (Rubrik Critical), abgestuft auf High
**Datei:** `deploy/db-backup.sh:59-116`, `deploy/offsite-sync.sh:42`, `docker-compose.production.yml:351-358`, `docs/dr-playbook.md:25-31`

Die Produktions-Compose deklariert sieben Volumes:

```yaml
volumes:
  pgdata:
  uploads:
  branding:
  miniodata: # wird nach der Garage-Migration entfernt
  garagemeta:
  garagedata:
  clamdb:
```

_(`docker-compose.production.yml:351-358`)_

`db-backup.sh` sichert ausschließlich `pg_dump` aller `^grc_`-Datenbanken
(Zeilen 67-70, 94-105) — also allein `pgdata`. `offsite-sync.sh` synchronisiert
ausschließlich Dateien aus `$BACKUP_DIR`:

```bash
for f in $(find "$BACKUP_DIR" -type f \( -name "*.dump" -o -name "*.sql.gz" -o -name "*.sha256" \) -mmin -$((MAX_AGE_HOURS*60))); do
```

_(`offsite-sync.sh:42`)_

Das Backup-Inventar des DR-Playbooks führt fünf Zeilen — PostgreSQL lokal,
PostgreSQL off-site, Docker-Images, Code, ENV-Files
(`docs/dr-playbook.md:25-31`). **Objektspeicher kommt nicht vor.** Der
Restore-Drill (`scripts/dr-restore-drill.sh`) prüft ihn ebenfalls nicht.

**Wirkung:** Bei `STORAGE_BACKEND=local` liegen die DMS-Dateien im
`uploads`-Volume (`UPLOAD_DIR: ${UPLOAD_DIR:-/app/uploads/documents}`,
`docker-compose.production.yml:238`); bei `s3` in `miniodata`/`garagedata`.
Beides ist unbackuped. In der DB stehen nach einem Host-Restore die
`document`-Zeilen mit ihren SHA-256-Hashes, Signaturketten und
Aufbewahrungsfristen — **die Dateien selbst sind weg**. Für ein Produkt, dessen
DMS-/e-Signatur-Modul Dokumentenintegrität nach eIDAS bewirbt, ist das ein
Totalverlust genau der Artefakte, um die es geht: die Hash-Kette bleibt intakt
und beweist nur noch, dass ein nicht mehr vorhandenes Dokument einmal existierte.

**Nebenbefund:** In diesem Zustand ist auch Art. 15 DSGVO (Auskunft über
gespeicherte Dokumente) nach einem DR-Fall nicht mehr erfüllbar. → S07.

**Severity-Begründung:** Nach Rubrik wäre „Totalverlust von Daten" Critical. Ich
stufe auf High ab, weil ein Verlust ein auslösendes Ereignis (Host-/Volume-
Ausfall) voraussetzt und nicht aus dem Normalbetrieb folgt. Im Quick-Deploy-Pfad
(S13-09) tritt der Verlust dagegen **im Normalbetrieb** ein — dort ist er als
eigenes Finding geführt.

---

### S13-07 — Off-Site-Backups werden unverschlüsselt zu Backblaze B2 übertragen, entgegen ADR-015

**Severity:** High
**Kategorie:** DSGVO-Verstoß mit Meldepflicht-Potenzial
**Datei:** `deploy/offsite-sync.sh:46`, `deploy/offsite-sync-setup.sh:34-42`, `docs/ADR-015-offsite-backup.md:41`

ADR-015 sagt zu:

> **1. Verschlüsselung**: rclone nutzt `--password-command` mit GPG-symmetric.
> Schlüssel liegt NIE im Image, nur als Root-lesbare Datei
> `/opt/arctos/.rclone.key` (mode 0400). Ein B2-Leak ohne diese Datei ist nutzlos.
> _(`docs/ADR-015-offsite-backup.md:41`)_

Das ADR-Diagramm beschriftet den Pfad ausdrücklich mit „encrypted"
(Zeile 28), und die Alternativen-Tabelle rechtfertigt B2 mit „Zusätzliche
Drittpartei (aber **verschlüsselte Dumps** → minimal)" (Zeile 18).

Die Implementierung:

```bash
  if rclone copyto "$f" "$B2_REMOTE/$BASENAME" --immutable --no-traverse 2>/dev/null; then
```

_(`deploy/offsite-sync.sh:46`)_

Kein `--password-command`, kein `crypt`-Remote, kein GPG. Das Setup-Skript legt
ein reines B2-Remote an:

```
[b2-arctos]
type = b2
account = $B2_ID
key = $B2_KEY
hard_delete = false
endpoint = https://s3.eu-central-003.backblazeb2.com
```

_(`deploy/offsite-sync-setup.sh:36-42`)_

`type = b2` ist ein Klartext-Backend. Ein `rclone`-Crypt-Remote wäre
`type = crypt` mit `remote = b2-arctos:bucket`. Es existiert nirgends im Repo.
`/opt/arctos/.rclone.key` wird von keinem Skript erzeugt oder gelesen
(`grep -rn "rclone.key"` → nur das ADR).

**Szenario:** Kompromittierung des B2-Application-Keys (er liegt in
`$HOME/.config/rclone/rclone.conf`, mode 600, auf demselben Host wie die
Anwendung — ein Foothold auf dem Host reicht) oder ein Vorfall bei Backblaze.
Der Angreifer erhält vollständige `pg_dump`-Kopien **aller Mandanten**: inklusive
`whistleblowing`-Tabellen (Identitäten hinweisgebender Personen, HinSchG § 8),
`dpms`-Vorfalldaten (Art.-9-DSGVO-Kategorien), Passwort-Hashes, verschlüsselter
Connector-Secrets. Der einzige Schutz, den das ADR dafür vorgesehen hatte, ist
nicht implementiert.

Das lokale Backup ist ebenfalls unverschlüsselt (`db-backup.sh:94-108`,
`chown arctos:arctos`, `backup-cron-install.sh:74`) — dort ist das mit
Dateisystemrechten wenigstens teilweise kompensiert; bei B2 gibt es keine
kompensierende Kontrolle.

---

### S13-08 — Der DR-Restore-Drill ist überfällig, prüft eine zufällige einzelne DB und protokolliert sein Ergebnis nicht

**Severity:** High
**Kategorie:** Nicht nachgewiesene Wiederherstellbarkeit in einem GRC-Produkt
**Datei:** `scripts/dr-restore-drill.sh:12-13,42,77-83,120-168,178-180`; `docs/dr-playbook.md:126-135`

**(a) Überfällig.** Der Übungsplan terminiert den monatlichen Drill:

| Test | Frequenz | Owner | Naechster Termin |
| Backup-Restore in Restore-DB | monatlich | Ops | **2026-05-01** |
_(`docs/dr-playbook.md:130`)_

Das Skript bestätigt den Verzug selbst:

```
# Mark this run as the "Backup-Restore Monthly" drill due 2026-05-01
# (currently overdue per docs/dr-playbook.md line 130).
```

_(`scripts/dr-restore-drill.sh:26-27`)_

Stichtag heute: 2026-08-31 → **4 Monate überfällig**, und auch der
quartalsweise B2-Download-Drill (2026-07-01) und der halbjährliche
Runbook-Durchspiel (Zeile 131-132) sind offen. Es existiert kein
Ausführungsnachweis im Repo, und kein Cron installiert den Drill
(`backup-cron-install.sh` installiert nur Backup + Rotation).

**(b) Es wird genau eine, nicht deterministisch gewählte DB geprüft.**

```bash
LATEST="$(ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | head -n 1 || true)"
```

_(Zeile 42)_

`db-backup.sh` legt pro Lauf einen Dump **je Tenant-DB** ab. `ls -1t | head -1`
liefert den zuletzt geschriebenen — also die alphabetisch letzte Tenant-DB, nicht
`grc_platform`. Der Drill vergleicht die restaurierte Tabellenzahl dann aber
gegen:

```bash
TABLES_LIVE=$(pg_exec psql -U "$PSQL_USER" -d "$SOURCE_DB" -tAc …)   # SOURCE_DB=grc_platform
…
if [ "$TABLES_RESTORED" -lt $(( TABLES_LIVE - 5 )) ]; then
```

_(Zeilen 33, 77-80)_

Ein kleinerer Tenant mit weniger Tabellen als `grc_platform` löst damit einen
falschen `schema drift`-Alarm aus; umgekehrt bestätigt ein erfolgreicher Drill
niemals die Wiederherstellbarkeit von `grc_platform`. Für die übrigen Tenants
existiert **kein** Restore-Nachweis.

**(c) Das Ergebnis wird nicht ins BCMS geschrieben.** Der Kopfkommentar
verspricht:

```
#   6. Records the result via the BCMS bc_exercise endpoint
#      (so monthly cadence is provable in the audit log)
```

_(Zeilen 12-13)_

Die Implementierung von Schritt 6 lautet vollständig:

```bash
log "DR drill SUCCESS — backup=$LATEST tables=$TABLES_RESTORED restore_s=${DURATION}s"
log "Record this run in BCMS bc_exercise (Drill: Backup-Restore Monthly)"
exit 0
```

_(Zeilen 178-180)_

Es wird nur _erinnert_, nicht protokolliert. `dr-playbook.md:135` behauptet
dagegen: „Uebungs-Ergebnisse werden in `bc_exercise`-Tabelle (BCMS-Modul)
erfasst." Damit fehlt genau der Audit-Nachweis, den ein GRC-Produkt in seinem
eigenen BCMS-Modul führen müsste — ISO 22301 Kap. 8.6 verlangt dokumentierte
Übungsergebnisse.

**(d) Der Drill toleriert einen Bruch der Audit-Hash-Kette.**

```bash
CHAIN_THRESHOLD="${CHAIN_THRESHOLD:-10}"
…
elif [ "$CHAIN_OK" -gt 0 ]; then
  log "  WARN: $CHAIN_OK historical mismatches (≤ threshold $CHAIN_THRESHOLD) — known migration 0327 rehash artifact"
```

_(Zeilen 160-167)_

Bis zu 10 Mismatches in einer 1000-Zeilen-Stichprobe werden als bekannt
durchgewinkt. Die Kommentare (Zeilen 149-159) dokumentieren 5 bekannte
Anomalien und einen „geplanten" Heal, den es nicht gibt. Ein Angreifer, der bis
zu 5 zusätzliche Einträge manipuliert, bleibt unterhalb der Schwelle. → S03.

**(e) Es wird kein Application-Restore geprüft.** Der Drill prüft Tabellenzahl,
vier Sentinel-Spalten und ein Chain-Sample. Er startet keine Anwendung gegen die
restaurierte DB, führt keinen Login und keinen Read durch. Die zentrale Frage
„läuft das Produkt nach einem Restore?" bleibt unbeantwortet.

**Severity-Begründung:** High. Ein Backup ohne getesteten Restore ist laut
Auftrag ein eigenes Finding; hier kommt hinzu, dass die vorhandene Teilprüfung
strukturell nicht das prüft, was sie zu prüfen vorgibt, und dass der fehlende
Nachweis selbst ein Compliance-Defekt des Produkts ist.

---

### S13-09 — Der dokumentierte „Quick Deploy" erzeugt eine Installation ohne RLS, ohne Worker, ohne persistente DMS-Ablage und ohne TLS

**Severity:** High
**Kategorie:** Privilegieneskalation / Datenverlust im Normalbetrieb
**Datei:** `deploy/docker-compose.yml:50-96`, `deploy/README.md:3-25,32,62-64`, `deploy/.env.sample:41-47`

`deploy/README.md` überschreibt den Abschnitt mit **„Quick Deploy (5 minutes)"**
und beschreibt den vollständigen Weg von `scp` bis Login. Der so entstehende
Stack hat vier eigenständige Defekte:

**(a) Kein `APP_DATABASE_URL` → die gesamte Anwendung läuft als Superuser.**

```yaml
  web:
    image: ghcr.io/agatho/grc-platform/grc-web:${IMAGE_TAG:-latest}
    …
    environment:
      # Required
      DATABASE_URL: postgresql://grc:${DB_PASSWORD}@postgres:5432/grc_platform
```

_(`deploy/docker-compose.yml:51-58` — vollständige `environment`-Liste, Zeilen 56-89, enthält kein `APP_DATABASE_URL`)_

`packages/db/src/index.ts:161-162`:

```ts
const RUNTIME_DATABASE_URL =
  process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL!;
```

`grc` ist SUPERUSER mit BYPASSRLS. Sämtliche RLS-Policies sind in dieser
Installation wirkungslos — das ist genau der Zustand, den Pentest-Finding F-01
adressiert hatte. `deploy/.env.sample` enthält weder `APP_DATABASE_URL` noch
`GRC_APP_PASSWORD`, es gibt also keinen Weg, das über den dokumentierten Pfad zu
korrigieren.

**Die CI-Assertion greift hier nicht:**

```bash
COMPOSE=docker-compose.production.yml
COUNT=$(grep -cE '^\s*APP_DATABASE_URL:\s*postgresql://grc_app:' "$COMPOSE" || true)
```

_(`ci.yml:788-790`)_ — sie prüft ausschließlich `docker-compose.production.yml`.
`deploy/docker-compose.yml` wird von keinem Check erfasst.

**(b) Kein `uploads`-Volume → DMS-Dateien gehen bei jedem Update verloren.** Der
`web`-Service in `deploy/docker-compose.yml` hat **keinen** `volumes:`-Block
(Zeilen 51-96), `STORAGE_BACKEND` ist nicht gesetzt → Default `local`
(`packages/shared/src/lib/file-storage.ts:264`). Die Dateien landen im
Container-Dateisystem. Der Update-Weg im selben README:

```bash
# Update to latest image
docker compose pull web
docker compose up -d web
```

_(`deploy/README.md:62-64`)_

`up -d` nach einem `pull` **ersetzt den Container** — die Schicht mit den
Uploads wird verworfen. Jeder Update-Zyklus löscht sämtliche hochgeladenen
DMS-Dokumente, Vertragsanhänge und Nachweise, während ihre DB-Zeilen und
Hash-Ketten bestehen bleiben. Das ist Datenverlust im dokumentierten
Normalbetrieb, nicht im Katastrophenfall.

**(c) Kein `worker`-Service.** `deploy/docker-compose.yml` definiert `postgres`,
`redis`, `web` — mehr nicht. Sämtliche 128 Cron-Handler (Retention/Löschung nach
Art. 17 DSGVO, `daily-audit-anchor` für die Tamper-Evidence-Verankerung,
`breach-72h-monitor`, `wb-deadline-monitor` für die HinSchG-Fristen) existieren
in dieser Installation nicht. `CRON_SECRET` wird gesetzt (Zeile 72), aber es gibt
nichts, was es benutzen könnte.

**(d) Klartext-HTTP.** `ports: - "${PORT:-3000}:3000"` (Zeile 54-55) bindet an
alle Interfaces — anders als die Produktions-Compose, die korrekt
`127.0.0.1:3000:3000` verwendet (`docker-compose.production.yml:190`). Das
README weist explizit an: `# http://your-server:3000` (Zeile 23). Kein Caddy,
kein TLS. Session-Cookies und Login-Credentials gehen im Klartext über das Netz.

**(e) Doku-Drift mit Fehlbedienungsrisiko:** `deploy/README.md:32` behauptet
„Database migrations run automatically (**70 migration files**)" — es sind 354.
Zeile 24 nennt den Login `admin@arctos.dev / admin123`; dieser Account entsteht
nur aus `seed_demo_00_platform.sql`, das der Entrypoint bei `NODE_ENV=production`
verweigert (`docker-entrypoint.sh:76-77`). Der Operator, der dem README folgt,
kann sich nicht einloggen — und wird plausibel `ALLOW_DEMO_SEED_IN_PROD=true`
setzen, um es zum Laufen zu bringen, womit ein Admin-Account mit öffentlich
bekanntem Passwort in der Produktion landet. `deploy/.env.sample:47` setzt
`RUN_SEEDS=true` bereits als Auslieferungs-Default.

---

### S13-10 — Keine Startup-Validierung der Pflicht-Konfiguration; stiller Superuser-Fallback

**Severity:** High
**Kategorie:** Fehlende Härtung mit konkretem Wirkpfad
**Datei:** `packages/db/src/index.ts:150-162, 209-215`; `docker-compose.production.yml:212, 217, 220`

```ts
const RUNTIME_DATABASE_URL =
  process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL!;
```

_(`packages/db/src/index.ts:161-162`)_

Der Kommentar darüber begründet den Fallback mit Dev/CI (Zeilen 153-155). Es gibt
**keinen** Produktions-Guard: kein `if (NODE_ENV === "production" && !APP_DATABASE_URL) throw`,
keine Warnung, kein Health-Signal. Die einzige produktionsspezifische Logik ist
ein Prewarm, dessen Fehler bewusst nicht blockiert:

```ts
if (process.env.NODE_ENV === "production" && RUNTIME_DATABASE_URL) {
  void client`SELECT 1`.catch((err) => {
    // Cold-start prewarm failed — log but don't block module import.
    console.error("[db] connection prewarm failed:", err?.message ?? err);
  });
}
```

_(Zeilen 209-215)_

**Szenario:** Ein Operator deployt über `deploy/docker-compose.yml` (S13-09),
über eine eigene Compose/k8s-Manifestierung oder per `docker run` mit nur
`DATABASE_URL`. Die App startet normal, `/api/v1/health` liefert 200, alle
Requests laufen als `grc` mit BYPASSRLS. Jeder Nutzer jeder Organisation sieht die
Daten jeder anderen Organisation. **Es gibt keinerlei Signal, dass das passiert
ist** — kein Log, kein Header, kein Health-Feld. Genau dieses Risiko ist in der
Produktions-Compose als Kommentar dokumentiert (Zeilen 205-211) und in
`ci.yml:773-784` mit einem Text-Grep abgesichert; abgesichert ist damit die
_Datei_, nicht die _Laufzeit_.

**Verwandte fehlende Validierungen:**

- `CONNECTOR_ENCRYPTION_KEY: ${CONNECTOR_ENCRYPTION_KEY}`
  (`docker-compose.production.yml:217`) — ohne `:?`, ohne Default. Fehlt die
  Variable, setzt Compose einen leeren String (mit Warnung auf stderr, die im
  `update-all.sh`-Aufruf durch `| tail -5` untergeht).
- `SECRET_ENCRYPTION_KEY: ${SECRET_ENCRYPTION_KEY:-}` (Zeile 220) — leerer
  Default. Kompensierend: `packages/shared/src/env-key.ts` /
  `secret-crypto.ts` verweigern zur Laufzeit (fail-hard), sodass die _Speicherung_
  von SSO-/OAuth-Secrets scheitert statt im Klartext zu landen. Die Anwendung
  startet aber und wirkt gesund; der Defekt zeigt sich erst, wenn ein Admin
  Monate später SSO konfigurieren will. **Nicht** so bei
  `APP_DATABASE_URL` — dort gibt es keine kompensierende Kontrolle.
- `APP_DATABASE_URL: postgresql://grc_app:${GRC_APP_PASSWORD:-}@…` (Zeile 212)
  — bei fehlendem `GRC_APP_PASSWORD` entsteht ein _gesetzter, aber ungültiger_
  URL (`grc_app:` mit leerem Passwort). Der Kommentar auf Zeile 210-211 behauptet
  „If GRC_APP_PASSWORD is unset the app falls back to DATABASE_URL in code" —
  das ist **falsch**: `??` prüft auf `undefined`/`null`, und die Variable ist
  gesetzt. Statt eines Fallbacks entsteht ein Verbindungsfehler. Der Kommentar
  beschreibt ein Verhalten, das der Code nicht hat.

**Empfohlene Gegenmaßnahme (für den Remediation-Plan):** ein
Startup-Validierungsmodul (Zod-Schema über `process.env`), das bei
`NODE_ENV=production` `APP_DATABASE_URL`, `AUTH_SECRET`, `WB_ENCRYPTION_KEY`,
`CONNECTOR_ENCRYPTION_KEY`, `SECRET_ENCRYPTION_KEY` und `CRON_SECRET` erzwingt
und den Prozess bei Verstoß mit Exit-Code ≠ 0 beendet, plus ein Feld
`runtimeRole` in `/api/v1/health`.

---

### S13-11 — Kein Monitoring und kein Alerting implementiert; ADR-017 seit 4,5 Monaten „Proposed"

**Severity:** High
**Kategorie:** Fehlende Härtung mit Ausfallpotenzial in einem GRC-Produkt
**Datei:** `docs/ADR-017-monitoring.md:6,12-18`; repo-weite Suche

Vollständige Suche über `apps/web/src`, `apps/worker/src`, `packages/*/src`,
`deploy`, `scripts`, `.github` und beide Compose-Dateien:

```
grep -rniE "healthchecks\.io|alertmanager|prometheus|promtail|\bloki\b|\bsentry\b|opentelemetry|statsd|datadog"
```

Ergebnis: **keine einzige Integration.** Die zwei sachlichen Treffer sind
Prosa-Kommentare, die einen Log-Empfänger als _Möglichkeit_ nennen:

```ts
// Use for server-side logging that should be pipeable to Loki/Datadog/ELK.
```

_(`apps/web/src/lib/logger.ts:3`)_

```ts
// standard means third-party log shippers (Loki, Datadog) pick it up
```

_(`apps/web/src/middleware.ts:12`)_

Konkret fehlt: kein Client/SDK in irgendeiner `package.json`, kein
Exporter-/Agent-/Sidecar-Service in einer Compose-Datei, kein Ping- oder
Heartbeat-Aufruf in `deploy/` oder `scripts/`, kein `schedule:`-Workflow, der
einen Health-Endpunkt abruft.
_(Evidenz: `/work/audit/evidence/S13/monitoring-grep.txt`)_

ADR-017 ist mit **Status: Proposed** vom 2026-04-18 datiert (Zeilen 6-7) und
beschreibt Phase 1 als „sofort, ohne Infra-Change":

> **Phase 1 (sofort, ohne Infra-Change)**: Healthchecks.io Free-Plan. Jeder
> Probe-Endpoint bekommt einen Check:
>
> - `/api/v1/health` alle 60s
> - `/api/v1/health/schema-drift` (mit Admin-Cookie) stündlich
> - `/api/v1/audit-log/integrity` (mit Admin-Cookie) täglich 03:00
>   _(`docs/ADR-017-monitoring.md:12-16`)_

Der Migrationspfad terminiert Phase 1 auf „**Woche 1**" (Zeile 54). Seit dem
2026-04-18 sind 4,5 Monate vergangen; nichts davon ist umgesetzt.

Auch der in ADR-017 Zeile 50 angekündigte Endpunkt `/api/v1/metrics` existiert
nicht (`find apps/web/src/app/api -type d -name metrics` → nur
`api/v1/esg/metrics`, ein Fachmodul).

`docs/runbook.md:122-133` führt einen Abschnitt „Monitoring", der ausschließlich
Endpunkte auflistet, die man _manuell abrufen kann_. Es gibt niemanden und nichts,
das sie abruft.

**Wirkung:** Die Plattform ist unbeobachtet. Ein Ausfall wird durch Nutzerreport
entdeckt. Die im DR-Playbook zugesagte RTO von 5 min für einen Container-Crash
(`dr-playbook.md:13`) beginnt definitionsgemäß bei „Incident Confirmed" — es gibt
keinen Mechanismus, der einen Incident bestätigt.

---

### S13-12 — Keine Alarme auf sicherheitsrelevante Ereignisse

**Severity:** High
**Kategorie:** Fehlende Detektion auf Sicherheitspfaden in einem GRC-Produkt
**Datei:** `apps/worker/src/index.ts` (Cron-Registry), `apps/worker/src/crons/*`

Als Folge von S13-11 gibt es kein Alerting-Backend. Zusätzlich existiert auch
_anwendungsseitig_ kein Detektions-/Benachrichtigungspfad für die vier im
Auditauftrag genannten Ereignisklassen:

| Ereignis                             | Erfassung                                               | Alarm                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fehlgeschlagene Logins / Brute-Force | `access_log` (DB)                                       | **kein Alarm.** `fail2ban` in `harden-server.sh` wertet den _Caddy_-Log aus, kennt aber keine Anwendungs-Semantik (welcher Nutzer, welche Org, Credential-Stuffing über viele Konten)            |
| Massenexport                         | `data_export_log` (DB, S07)                             | **kein Alarm**, keine Mengenschwelle, kein Vier-Augen-Prinzip                                                                                                                                    |
| Bruch der Audit-Hash-Kette           | `/api/v1/audit-log/integrity` (Admin-Endpunkt, manuell) | **kein Alarm.** ADR-017 hätte einen täglichen Check vorgesehen — nicht implementiert (S13-11). Der DR-Drill toleriert Brüche bis 10 (S13-08)                                                     |
| Cron-Job-Fehler                      | `console.error` + HTTP 500 an den Aufrufer              | **kein Alarm.** Es existiert kein Aufrufer (S13-14)                                                                                                                                              |
| Fehlgeschlagenes Backup              | `db-backup.sh` Exit 2; `.last-run`-Stempel              | **kein Alarm.** Der Stempel wird geschrieben (`backup-cron-install.sh:58`), aber nichts liest ihn. ADR-015:92 skizziert `arctos_offsite_backup_age_seconds` als „optional" — nicht implementiert |
| Fehlgeschlagener Off-Site-Upload     | JSON-Zeile in `/var/log/arctos-offsite.log`             | **kein Alarm**, kein Exit-Code (S13-23)                                                                                                                                                          |

Die 20+ Treffer für „alert" im Worker sind ausnahmslos **fachliche**
Benachrichtigungen des GRC-Modells (`kri-overdue-alert`, `kpi-threshold-alert`,
`eam-portfolio-health-check`, `replication-monitor`) — sie erzeugen Einträge im
Produkt für Endnutzer, nicht Betriebsalarme für Ops.

**Szenario:** Ein Angreifer mit gültigen Credentials exportiert über eine Woche
hinweg den gesamten Risiko- und Vorfallbestand eines Mandanten. Der Vorgang wird
in `data_export_log` protokolliert. Niemand liest die Tabelle, es gibt keine
Schwelle, keinen Alarm. Entdeckung erfolgt frühestens bei einer manuellen
Auswertung — in einem Produkt, das genau diese Kontrolle seinen Kunden verkauft.

---

### S13-13 — `/api/v1/health` meldet „healthy" bei unvollständigem Schema; keine Container-Healthchecks für `web`/`worker`

**Severity:** Medium
**Kategorie:** Fehlende Härtung mit Ausfallpotenzial
**Datei:** `apps/web/src/app/api/v1/health/route.ts:18-43`; `docker-compose.production.yml:171-283, 284-349`; `Dockerfile`, `Dockerfile.worker`

**(a) Der Health-Endpunkt prüft eine Sache.**

```ts
// Minimal round-trip -- select 1 is ~0.1ms when DB is healthy.
await db.execute(sql`SELECT 1`);
```

_(`apps/web/src/app/api/v1/health/route.ts:22`)_

Nicht geprüft: Redis (`REDIS_URL` ist konfiguriert und für Rate Limiting
relevant), Storage-Backend (S3/Garage — bei Ausfall schlagen alle DMS-Uploads
fehl), ClamAV, **Migrationsstatus/Schema-Drift**, und die eigene Laufzeitrolle.
Ein Container, der laut Entrypoint mit 37 fehlgeschlagenen Migrationen gestartet
ist (S13-03) und dessen Runtime versehentlich als Superuser läuft (S13-10),
meldet `{"status":"healthy"}` mit HTTP 200.

Der Drift-Check existiert (`/api/v1/health/schema-drift`), ist aber
**admin-authentifiziert** (`withAuth("admin")`, Zeile 18) und damit für
externe Uptime-Prober nicht nutzbar — ADR-017 löst das mit einem „Admin-Cookie"
im Monitor, was für einen Free-Tier-HTTP-Prober unrealistisch ist.

**(b) Keine Container-Healthchecks.** `docker-compose.production.yml` definiert
`healthcheck:` für `postgres` (Zeile 41), `redis` (54), `garage` (81),
`minio` (117) und `clamav` (162) — **nicht** für `web` und **nicht** für
`worker`. Weder `Dockerfile` noch `Dockerfile.worker` enthalten eine
`HEALTHCHECK`-Instruktion.

**Wirkung:** `restart: unless-stopped` reagiert nur auf einen _beendeten_
Prozess. Ein hängender Node-Prozess (Event-Loop blockiert, Pool erschöpft) wird
nie neu gestartet. Das widerspricht direkt der Zusage in `runbook.md:118`:

> | Einzelner Container crasht | 1 min | 0s | Docker-Restart-Policy (`unless-stopped`) greift automatisch |

Das gilt nur für einen sauberen Crash, nicht für den häufigeren Hang. Weil
zusätzlich kein externes Monitoring existiert (S13-11), gibt es überhaupt keinen
Mechanismus, der einen hängenden Container erkennt.

**(c)** `update-all.sh:303-309` prüft den Worker-Zustand — aber nur über
`docker compose ps` (Prozess läuft), und auch dort wird das Ergebnis nur
ausgegeben, nicht zum Abbruch genutzt.

---

### S13-14 — Kein Scheduler löst die Cron-Endpunkte aus; die „Cron-Engine" ist ein passiver HTTP-Listener

**Severity:** Medium
**Kategorie:** Betriebsdefekt mit Compliance-Wirkung (Überschneidung mit S10)
**Datei:** `apps/worker/src/index.ts` (Ende), `deploy/*`, `docker-compose.production.yml:284-349`

Es liegen **128 Cron-Dateien** unter `apps/worker/src/crons/` (der Kommentar in
`cron-instrument.ts:8` nennt veraltet 121). Der Worker registriert daraus
ausschließlich HTTP-Routen und startet einen Server:

```ts
for (const [name, handler] of Object.entries(batchCrons)) {
  app.post(`/crons/${name}`, async (c) => { … });
}
…
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[worker] Hono server listening on http://0.0.0.0:${info.port}`);
});
```

_(`apps/worker/src/index.ts`, letzte 40 Zeilen)_

Repo-weite Suche nach einem Auslöser:

- `grep -rniE "node-cron|croner|node-schedule|toad-scheduler|bullmq|agenda|setInterval"` in
  `apps/worker/src` → nur `setTimeout` als Request-Timeout in vier Cron-Dateien,
  kein Scheduler. `apps/worker/package.json` listet keine Scheduler-Abhängigkeit.
- `grep -rn "/crons/"` über `deploy/*.sh`, `scripts/*.sh`, `.github/workflows/**`
  → **0 Treffer** außerhalb des Worker-Quellcodes und der Tests.
- Kein `/etc/cron.d`-Eintrag in `setup-hetzner.sh`, `create-tenant.sh`,
  `update-all.sh` oder `backup-cron-install.sh` ruft einen `/crons/`-Endpunkt auf.
- Keine `schedule:`-Trigger in den Workflows außer CodeQL, Scorecard und
  Secret-Scanning.

**Wirkung:** In einer Installation, die exakt dem Repository entspricht, läuft
**kein einziger** der 128 Cron-Handler jemals. Betroffen sind unter anderem:
`daily-audit-anchor` (RFC-3161-Verankerung der Hash-Kette — die
Tamper-Evidence-Zusage des Produkts), `retention-monitoring` und die
Purge-/Erase-Jobs (Art. 17 DSGVO), `breach-72h-monitor` (Art. 33 DSGVO),
`wb-deadline-monitor` (HinSchG-Rückmeldefristen), sämtliche Fristen-Eskalationen.

`CRON_SECRET` wird an drei Stellen erzeugt und an vier Stellen in die Umgebung
gereicht — verwendet wird es nur von der Middleware (`apps/worker/src/index.ts:143-151`),
die eingehende Aufrufe prüft, die niemand macht.

**Abgrenzung:** S10 bewertet die Jobs selbst (Idempotenz, Nebenläufigkeit,
Auth). Hier ist der Befund rein betrieblich: der Deploy-Pfad installiert keinen
Auslöser, und keine Dokumentation (`runbook.md`, `deploy/README.md`,
`RELEASE_RUNBOOK.md`) weist den Operator an, einen einzurichten.

**Severity:** Medium statt High, weil ein Betreiber der Live-Installation
möglicherweise außerhalb des Repos einen Cron eingerichtet hat — der Audit-Scope
ist das Repository, und dort fehlt er vollständig, inklusive jeder Anleitung.

---

### S13-15 — ADR-017 begründet Log-Shipping mit einem Field-Scrubbing, das der Logger nicht hat

**Severity:** Medium
**Kategorie:** Fehlende Härtung / DSGVO-Risiko
**Datei:** `apps/web/src/lib/logger.ts:38-55`; `docs/ADR-017-monitoring.md:62`

ADR-017 macht das Scrubbing zur Voraussetzung dafür, Logs überhaupt an einen
externen Anbieter zu geben:

> Logs landen bei Grafana Cloud — **keine sensiblen Daten dürfen geloggt werden**
> (PII, secret tokens, Audit-Content). Structured-Logger
> (apps/web/src/lib/logger.ts) kümmert sich um Field-Scrubbing.
> _(`docs/ADR-017-monitoring.md:62`)_

Der vollständige Emit-Pfad des Loggers:

```ts
function emit(level: Level, message: string, fields: LogFields = {}) {
  if (LEVEL_RANK[level] < ACTIVE_LEVEL) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
    message,
    ...fields,
  };
  const line = JSON.stringify(entry);
```

_(`apps/web/src/lib/logger.ts:38-49`)_

`...fields` wird ungefiltert übernommen. Es gibt keine Deny-List, keine
Key-Maskierung, keine Tiefenbegrenzung, keine Größenbegrenzung. `LogFields` ist
`[k: string]: unknown` (Zeile 34) — jedes Objekt ist zulässig. Ein Aufruf
`log.error("save failed", { payload: body })` schreibt den kompletten
Request-Body als JSON auf stderr.

Dasselbe gilt für die Cron-Instrumentierung, die das Rückgabeobjekt jedes Jobs
protokolliert:

```
//   {"ts":"...","level":"info","service":"arctos-worker",
//    "cron":"foo-job","phase":"finish","durationMs":312,
//    "result":{"updated":7}}
```

_(`apps/worker/src/lib/cron-instrument.ts:30-32`)_ — ein Job wie
`daily-audit-anchor`, der `errors: string[]` zurückgibt
(`apps/worker/src/crons/daily-audit-anchor.ts:22-26`), schreibt diese
Fehlertexte samt eventuell enthaltener Bezeichner in den Log.

**Positivbefund (Falsch-Positiv-Abgrenzung):** Eine gezielte Suche nach
tatsächlichen Leaks im Code — `console.*` und `log.*` mit
`body`/`token`/`password`/`secret`/`email`/`JSON.stringify(body)` — ergab
außerhalb der Seed-Skripte (`packages/db/src/seed.ts:137,387`, protokollieren
Demo-E-Mails, nur Dev/CI) **keine** Fundstellen. Der Defekt ist also nicht ein
konkreter aktueller Leak, sondern eine fehlende Leitplanke plus eine falsche
Zusage im ADR, auf die eine Entscheidung (externes Log-Shipping) gestützt wurde.

**Nebenbefund:** Der Logger ist kaum in Gebrauch — 13 Dateien importieren ihn,
während 58 `console.*`-Aufrufe in `apps/web/src` und 164 in `apps/worker/src`
daran vorbeigehen. Diese unterliegen weder `ARCTOS_LOG_LEVEL` noch dem
NDJSON-Format; die in `runbook.md:126-131` beschriebene
Log-Korrelation über `X-Request-ID` funktioniert für sie nicht.

---

### S13-16 — Keine Log-Rotation und keine Log-Retention für die Container-Logs

**Severity:** Medium
**Kategorie:** Performance-/Verfügbarkeitsdefekt; fehlende Aufbewahrungsregel
**Datei:** `docker-compose.production.yml` (gesamt), `deploy/docker-compose.yml` (gesamt)

Keine der beiden Compose-Dateien enthält einen `logging:`-Block. Docker verwendet
damit den `json-file`-Treiber ohne `max-size`/`max-file` — die Logdateien wachsen
unbegrenzt bis die Partition voll ist. Betroffen sind alle Dienste, insbesondere
`web` (Next.js Request-Logs) und `worker`.

Verschärfend: Backups und Logs liegen auf derselben Partition. `runbook.md`
benennt das Problem bereits:

> ### Out-of-Disk
>
> `/opt/arctos/backups/` ist der größte Verursacher. Manuelles Clean-up:
>
> ```
> find /opt/arctos/backups -type f -mtime +14 -delete
> docker system prune -af --volumes
> ```
>
> _(`docs/runbook.md:163-169`)_

**Achtung:** `docker system prune -af --volumes` in einem Runbook, das ein
Operator unter Zeitdruck ausführt, löscht **alle nicht von einem laufenden
Container referenzierten Volumes**. Sind `web`/`worker` zu diesem Zeitpunkt
gestoppt (was bei einem Incident wahrscheinlich ist), trifft das `uploads`,
`branding`, `garagedata` und `miniodata` — also genau die Daten, für die kein
Backup existiert (S13-06). Das Runbook enthält damit ein Kommando, das im
Zusammenspiel mit S13-06 zum Totalverlust der DMS-Ablage führen kann.

**Log-Retention:** Es gibt keine dokumentierte Aufbewahrungsfrist für
Betriebslogs. Für ein Produkt, das seinen Kunden Aufbewahrungssteuerung
verkauft, und angesichts der Tatsache, dass Logs personenbeziehbare Daten
(`userId`, `orgId`, `X-Request-ID`) enthalten, ist das eine Lücke in der eigenen
Verarbeitungsdokumentation.

**Kompensation:** Caddy rotiert seinen eigenen Zugriffslog
(`roll_size 10mb`, `roll_keep 5`, `deploy/Caddyfile:46-49`). Das deckt nur den
Reverse-Proxy ab.

---

### S13-17 — Lint deckt 1 von 12 Workspaces ab; zwei Packages laufen in keiner Testsuite

**Severity:** Medium
**Kategorie:** Fehlende negative Tests / Wartbarkeit
**Datei:** `.github/workflows/ci.yml:48-50`; `turbo.json:11`; `packages/ai/package.json`, `packages/ui/package.json`

```yaml
- name: ESLint
  working-directory: apps/web
  run: npx eslint . --no-error-on-unmatched-pattern
```

_(`ci.yml:48-50`)_

CI ruft ESLint direkt in `apps/web` auf — nicht `turbo lint`. Und selbst
`turbo lint` würde nicht helfen: von 12 Workspaces (`apps/web`, `apps/worker`,
10 Packages) definiert **genau einer** ein `lint`-Skript (`apps/web`). Damit
sind `apps/worker` (132 Dateien) und alle 10 Packages — darunter
`packages/auth`, `packages/db`, `packages/shared` und `packages/ai` —
vollständig ungelintet. Der Baseline-Befund („Lint läuft nur in 1 von 12
Packages") ist bestätigt und liegt an zwei unabhängigen Ursachen.

**Zusätzlich fehlen Tests:**

| Workspace            | `test`                         | `test:coverage`     | Anmerkung                                              |
| -------------------- | ------------------------------ | ------------------- | ------------------------------------------------------ |
| `packages/ai`        | **fehlt**                      | **fehlt**           | Der AI-Layer (S05-Scope) läuft in **keiner** Testsuite |
| `packages/ui`        | **fehlt**                      | **fehlt**           |                                                        |
| `packages/reporting` | `vitest run --passWithNoTests` | **fehlt**           |                                                        |
| `packages/db`        | `--passWithNoTests`            | `--passWithNoTests` |                                                        |
| `apps/worker`        | `--passWithNoTests`            | `--passWithNoTests` |                                                        |
| `apps/web`           | `vitest` (ohne `run`)          | `--passWithNoTests` | siehe S13-26                                           |

`npx turbo test` (`ci.yml:82`) überspringt Workspaces ohne `test`-Task
stillschweigend. `--passWithNoTests` bedeutet zusätzlich: löscht jemand die
Testdateien eines Packages, bleibt CI grün.

---

### S13-18 — E2E-Gate umfasst eine von zwanzig Playwright-Specs

**Severity:** Medium
**Kategorie:** Fehlende negative Tests auf Sicherheitspfaden
**Datei:** `.github/workflows/ci.yml:314-316`; `apps/web/e2e/`

```yaml
- name: Run Playwright smoke
  working-directory: apps/web
  run: npx playwright test e2e/ci-smoke.spec.ts --reporter=list
```

_(`ci.yml:314-316`)_

Der Job heißt „E2E Smoke Tests" und wird in ADR-016 als Release-Gate geführt.
Er führt genau eine Spec-Datei aus. Im Repo liegen 20 `*.spec.ts` unter
`apps/web/e2e/` (der Audit-Plan zählt 67 Playwright-Specs insgesamt) — die
übrigen laufen in **keinem** Workflow. `apps/web/package.json` definiert
`test:e2e: playwright test`, das von keinem Workflow aufgerufen wird.

**Wirkung:** Der aufwendigste CI-Job (25 min Timeout, vollständiger Next-Build,
Seed, Browser-Installation) validiert ~5 % der vorhandenen E2E-Abdeckung. Die
restlichen 19 Specs sind ungeprüfter Code, der beliebig verrotten kann, ohne dass
es auffällt (klassischer Nährboden für die von S11 zu prüfenden `.only`/`.skip`-
Regressionen).

---

### S13-19 — Kein CD-Workflow; kein Nachweis, dass der deployte Commit CI grün durchlaufen hat

**Severity:** Medium
**Kategorie:** Change-Control-Defekt (ISO 27001 A.14.2.2)
**Datei:** `.github/workflows/` (10 Workflows, keiner deployt); `deploy/update-all.sh:26-36`

ADR-016 entscheidet bewusst gegen Auto-Deploy und begründet das mit
Change-Control (Zeile 42). Der gewählte manuelle Pfad implementiert die
Change-Control aber nicht:

```bash
OLD_COMMIT=$(git rev-parse HEAD)
git pull origin main
NEW_COMMIT=$(git rev-parse HEAD)
```

_(`deploy/update-all.sh:28-30`)_

Deployt wird der jeweilige Spitzenstand von `main` — ohne Tag, ohne Release, ohne
Abfrage des CI-Status dieses Commits, ohne Signaturprüfung. Es gibt keinen
technischen Zusammenhang zwischen „CI war grün" und „das läuft in Produktion".

ADR-016 räumt selbst ein:

> **4-Augen-Prinzip**: Jeder Merge braucht Approval + CI-Green. Ops kann aber
> `arctos-update` auch ohne Merge-Genehmigung fahren (z. B. für Hotfix-Branches
> per lokaler Commit-ID Checkout). Das ist akzeptiert, aber im Audit-Log sichtbar.
> _(`docs/ADR-016-cicd-pipeline.md:80`)_

„im Audit-Log sichtbar" ist unbelegt: das Deploy-Skript schreibt nichts in
`audit_log`, und mangels Monitoring (S13-11) auch nirgendwo sonst. Der einzige
Nachweis ist die Ausgabe auf dem Terminal des Operators.

**Positiv:** Der Build-SHA wird korrekt ins Image gebacken (`update-all.sh:116-124`,
`ci.yml:604-607`) und über `/api/v1/meta/build` ausgeliefert. Damit ist im
Nachhinein _feststellbar_, was läuft — nur eben nicht _steuerbar_, was laufen darf.

---

### S13-20 — Der Produktions-Update-Pfad spielt bei jedem Lauf Demo-Daten in die Haupt-Datenbank

**Severity:** Medium
**Kategorie:** Datenqualitäts-/Integritätsrisiko
**Datei:** `deploy/update-all.sh:230-250`

```bash
echo "  → seed_demo_13_programmes.sql (Main-DB only)"
DEMO_PROG=/opt/arctos/packages/db/sql/seed_demo_13_programmes.sql
if [ -f "$DEMO_PROG" ]; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U grc -d grc_platform -v ON_ERROR_STOP=0 -q -f /dev/stdin < "$DEMO_PROG" …
fi

echo "  → seed_demo_14_july_features.sql (Main-DB only)"
DEMO_JULY=/opt/arctos/packages/db/sql/seed_demo_14_july_features.sql
if [ -f "$DEMO_JULY" ]; then
  … psql -U grc -d grc_platform -v ON_ERROR_STOP=1 -q -f /dev/stdin < "$DEMO_JULY" …
fi
```

_(`deploy/update-all.sh:230-250`)_

Beide Seeds sind unbedingt — es gibt keine Abfrage von `SEED_DEMO_DATA`,
`NODE_ENV` oder `ALLOW_DEMO_SEED_IN_PROD`. Bei jedem Produktions-Update werden
Demo-Journeys („ISO 27001 Cert 2026", „DSGVO Roadmap", Kommentare Zeile 183-185)
und die Demo-Daten der „Meridian-Demo-Org" in die produktive Haupt-DB
`grc_platform` geschrieben.

Das umgeht bewusst die Schutzmaßnahme, die für denselben Zweck im Entrypoint
eingebaut wurde:

```sh
      # #SEC-F04: Demo/RBAC-test accounts ship with KNOWN passwords
      # … Refuse unless the operator explicitly opts in via ALLOW_DEMO_SEED_IN_PROD.
      if [ "$NODE_ENV" = "production" ] && [ "$ALLOW_DEMO_SEED_IN_PROD" != "true" ]; then
```

_(`scripts/docker-entrypoint.sh:71-77`)_

**Wirkung:** Die produktive Haupt-DB enthält dauerhaft Demo-Fachdaten, die in
Reports, Dashboards, KRI-Aggregaten und AI-Retrieval mitgezählt werden. In einem
Produkt, dessen Ausgaben als Compliance-Nachweis dienen, ist die Vermischung von
Demo- und Echtdaten ein Integritätsdefekt. `seed_demo_14` enthält laut Kommentar
(Zeilen 238-243) zudem Einträge, die in die **Hash-Kette** schreiben.

**Nicht bestätigt:** Ein Admin-Account mit bekanntem Passwort entsteht hier
nicht — `seed_demo_00_platform.sql` (das `admin@arctos.dev` anlegt) wird von
`update-all.sh` nicht ausgeführt.

---

### S13-21 — Migrationen laufen doppelt und in zwei unterschiedlichen Sortierungen

**Severity:** Medium
**Kategorie:** Nicht reproduzierbares Deployment
**Datei:** `deploy/update-all.sh:132`, `scripts/docker-entrypoint.sh:51`

Zwei Pfade führen dieselbe Migrationsmenge aus — mit unterschiedlicher
Reihenfolge:

```bash
for f in $(ls /opt/arctos/packages/db/drizzle/0*.sql 2>/dev/null | sort); do
```

_(`deploy/update-all.sh:132` — lexikografisch)_

```sh
    for f in $(ls /app/packages/db/drizzle/0*.sql 2>/dev/null | sort -V); do
```

_(`scripts/docker-entrypoint.sh:51` — Versionssortierung)_

Und die CI verwendet eine dritte Variante, die die ersten 25 Dateien überspringt
und stattdessen `drizzle-kit migrate` vorschaltet (`ci.yml:139-150`).

Bei rein numerischen, gleich langen Präfixen sind `sort` und `sort -V` identisch.
Der Audit-Plan nennt jedoch explizit Suffix-Migrationen `0349a`/`0349b`
(Abschnitt S09/2). Für gemischte Namen divergieren die beiden Sortierungen — und
generell gilt: **derselbe Satz Migrationen wird in Produktion in einer anderen
Reihenfolge angewendet als in CI.** Das macht das Ergebnis umgebungsabhängig
und ist die Wurzel derselben Klasse von Problemen wie BASE-002.

**Zusätzlich:** Nach `update-all.sh` Schritt 3 (alle Migrationen via `psql`)
startet Schritt 4 die Container neu, deren Entrypoint **alle 354 Migrationen
erneut** ausführt. Bei zwei Web-Containern plus zwei Worker-Containern und N
Tenants ergibt das pro Deploy ein Vielfaches an DDL-Läufen gegen die
Produktions-DB — verlängert das Deploy-Fenster (S13-22) und erhöht das Risiko
von Lock-Konflikten.

**Detailbefund `docker-entrypoint.sh:37-41`:** Der Kommentar behauptet, seit
Commit `3cb6cdc` gebe es „exactly one source of truth: packages/db/drizzle/".
`ADR-023:20-22` und `runbook.md:44` beschreiben dagegen weiterhin beide
Verzeichnisse (`drizzle/` **und** `src/migrations/`). Doku und Code sind hier
nicht synchron.

---

### S13-22 — Kein Zero-Downtime-Deploy; Downtime skaliert mit Migrationsanzahl × Tenants

**Severity:** Medium
**Kategorie:** Performance-Defekt mit Ausfallpotenzial
**Datei:** `deploy/update-all.sh:299, 329-350`; `docker-compose.production.yml:171-283`

```bash
docker compose -f "$COMPOSE_FILE" up -d --force-recreate web worker 2>&1 | tail -5
```

_(`update-all.sh:299`)_

`--force-recreate` stoppt den laufenden Container und startet einen neuen. Es gibt
keine zweite Replik, keinen Rolling Update, keine Health-gesteuerte Umschaltung
(auch nicht möglich — es gibt keinen Healthcheck, S13-13). Der neue Container
durchläuft zuerst den kompletten Entrypoint (354 Migrationen, S13-21), bevor
Next.js überhaupt startet.

Tenant-Container werden anschließend **sequenziell** in einer Schleife neu gebaut
und gestartet (`--force-recreate --build`, Zeile 338) — jeder mit eigenem
Docker-Build. Bei N Tenants summiert sich das linear.

**Reihenfolge Migration vs. App-Deploy:** Migrationen laufen vor dem Neustart
(Schritt 3) **und** beim Start jedes neuen Containers. Zwischen Schritt 3 und
Schritt 4 bedient der **alte** Anwendungscode das bereits migrierte Schema — das
ist das klassische Fenster für Fehler durch entfernte oder umbenannte Spalten. Es
gibt keine Expand/Contract-Disziplin und laut `ADR-023` keine Rückwärts-
kompatibilitätsanforderung an Migrationen.

`runbook.md:46` beziffert das Fenster mit „~3–5 min für Build + ~30s pro Tenant
für Restart" — das unterschlägt die Migrationslaufzeit im Entrypoint.

---

### S13-23 — Off-Site-Sync: nicht automatisch installiert, falsche Cron-Reihenfolge, Fehler ohne Exit-Code

**Severity:** Medium
**Kategorie:** Fehlende Härtung mit Datenverlustpotenzial
**Datei:** `deploy/offsite-sync.sh:13-14, 42-54, 56-57`; `deploy/backup-cron-install.sh:62-70`; `docs/ADR-015-offsite-backup.md:34-35, 62-65`

**(a) Nicht installiert.** `backup-cron-install.sh` schreibt genau eine
Cron-Zeile:

```
0 3 * * * root ${BACKUP_SCRIPT} >>${BACKUP_DIR}/cron.log 2>&1 && ${ROTATE_SCRIPT} >>${BACKUP_DIR}/cron.log 2>&1
```

_(`deploy/backup-cron-install.sh:69`)_

Der Off-Site-Sync ist nicht dabei. Er existiert nur als Copy-&-Paste-Vorschlag in
`offsite-sync-setup.sh:62-63`, `ADR-015:62-65` und `runbook.md:82`. Ob er auf
einem gegebenen Host läuft, ist nicht reproduzierbar feststellbar. Damit ist die
zweite Failure-Domain — die Kernmotivation von ADR-015 (Zeile 20) — nicht
verlässlich hergestellt.

**(b) Falsche Reihenfolge.** Das Skript selbst dokumentiert:

```
# Aufruf via cron (nach db-backup.sh):
#   30 2 * * * root /opt/arctos/deploy/offsite-sync.sh
```

_(`offsite-sync.sh:13-14`)_

ADR-015:34-35 nennt 02:00 / 03:00, `offsite-sync-setup.sh:62-63` und
`runbook.md:66,82` nennen 02:00 / 02:30 — `backup-cron-install.sh` installiert
das Backup aber auf **03:00**. In dieser Kombination läuft der Sync 30 Minuten
**vor** dem Backup. Der 48-Stunden-Fensterfilter (Zeile 25, 42) fängt das am
Folgetag auf, sodass das Off-Site-Backup dauerhaft einen Tag hinterherhinkt: der
tatsächliche Off-Site-RPO ist ~48 h, nicht die im DR-Playbook zugesagten 24 h
(`dr-playbook.md:14-17`).

**(c) Fehler beenden das Skript nicht mit Fehlercode.**

```bash
  else
    echo "{\"timestamp\":…,\"file\":\"$BASENAME\",\"error\":\"rclone copy failed\"}" >> "$LOG_FILE"
  fi
done
…
echo "{…\"summary\":{\"uploaded\":$UPLOAD_COUNT,…}}" >> "$LOG_FILE"
```

_(`offsite-sync.sh:51-57`)_

Schlagen alle Uploads fehl (abgelaufener Key, B2-Ausfall, volles Bucket), endet
das Skript mit **Exit 0** und `"uploaded":0`. Cron meldet Erfolg. Niemand liest
`/var/log/arctos-offsite.log` (S13-11/S13-12). Das Off-Site-Backup kann Monate
lang tot sein, ohne dass es auffällt.

**(d) Die von ADR-015 vorgesehene Alterungs-Metrik** (`arctos_offsite_backup_age_seconds`,
Zeile 92, „Alarm bei > 26h") ist nicht implementiert.

---

### S13-24 — Widersprüchliche Backup-Retention an drei Stellen

**Severity:** Low
**Kategorie:** Doku-Drift mit Fehlbedienungsrisiko
**Datei:** `deploy/db-backup.sh:118-127`; `deploy/backup-cron-install.sh:33-42`; `docs/runbook.md:69,168`; `docs/dr-playbook.md:27`

| Quelle                                                                         | Wert                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------- |
| `db-backup.sh:121-123` — eigene Rotation                                       | **30 Tage**                                    |
| `backup-cron-install.sh:37` — `KEEP_DAYS=14` im generierten `backup-rotate.sh` | **14 Tage**                                    |
| `runbook.md:69`                                                                | „Rotation: > 30 Tage löscht das Script selbst" |
| `runbook.md:168` (Out-of-Disk-Prozedur)                                        | `-mtime +14 -delete`                           |
| `dr-playbook.md:27` (Backup-Inventar)                                          | „30 Tage lokal"                                |

Der installierte Cron ruft beide Rotationen hintereinander auf
(`backup-cron-install.sh:69`), die schärfere (14 Tage) gewinnt. Der effektive
Wert ist also 14 Tage, während zwei Dokumente 30 zusagen. Zusätzlich greift eine
5-GB-Größenobergrenze (`backup-cron-install.sh:38, 44-55`), die bei wachsendem
Datenbestand die älteste Generation unbemerkt weiter verkürzen kann — es gibt
keine Meldung, wenn die Kappung greift.

**Wirkung:** Die im DR-Playbook beschriebene Eskalation „Wenn nicht:
Zwischen-Backup benutzen (24h zurueck, dann 48h, etc.)"
(`dr-playbook.md:61`) hat weniger Generationen zur Verfügung als dokumentiert.

---

### S13-25 — Coverage-Workflow ignoriert Testfehler und hat keine Schwelle

**Severity:** Low
**Kategorie:** Fehlendes Qualitätsgate
**Datei:** `.github/workflows/coverage.yml:49-51`

```yaml
- name: Run vitest with coverage in all packages
  run: npm run test:coverage
  continue-on-error: true # individual failures should not block aggregation
```

Der Workflow erzeugt einen Report und kommentiert ihn am PR, setzt aber keine
Mindestabdeckung durch und blockiert auch bei komplett fehlgeschlagenen Tests
nicht. In Kombination mit S13-17 (`--passWithNoTests` in fünf Workspaces,
`test:coverage` fehlt in `packages/ai`, `packages/ui`, `packages/reporting`) ist
die aggregierte Zahl aus `coverage-aggregate.ts` nicht als Qualitätsaussage
belastbar. → Details bei S11.

---

### S13-26 — `apps/web` definiert `test` ohne `run` (Watch-Mode außerhalb CI)

**Severity:** Low
**Kategorie:** Wartbarkeit / inkonsistente Konventionen
**Datei:** `apps/web/package.json` (`"test": "vitest"`)

Alle anderen Workspaces verwenden `vitest run`. `apps/web` verwendet `vitest`.

**Falsch-Positiv-Prüfung durchgeführt:** In CI ist `CI=true` gesetzt, Vitest
schaltet dann `watch` selbst ab — der CI-Job hängt **nicht**. Der Defekt wirkt
lokal: `npm test` im Repo-Root blockiert im Watch-Mode von `apps/web`, was für
Entwickler und für Pre-Commit-Hooks eine Falle ist. Bleibt daher Low, nicht
höher.

---

### S13-27 — CI-Perf-Baseline nutzt Klartext-Demo-Credentials; k6-Binary ohne Integritätsprüfung

**Severity:** Low
**Kategorie:** Härtung ohne konkreten Angriffspfad
**Datei:** `.github/workflows/ci.yml:322-338`

```yaml
- name: Install k6
  run: |
    K6_VERSION=v0.55.2
    curl -sSL "https://github.com/grafana/k6/releases/download/${K6_VERSION}/k6-${K6_VERSION}-linux-amd64.tar.gz" \
      | sudo tar -xz -C /usr/local/bin --strip-components=1 "k6-${K6_VERSION}-linux-amd64/k6"
    sudo chmod +x /usr/local/bin/k6
```

Die Version ist gepinnt (gut), aber es gibt keine Checksummen- oder
Signaturprüfung, und das Ergebnis wird mit `sudo` nach `/usr/local/bin`
entpackt. Ein kompromittierter Release-Artefakt führt zu Codeausführung im
Runner mit Root-Rechten.

```yaml
env:
  ARCTOS_EMAIL: admin@arctos.dev
  ARCTOS_PASSWORD: admin123
```

_(`ci.yml:336-337`)_

Die Demo-Credentials stehen im Klartext im Workflow. Für die Wegwerf-CI-Datenbank
ist das folgenlos; problematisch ist die Normalisierung: dasselbe Passwort ist der
im `deploy/README.md:24` dokumentierte Produktions-Login (S13-09), und
`pilot-readiness-gate.sh:32` verwendet `admin@arctos.dev` als Default für
**Staging**.

---

### S13-28 — `.env.example` deckt 49 tatsächlich gelesene Umgebungsvariablen nicht ab

**Severity:** Low
**Kategorie:** Doku-Drift mit Fehlbedienungsrisiko
**Datei:** `.env.example`; Evidenz `/work/audit/evidence/S13/env-diff.txt`

Maschineller Abgleich (16 aktive `VAR=`-Zeilen in `.env.example` gegen 60 in
`apps/*/src` und `packages/*/src` gelesene `process.env.*`):

**In `.env.example` überhaupt nicht vorhanden (49):**
`ANTHROPIC_API_KEY`, `APP_DATABASE_URL`, `APP_VERSION`, `ARCTOS_LOG_LEVEL`,
`ARCTOS_SERVICE`, `AZURE_AD_*` (3), `BAFIN_FEED_URL`, `BSI_FEED_URL`,
`BUILD_TIME`, `CLAMAV_*` (4), `CLAUDE_CLI_*` (2), `EMBEDDING_MODEL`,
`EMBEDDING_PROVIDER`, `EURLEX_FEED_URL`, `GIT_BRANCH`, `GIT_SHA`,
`GOOGLE_AI_API_KEY`, `LMSTUDIO_*` (4), `NEXTAUTH_URL`, `NEXT_PUBLIC_*` (3),
`NODE_ENV`, `NVD_API_KEY`, `OLLAMA_*` (2), `OPENAI_API_KEY`, `PORT`,
`PORTAL_BASE_URL`, `REDIS_URL`, `REPORT_OUTPUT_DIR`, `S3_*` (6),
`SIGNATURE_PROVIDER`, `STORAGE_BACKEND`, `UPLOAD_DIR`.

Etliche davon sind auskommentiert vorhanden (Zeilen 47-208) — das ist zulässig
für optionale Werte. **Nicht** zulässig ist es für `APP_DATABASE_URL`:

```
# APP_DATABASE_URL=postgresql://grc_app:grc_app_dev_password@localhost:5432/grc_platform
```

_(`.env.example:19`)_

Die sicherheitskritischste Variable des Systems — die einzige, die RLS
überhaupt aktiviert (S13-10) — ist im Auslieferungszustand auskommentiert. Wer
`.env.example` kopiert, bekommt eine Installation ohne RLS.

Weitere Auffälligkeiten:

- `.env.example:91`: `CRON_SECRET=arctos-cron-secret-change-in-production` — ein
  unkommentierter, konkreter Default-Wert. `scripts/setup.sh:49-58` ersetzt ihn
  zwar per `sed`, aber nur, wenn der dokumentierte Setup-Pfad benutzt wird.
- `docs/env-vars-reference.md` existiert als eigenständige Referenz — dass
  daneben `.env.example` steht, das die Hälfte nicht kennt, ist Drift innerhalb
  der eigenen Doku.

---

### S13-29 — Drei betriebskritische ADRs sind seit April 2026 im Status „Proposed"

**Severity:** Info
**Kategorie:** Kontext für S13-05, -07, -11
**Datei:** `docs/ADR-015-offsite-backup.md:6`, `docs/ADR-017-monitoring.md:6`, `docs/ADR-023-migration-rollback.md:3`

| ADR     | Thema                 | Status       | Datum      | Umsetzungsgrad                                                                                                       |
| ------- | --------------------- | ------------ | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| ADR-015 | Off-Site-Backup       | **Proposed** | 2026-04-18 | Skripte existieren, Verschlüsselung **nicht** (S13-07), Cron nicht installiert (S13-23)                              |
| ADR-017 | Monitoring & Alerting | **Proposed** | 2026-04-18 | **null** (S13-11)                                                                                                    |
| ADR-023 | Migration-Rollback    | **Proposed** | 2026-04-18 | **null** (S13-05f)                                                                                                   |
| ADR-016 | CI/CD                 | Accepted     | 2026-04-18 | teilweise; die Gate-Tabelle Zeilen 46-56 beschreibt Blockier-Verhalten, das so nicht besteht (S13-01, -02, -18, -30) |

Alle drei „Proposed"-ADRs sind seit 4,5 Monaten unverändert. In einer
GRC-Plattform, deren eigenes ISMS-Modul die Nachverfolgung offener Maßnahmen
verkauft, ist eine seit Monaten unbewegte, selbst dokumentierte Betriebslücke
ein Reputationsrisiko in Due-Diligence-Prüfungen. Die ADR-Statusfelder sind
zugleich die einzige belastbare Aussage darüber, was tatsächlich läuft — sie
sollten nicht durch Prosa an anderer Stelle (z. B. `runbook.md:122-133,
„Monitoring") überschrieben werden, die Fähigkeiten suggeriert, die es nicht
gibt.

---

### S13-30 — „Pilot Readiness Gate" ist kein Gate: skippt still und prüft ein fremdes Artefakt

**Severity:** Low
**Kategorie:** Fehlendes Qualitätsgate / Doku-Drift
**Datei:** `.github/workflows/ci.yml:681-714`; `scripts/pilot-readiness-gate.sh:18-29, 43-49`

Der Job ist im Kommentar als „Required for merge to main" beschrieben
(`ci.yml:687`). Das Skript beendet sich aber ohne `STAGING_URL` erfolgreich:

```bash
if [[ -z "${STAGING_URL:-}" ]]; then
  echo "::warning::STAGING_URL not set — pilot-readiness-gate skipped"
  echo "SKIPPED"
  exit 0
fi
```

_(`scripts/pilot-readiness-gate.sh:25-29`)_

Ein grüner Check ist damit nicht von einem übersprungenen zu unterscheiden. Ein
versehentlich gelöschtes oder rotiertes Repo-Secret deaktiviert das Gate
dauerhaft und unbemerkt.

Zweitens prüft der Job den falschen Gegenstand: er läuft gegen die **Staging-
Instanz**, deren Commit mit dem PR nichts zu tun haben muss. Der Abgleich, der
das feststellen könnte, ist ausdrücklich unverbindlich:

```bash
# D1 — Build-SHA-Diagnose (informational, never blocks).
```

_(`scripts/pilot-readiness-gate.sh:43`)_

Ein PR kann das Gate also grün passieren, weil auf Staging ein _anderer_,
funktionierender Stand deployt ist.

---

## 6. Anhang — Evidenzdateien

| Datei                                            | Inhalt                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `/work/audit/evidence/S13/ci-gates.txt`          | `\|\| true`/`continue-on-error`-Inventar der Workflows; CI-Schwellen gegen Ist-Zahlen |
| `/work/audit/evidence/S13/env-diff.txt`          | `.env.example` vs. tatsächlich gelesene `process.env.*`                               |
| `/work/audit/evidence/S13/monitoring-grep.txt`   | Repo-weite Suche nach Monitoring-/Alerting-Integrationen (0 Treffer)                  |
| `/work/audit/evidence/S13/ci-coverage-matrix.md` | CI-Deckungsmatrix als eigenständige Datei                                             |
| `/work/audit/evidence/S13/backup-scope.txt`      | Volume-Liste der Produktions-Compose gegen den Backup-Scope                           |
