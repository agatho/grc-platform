# ARCTOS — Remediation-Plan

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Grundlage:** `FINDINGS_REGISTER.md` (323 Findings) und die 14 Stream-Berichte unter `findings/`
**Auftrag:** Vollständige Behebung aller Findings inklusive Minor. Riskante Änderungen, Refactorings und neue Migrationen sind ausdrücklich zugelassen.
**Zielbranch:** `audit/full-2026-08-31` → PR gegen `main`

---

## 1. Grundsätze der Umsetzung

1. **Jedes Finding wird geschlossen oder begründet abgewiesen.** Ein Finding gilt als geschlossen, wenn (a) der Defekt behoben ist, (b) ein Test existiert, der den alten Zustand hätte auffallen lassen, und (c) der Fix im Verifikationslauf grün ist. Wird ein Finding nach erneuter Prüfung als Falsch-Positiv verworfen, wird das im Abschlussbericht mit Begründung dokumentiert — stillschweigendes Übergehen ist nicht zulässig.
2. **Keine Placebo-Fixes.** Eine Kontrolle, die die Doku behauptet und der Code nicht leistet, ist in diesem Audit mehrfach als eigenständiges Finding aufgetreten (S08-08, S13-11, S14-16, S14-22). Ein Fix, der nur einen Kommentar oder eine Doku-Zeile ändert, schließt ein technisches Finding nicht.
3. **Reihenfolge ist sicherheitsrelevant.** Zwei Abhängigkeiten sind verbindlich:
   - **WP3: S02-23 (SAML-Digest) vor S02-04 / S12-09 (Middleware-Allowlist).** Die Allowlist zu öffnen, bevor die SAML-Signaturprüfung korrekt ist, verwandelt einen unerreichbaren Endpunkt in einen erreichbaren Authentifizierungs-Bypass.
   - **WP1 vor allem anderen.** Solange die Migrationen nicht von Null durchlaufen, arbeitet jeder andere Fix gegen ein Schema, das produktiv nicht existiert (S09-02).
4. **Migrationen statt Handarbeit.** Schemaänderungen erfolgen ausschließlich als neue Migrationsdatei in `packages/db/drizzle/`, nie durch Ändern bereits ausgelieferter Migrationen — mit einer Ausnahme: die 43 defekten Migrationen aus S09-01, die noch nie erfolgreich gelaufen sind und daher nach `docs/ADR-014-migration-policy.md` als nicht ausgeliefert gelten. Diese Ausnahme wird in jeder betroffenen Datei im Kopfkommentar vermerkt.
5. **Nummernkreise sind reserviert** (höchste bestehende Migration: `0381`), damit parallel arbeitende Pakete nicht kollidieren:

   | Paket | Bereich   | Paket | Bereich   |
   | ----- | --------- | ----- | --------- |
   | WP1   | 0382–0389 | WP7   | 0420–0424 |
   | WP2   | 0390–0399 | WP8   | 0425–0434 |
   | WP4   | 0400–0409 | WP9   | 0435–0439 |
   | WP3   | 0410–0414 | WP10  | 0440–0444 |
   | WP6   | 0415–0419 | WP12  | 0445–0449 |

6. **Dateihoheit.** Jedes Paket besitzt die unten genannten Pfade exklusiv. Muss ein Paket eine fremde Datei ändern, wird die Änderung als Notiz an das besitzende Paket übergeben statt selbst vorgenommen — außer die Wellen laufen nacheinander.
7. **Testpflicht.** Für jedes Critical und High entsteht ein Test, der den Defekt vor dem Fix reproduziert. Für Medium mindestens ein Test pro Fixgruppe. Negative Sicherheitstests (Cross-Tenant verboten, Rolle fehlt → 403, manipulierter Audit-Eintrag → erkannt) sind Pflicht, weil sie laut S11-11 heute fehlen.

## 2. Wellen und Pakete

### Welle 0 — Sofortmaßnahme außerhalb des Codes

**S08-01 / BASE-001: Repository auf privat stellen.** Das ist keine Code-Änderung und muss vom Eigentümer im GitHub-Interface erfolgen. S08 hat belegt, dass in 10.270 Blobs über 70 Refs **kein gültiges Secret** liegt — eine Notfall-Rotation ist nicht erforderlich. Exponiert ist die vollständige Angriffskarte (`docs/security/lod-coverage.csv` mit 1.801 Route/Rolle-Paaren, `docs/openapi.yaml`, `deploy/`). Bis das Repo privat ist, sind alle folgenden Fixes öffentlich mitlesbar.

---

### Welle 1 — Fundament (sequenziell, blockiert alle anderen)

#### WP1 — Datenbank, Migrationen, Schema-Reproduzierbarkeit

**22 Findings** · 7 High, 8 Medium, 5 Low, 2 Info
`S09-01…S09-19`, `S13-01`, `S13-03`, `S13-21`

**Dateihoheit:** `packages/db/drizzle/**`, `packages/db/src/migrate-all.ts`, `packages/db/src/create-missing-tables.ts`, `packages/db/MIGRATIONS_KNOWN_ISSUES.md`, `scripts/docker-entrypoint.sh`, `.github/workflows/migration-policy.yml`, `.github/workflows/schema-drift.yml`, `apps/web/src/app/api/v1/health/schema-drift/route.ts`

**Reihenfolge innerhalb des Pakets** — sie ist nicht beliebig, weil der Runner-Fix die Fehlerlage verändert:

1. **S09-05 zuerst** (Runner-Fix, ~0,5 PT). `migrate-all.ts` entfernt führende `BEGIN;`/`COMMIT;` und zwingt jede Migration in eine Transaktion. Acht der 43 Fehlschläge sind reine Artefakte davon — `0318` dokumentiert die Zweiphasigkeit im Kopfkommentar ausdrücklich. Der Runner muss die Transaktionssteuerung der Datei respektieren. Danach neu messen: die verbleibenden Fehler sind die echten.
2. **S09-07** (11 Migrationen hängen an Seed-Daten): Seed-Reihenfolge im Entrypoint korrigieren oder die betroffenen Migrationen gegen leere Tabellen tolerant machen. Entscheidung je Migration nach `evidence/S09-migration-defects.md`.
3. **Die ~20 echten Dateidefekte** nach der Gruppierung in `evidence/S09-migration-defects.md` (12 Fixpakete). Darunter triviale Fälle wie ein fehlender Wert in einer INSERT-Liste (`0042:216`) und eine UUID mit dem Buchstaben `k` (`0103:16`), sowie das Muster `ALTER TYPE … ADD VALUE` mit Nutzung im selben Transaktionsblock, das in zwei Migrationen aufgeteilt werden muss.
4. **S09-04**: `0315_rls_gap_closure_v4.sql` bricht auf Tabelle 1 von 142 ab; 570 RLS-Policies entstehen nie. Nach dem Fix entsteht ein großer Teil der von WP2 gemeldeten RLS-Lücken gar nicht erst — WP2 misst deshalb **nach** WP1 neu.
5. **S09-02 / S09-03 / S13-01**: `create-missing-tables.ts` ersatzlos entfernen, sobald die Migrationen durchlaufen. CI baut das Schema danach aus den Migrationen. Das ist der Kern: drei Umgebungen erzeugten drei verschiedene Schemata (533 vs. 576 Tabellen, 65 Spalten Differenz allein bei `report_template`).
6. **S13-03**: Entrypoint bricht bei fehlgeschlagener Migration ab (`ON_ERROR_STOP=1`, Exit-Code auswerten, stderr erhalten) statt die App zu starten. **S13-21**: doppelter Lauf mit zwei Sortierungen beseitigen, einheitlich `sort -V`.
7. **S09-06**: Drizzle-Journal für die 329 journallosen Migrationen herstellen; `migration-policy.yml` prüft derzeit ein nicht mehr existierendes Verzeichnis.
8. **S09-09**: Schema-Drift-Endpunkt vergleicht nur Tabellennamen — auf Spalten, Typen, Constraints und Policies erweitern, sonst bleibt das ADR-014-Deploy-Gate wirkungslos.
9. **S09-08** (zwei `pgTable`-Definitionen pro DB-Tabelle mit disjunkten Spalten), **S09-10** (38 `ON DELETE CASCADE` auf audit-/nachweisrelevanten FKs → `RESTRICT`/`NO ACTION` plus bewusste Ausnahmen), **S09-13/-14** (385 FK ohne Index, 3 `org_id`-Tabellen ohne führenden Index), **S09-11** (N+1 im Audit-Pack), **S09-12** (ADR-023 unimplementiert), **S09-15/-16/-17** (Nummernkollisionen, widersprüchliche `CREATE TABLE IF NOT EXISTS` für `report_template`, CI-Schleifenfehler), **S09-18** (TimescaleDB ungenutzt: entweder Hypertables anlegen oder die Abhängigkeit entfernen — die Doku muss zum Ist passen), **S09-19** (`MIGRATIONS_KNOWN_ISSUES.md` in 7 Punkten sachlich falsch).

**Abnahme:** `migrate-all.ts` gegen eine leere Datenbank: 354 von 354 erfolgreich, ≥576 Tabellen, Exit-Code 0. Schema-Diff Drizzle ↔ DB leer. `create-missing-tables.ts` existiert nicht mehr und wird nirgends referenziert.

---

### Welle 2 — Zugriffskontrolle und Integrität (parallel, disjunkte Pfade)

#### WP2 — Mandantentrennung und RLS

**26 Findings** · 1 Critical, 7 High, 10 Medium, 7 Low, 1 Info · `S01-01…S01-26`
**Dateihoheit:** neue Migrationen 0390–0399, `packages/db/src/rls-audit.ts`, `packages/db/src/request-context.ts`, `packages/db/src/index.ts`, `packages/db/tests/rls/**`, `scripts/audit-rls-coverage.mjs`, `docs/security/rls-coverage-report.md`, `apps/web/src/app/api/v1/erm/bowtie/**`, `apps/web/src/app/api/v1/users/[id]/route.ts`, `deploy/provision-grc-app.sh`

Schwerpunkte: S01-01 (einziger end-to-end über HTTP ausnutzbarer Cross-Tenant-Pfad — `org_id` + RLS + Org-Prüfung), S01-02 (`app.bypass_rls` in 55 Policies, von der Runtime-Rolle selbst setzbar — Escape-Hatch entfernen oder an eine Rolle binden, die `grc_app` nicht annehmen kann), S01-03/-04/-06 (18 Kindtabellen, Auth-Kerntabellen und die drei Log-Tabellen ohne RLS), S01-08 (Views ohne `security_invoker`), S01-07 (`org_id IS NULL`-Policies), S01-10/-11/-12 (Superuser-Fallback ohne Startup-Assertion, Grants nur im Shell-Skript), S01-13 (`SECURITY DEFINER` ohne `search_path`, `EXECUTE` an `PUBLIC`), S01-15/-16/-24 (das Prüfwerkzeug ist blind für genau die Objektklassen, in denen die Lücken liegen — ohne diesen Fix kann die Remediation sich selbst nicht absichern), S01-14 (Coverage-Report behauptet RLS, die nicht existiert), S01-19/-20/-25 (deny-all-Tabelle, fehlendes `FORCE`, `::text`-Vergleiche), S01-17/-18/-21/-22/-23/-26.

**Abnahme:** RLS-Systemtest, der für **jede** Tabelle mit Mandantenbezug — inklusive Views, Kindtabellen ohne `org_id` und Log-Tabellen — Cross-Tenant-Lesen und -Schreiben als verboten nachweist.

#### WP3 — Authentifizierung, Autorisierung, SSO

**28 Findings** · 4 Critical, 7 High, 9 Medium, 6 Low, 2 Info · `S02-01…S02-24`, `S12-09`, `S12-14`, `S12-17`, `S12-18`
**Dateihoheit:** `packages/auth/**`, `apps/web/src/lib/api.ts`, `apps/web/src/lib/module-guard.ts`, `apps/web/src/middleware.ts`, `apps/web/src/auth.ts`, `apps/web/src/app/api/v1/users/**` (außer `[id]/route.ts`, das WP2 hält), `apps/web/src/app/api/v1/auth/**`, `.../admin/sso/**`, `.../scim/**`, `.../invitations/**`, `apps/web/src/lib/portal-auth.ts`, `packages/db/src/seed.ts`, `deploy/setup.sh`, Migrationen 0410–0414

**Verbindliche interne Reihenfolge:** S02-23 (SAML-Digest) und S02-24 (OIDC-ID-Token-Signatur) **vor** S02-04/S12-09 (Middleware-Allowlist). Danach S02-05 (RLS-Henne-Ei der Token-Endpunkte, abgestimmt mit WP2), dann der Rest.

Schwerpunkte: S02-01 (Default-Admin `admin123` — aus Seed und Setup entfernen, Erstpasswort erzwingen), S02-02/S12-14 (Custom-Role-Fallback — der zentrale Rollenprüfpunkt muss modul- und aktionsbewusst werden; Eskalationspfad bis `admin` ist reproduziert), S02-03 (Plattform-Admin-Konzept für die org-losen Konfigurationstabellen), S02-06 (`signerRole` client-bestimmt), S02-07 (Massenexport ohne Rolle/Limit/Vier-Augen), S02-08 (Org-Kontext als GUC auf Pool-Verbindung), S02-09 (Login ohne Rate-Limit und Lockout, `X-Forwarded-For`-Spoofing — abgestimmt mit WP9), S02-10/-11 (91 mutierende Endpunkte ohne Rollenargument, 368 ohne `requireModule`), S02-12 (keine Funktionstrennung im BPMN-Freigabezyklus), S02-14 (Rollenmodell dreifach inkonsistent: DB-Enum 9 / TS-Union 20 / Guards 17 — **eine** Quelle der Wahrheit herstellen; hängt mit S06-12, S07-22 zusammen), S02-15 (SCIM-Token ohne Ablauf), S02-16…S02-22.

**Abnahme:** Rollenmatrix-Test über alle mutierenden Routen; SAML- und OIDC-Negativtests mit manipulierter Assertion bzw. Signatur; Login-Lockout-Test.

#### WP4 — Audit-Trail und Tamper-Evidence

**20 Findings** · 2 Critical, 6 High, 10 Medium, 2 Low · `S03-01…S03-20`
**Dateihoheit:** Migrationen 0400–0409 (DB-Funktionen `compute_audit_hash_v3`, `audit_trigger`, `audit_log_tombstone_only_guard`, `whistleblowing_audit_trigger`), `apps/web/src/app/api/v1/audit-log/**`, `.../dpms/audit-log-tombstone/**`, `packages/shared/src/lib/freetsa.ts`, `packages/shared/src/lib/merkle-tree.ts`, `apps/worker/src/crons/daily-audit-anchor.ts`, `docs/ADR-011-rev3.md`, `docs/ADR-026-hash-chain-v3-migration.md`

Beginnen mit den beiden Einzeilern, die die größte Wirkung haben: **S03-02** (`hash_version` von der UPDATE-Allowlist des Guards nehmen — ein einziges erlaubtes UPDATE macht heute jede Fälschung unsichtbar, `entry_hash` und Merkle-Wurzel bleiben bit-identisch) und **S03-04** (fehlender `WHEN hash_version = 3`-Zweig der Ankerschranke). Danach S03-01 (Anker müssen außerhalb der Datenbank liegen oder signiert sein; ohne das bleibt die Kette Integritätsprüfung, keine Tamper-Evidence), S03-03 (Akteursfelder in den Hash aufnehmen), S03-05 (sechs Produktivpfade schreiben an der Kette vorbei), S03-06 (Tombstone bricht die Kette dauerhaft — Koordination mit WP8/S07-03), S03-07 (Offline-Verifikation nutzt die v1-Formel), S03-14 (Passwort-Hashes und Tokens im Klartext im Log — Koordination mit WP8/S07-05), S03-11 (FreeTSA-Antwort validieren: Nonce, messageImprint, Signatur, Zertifikatskette), S03-16 (`TRUNCATE` umgeht die Append-only-Rule), S03-09 (Race unter `repeatable read`), S03-12/-18 (keine automatische Kettenprüfung; der „security-critical" Test kann nicht fehlschlagen), S03-13/-15/-17/-19/-08/-10/-20.

**Abnahme:** Tamper-Test, der eine manipulierte Zeile einfügt und nachweist, dass `/integrity` und die Offline-Verifikation sie erkennen. FreeTSA-Validierungstest mit gefälschter TSA-Antwort.

#### WP5 — Input, Injection, SSRF, Upload

**11 Findings** · 1 Critical, 2 High, 3 Medium, 5 Low · `S04-01…S04-09`, `S10-16`, `S10-19`
**Dateihoheit:** `apps/worker/src/crons/continuous-audit-runner.ts`, `.../threat-feed-sync.ts`, `packages/shared/src/schemas/audit-advanced.ts`, `packages/auth/src/oidc/discovery.ts`, `apps/web/src/app/api/v1/admin/sso/metadata/**`, `apps/web/src/lib/import-export/**`, alle `**/export/route.ts`, `apps/web/src/app/api/v1/playground/**`

**S04-01/S10-01 ist das schwerste Finding des gesamten Audits** und wird zuerst behoben: `custom_sql` führt vom Worker (DB-Superuser, `BYPASSRLS`) beliebiges mehrsatziges SQL aus; die Keyword-Blocklist ist empirisch umgangen (Multi-Statement-DML, `COPY FROM PROGRAM`, `GRANT`, `SELECT INTO`). Der Schwester-Endpunkt `bi-reports/execute` ist korrekt gehärtet (`SET LOCAL ROLE grc_app` + `READ ONLY`) — dieses Muster wird übernommen. Falls die Freitext-SQL-Funktion fachlich nicht zwingend ist, ist die Entfernung der bessere Fix; die Entscheidung wird im Bericht begründet.

Danach S04-02/-03 (dieselbe SSRF-Klasse in zwei Pfaden, obwohl der `url-safety`-Helfer inkl. DNS-Rebind-Schutz im Repo existiert und bei Webhooks genutzt wird — konsistent anwenden), S04-05 (CSV-Formula-Injection an drei Exportstellen zentral neutralisieren), S04-04 (XLSX-Dekompressionsbombe: 9,3 MB → 2,26 GB RSS, gemessen), S04-06 (Magic-Byte-Prüfung, ClamAV fail-closed), S04-07/-08/-09, S10-16 (`changeStatus` schreibt in frei wählbare Tabelle), S10-19.

---

### Welle 3 — Fachmodule (parallel, disjunkte Pfade)

#### WP6 — AI-Layer

**23 Findings** · 4 High, 10 Medium, 7 Low, 2 Info · `S05-01…S05-23`
**Dateihoheit:** `packages/ai/**`, `apps/web/src/app/api/v1/ai/**`, `.../translations/ai-translate/**`, `.../copilot/**`, `.../eam/ai/**`, `apps/worker/src/crons/regulatory-relevance-scorer.ts`, `.../control-embedding-sync.ts`, `apps/web/src/app/legal/privacy/page.tsx`, Migrationen 0415–0419

Kern ist der Widerspruch zwischen der Zusage „Data Sovereignty, keine US-Cloud" und der Implementierung: S05-01 (stiller Cloud-Fallback), S05-02 (die eigene Datenschutzerklärung widerspricht sich in §4/§10 gegen §6), S05-03 (Provider global per Env; das vorhandene `data_residency`-Modell wird nie gelesen), S05-22 (Nutzer wählt Provider pro Request → freie Jurisdiktionswahl). Entweder die Implementierung erfüllt die Zusage — Provider pro Org steuerbar, `fail-closed` statt Cloud-Fallback — oder die Zusage wird korrigiert. **Der Plan sieht Ersteres vor**, weil es die Produktaussage ist.

Weiter: S05-04 (Datenverlust: JSONB in `varchar`, Originaltext verworfen), S05-06 (Injection-Härtung in 4 von 10 Buildern; Blocklist durch strukturelle Trennung ersetzen), S05-09 (18 von 23 Routen ohne Ausgabeschema; Cron persistiert unbeaufsichtigt Ersatzbewertung 50), S05-10 (kein Rate-Limit), S05-12 (AI-Act-Tabellen fehlen, keine Selbsteinordnung), S05-13 (API-Key base64 statt verschlüsselt), S05-05/-07/-08/-11/-14…-19/-23. S05-20/-21 sind Positivbefunde und werden nur als Regressionstest gesichert.

#### WP7 — DMS, Signaturen, Objektspeicher

**25 Findings** · 2 High, 12 Medium, 8 Low, 3 Info · `S06-01…S06-25`
**Dateihoheit:** `apps/web/src/app/api/v1/documents/**`, `.../policies/**`, `apps/web/src/lib/documents/**`, `packages/shared/src/lib/file-storage.ts`, `deploy/garage/**`, `docker-compose.production.yml` (Storage-Abschnitte), Migrationen 0420–0424

Leitmotiv: **jede Integritätszusage ist derzeit stärker als die Prüfung dahinter.** S06-01 (freigegebene Version per Upload in-place überschreibbar, Akteur `NULL` im Log), S06-06 (Wasserzeichen durch berechtigungsverschlüsselte PDF vollständig und unprotokolliert umgehbar, PoC liegt bei), S06-04 (Zertifikat bescheinigt Datei-Integrität aus einem Vergleich zweier DB-Spalten), S06-02 (ungeschlüsselter SHA-512 als „Digitale Signatur", bindet bei Datei-Policies an einen konstanten Leer-Hash), S06-03 (IP client-steuerbar und ungehasht), S06-05 (kein RFC-3161-Zeitstempel, obwohl FreeTSA im Produkt existiert), S06-09/-10/-11 (MinIO mit CRITICAL-CVEs bleibt konfiguriert; keine Mandantentrennung im Objektspeicher; Trust-Portal behauptet AES-256 at rest ohne SSE), S06-13/-14 (keine SoD in der Signaturzeremonie; PUT ändert published-Inhalt ohne Statuswechsel), S06-07/-08/-12/-15…-25.

#### WP8 — Datenschutz, DSGVO, HinSchG

**29 Findings** · 1 Critical, 10 High, 8 Medium, 7 Low, 3 Info · `S07-01…S07-29`
**Dateihoheit:** `packages/shared/src/wb-crypto.ts`, `apps/web/src/app/api/v1/portal/mailbox/**`, `.../dpms/**`, `.../export/**`, `apps/worker/src/crons/retention-*.ts`, `.../document-retention-purge.ts`, `.../copilot-rag-indexer.ts`, DB-Funktionen `redact_pii_jsonb`, `tombstone_audit_entry`, `whistleblowing_audit_trigger` (Migrationen 0425–0434, abgestimmt mit WP4), `docs/compliance/**`

**S07-01 zuerst** (Critical): ein zweiter generischer DB-Trigger hebt die gesamte HinSchG-Vertraulichkeitsarchitektur auf; der dabei geleakte Mailbox-Token erlaubt die Übernahme des unauthentifizierten Meldekanals. Dann die drei Schein-Pseudonymisierungen S07-02/-03/-08, die alle dasselbe Muster haben: ein Merkmal mit kleinem Wertebereich wird gehasht und das Salt liegt im Klartext daneben — in Sekunden rückrechenbar. Dann S07-04/-05/-06 (Klarname, Passwort-Hashes und Tokens dauerhaft im unlöschbaren Log; `redact_pii_jsonb` deckt 26 Schlüssel gegen 96 direkt identifizierende und 418 Freitextspalten ab), S07-07/-12/-24 (es wird faktisch nichts gelöscht — echte Retention-Jobs bauen), S07-13 (Art. 15/20 als Sammelmechanismus über alle Schemas implementieren), S07-20 (Hinweisgeber-Uploads werden nie gespeichert, Antwort trotzdem 201), S07-09/-10/-11/-14…-19/-21…-26.

**S07-29 ist gesondert zu behandeln:** `docs/compliance/gdpr-readiness-checklist.md` weist Positionen als erfüllt aus, die es nicht sind. Die Datei wird auf den tatsächlichen Stand gesetzt — **nachdem** die technischen Fixes stehen, damit sie danach wieder stimmt statt nur ehrlicher zu sein.

#### WP9 — Worker, Cron, Rate Limiting, E-Mail

**28 Findings** · 1 Critical, 8 High, 10 Medium, 7 Low, 2 Info · `S10-01…S10-27` (ohne `S10-16`, `S10-19`), `S14-02`, `S14-03`, `S14-04`
**Dateihoheit:** `apps/worker/**` (außer den WP5/WP6/WP8 zugewiesenen Dateien), `apps/web/src/lib/rate-limit.ts`, `packages/email/**`, `apps/web/src/app/api/v1/cloud-connectors/**`, `.../connectors/**`, `.../identity-connectors/**`, Migrationen 0435–0439

**S14-02 ist das fachlich schwerste Finding dieses Pakets** und rangiert vor den Infrastrukturthemen: fünf Codepfade schreiben erfundene Prüfergebnisse (`passRate: "100.00"`, `status: "pass"`) audit-trail-gestützt in die Datenbank, ununterscheidbar von echten Nachweisen. In einem Produkt, dessen Zweck der Nachweis ist, ist das ein Integritätsdefekt erster Ordnung — zusammen mit S10-06 und S10-15 (neun weitere Jobs schreiben erfundene oder leere Ergebnisse und melden Erfolg).

Dann S10-02/S13-14 (kein Scheduler — die „Cron-Engine" ist ein passiver HTTP-Listener; 128 Jobs laufen nie), S10-03/-04 (36 von 38 Templates existieren nicht; der `EmailService` meldet jeden Zustellfehler als Erfolg und setzt `emailSentAt` ohne Versand), S10-05 (Rate Limiting auf 5 von 1.357 Routen, Login ohne Lockout, `X-Forwarded-For`-Umgehung — abgestimmt mit WP3/S02-09), S10-07 (Eskalationen an entzogene Mitgliedschaften), S10-09/-10/-13 (kein Lock in 128 Jobs, 69 nicht idempotent, 3 mit Transaktion), S10-11/-12 (39 leere `catch`, Fehlläufe antworten `success: true`), S10-14 (Org-Kontext in allen fünf Fundstellen wirkungslos, Pool-Poisoning), S10-17/-18/-20…-27, S14-03/-04.

---

### Welle 4 — Lieferkette, Betrieb, Tests, Oberfläche (parallel)

#### WP10 — Lieferkette, CI/CD, Betrieb, Backup

**53 Findings** · 15 High, 20 Medium, 13 Low, 5 Info · `S08-01…S08-26`, `S13-*` (ohne `S13-01`, `-03`, `-21`)
**Dateihoheit:** `.github/workflows/**` (außer `migration-policy.yml`/`schema-drift.yml`, die WP1 hält), `Dockerfile*`, `docker/**`, `deploy/**` (außer den WP7 zugewiesenen Storage-Abschnitten), `scripts/**` (außer `docker-entrypoint.sh`), `docs/ADR-015`, `-016`, `-017`, `-023`, `docs/dr-playbook.md`, `docs/runbook.md`

Schwerpunkte: S08-02 (Lizenzverstoß — bpmn.io-Wasserzeichen per `display: none !important` ausgeblendet; die Lizenz verbietet das wörtlich. Entweder Wasserzeichen wiederherstellen oder kommerzielle Lizenz erwerben; der Fix im Code ist das Wiederherstellen), S08-03/-04 (Security-Gate rot auf HEAD; `pdfjs-dist`-Advisory auf dem DMS-Upload-Pfad), S08-05/-08 (ungepinnte Actions, `trivy-action@master` mit `packages: write`), S08-12/-16 (SBOM und NOTICE fehlen vollständig), S13-05 (alle drei dokumentierten Rollback-Kommandos sind falsch), S13-06/-07 (Backup ohne Objektspeicher; Off-Site unverschlüsselt entgegen ADR-015), S13-10 (keine Startup-Validierung, stiller Superuser-Fallback — abgestimmt mit WP2/S01-10), S13-11/-12 (kein Monitoring, keine Sicherheitsalarme), S13-17/-18/-25/-26 (Lint in 1 von 12 Workspaces, E2E-Gate mit 1 von 67 Specs, Coverage-Workflow ohne Schwelle — abgestimmt mit WP11), S13-09/-19/-20/-22/-23/-24/-27/-28/-29/-30, S08-06/-07/-09…-11/-13…-15/-17…-26.

#### WP11 — Testfundament

**18 Findings** · 4 High, 7 Medium, 5 Low, 2 Info · `S11-01…S11-18`
**Dateihoheit:** `vitest.coverage.shared.ts`, `scripts/coverage-aggregate.ts`, `apps/web/src/__tests__/components/all-components-smoke.test.tsx` und die beiden anderen Auto-Smoke-Dateien, `tests/e2e/**`, `apps/web/e2e/**`, `playwright.config.ts`, `packages/*/vitest.config.ts`

Dieses Paket ist Voraussetzung dafür, dass die Abnahme der übrigen Pakete überhaupt etwas bedeutet: S11-03 (82,9 % aller Web-Tests prüfen Mocks gegen Mocks), S11-02 (526 stille Skips verdecken den gesamten Lesepfad der API), S11-01/-04 (Coverage 20,4 % statt 78,4 %; `test:coverage` bricht ab), S11-09 (103 von 124 Worker-Testdateien enthalten genau einen `toBeDefined()`-Test), S11-10 (`packages/db`: 409 Tests, 0,04 % Function-Coverage), S11-11 (Cross-Tenant-/RLS-Negativtests laufen nicht in `npm test`), S11-05/-06/-07/-08/-12…-18.

Da die Wellen 1–3 ihre eigenen Tests mitbringen, konzentriert sich WP11 auf die Infrastruktur: Skips auflösen, Smoke-Tautologien durch echte Assertions ersetzen, Schwellen setzen, alle Suiten in `npm test` und in CI aufnehmen.

#### WP12 — Oberfläche, Barrierefreiheit, i18n, API-Dokumentation

**40 Findings** · 3 High, 15 Medium, 17 Low, 5 Info · `S12-*` (ohne `-09`, `-14`, `-17`, `-18`), `S14-*` (ohne `-02`, `-03`, `-04`)
**Dateihoheit:** `apps/web/src/components/**`, `apps/web/src/app/(dashboard)/**`, `apps/web/src/app/(auth)/**`, `apps/web/src/app/(portal)/**`, `apps/web/src/styles/**`, `apps/web/messages/**`, `apps/web/src/i18n/**`, `apps/web/eslint.config.mjs`, `apps/web/next.config.ts`, `deploy/Caddyfile`, `docs/API_REFERENCE.md`, `docs/ADR-020`, `-021`, `docs/STATUS.md`, `CLAUDE.md`, `docs/feature-catalog.md`

Schwerpunkte: S14-09/-10/-11 (87 % der Formularfelder ohne zugänglichen Namen; BPMN-Modul ohne ein einziges ARIA-Attribut; `text-gray-400` bei 2,58:1 in 1.177 Verwendungen — WCAG-A/AA-Ausschlusskriterien für DACH-Ausschreibungen), S12-04 (CSP mit `unsafe-inline` und `unsafe-eval`), S12-06 (Stored XSS über `javascript:`-URI), S12-07 (Open Redirect), S12-08 (Security-Header nur im Reverse Proxy), S12-16 (Produktionsbuild OOM), S14-05/-06/-07/-08/-14 (21 fehlende i18n-Schlüssel, kein DE-Fallback, 95 von 482 Pages ohne i18n), S14-15/-16/-17/-18 (API-Doku deckt 22 % ab, RFC-7807 in 9 von 1.355 Routen, ADR-020 unimplementiert, vier konkurrierende Paginierungsparameter), S14-19 (267 `any`; die Lint-Regel ist explizit ausgeschaltet), S14-25 (6 von 12 Paketen ohne `tsconfig.json`), S14-01 (Heatmap zeigt Zufallszahlen), S14-20/-21/-22/-23, S12-05/-10…-13/-15/-19…-22.

**S14-23 zum Schluss des Pakets:** von 60 prüfbaren Doku-Zusagen halten 22. Die Dokumentation wird am Ende auf den Stand **nach** der Remediation gebracht, nicht auf den Stand davor.

## 3. Abnahme insgesamt

| Prüfung          | Kriterium                                                           |
| ---------------- | ------------------------------------------------------------------- |
| Migrationen      | 354/354 gegen leere DB, ≥576 Tabellen, Exit 0                       |
| Schema-Drift     | Diff Drizzle ↔ DB leer, inkl. Spalten, Typen, Constraints, Policies |
| Typecheck        | `tsc --noEmit` in allen Paketen mit `tsconfig.json` fehlerfrei      |
| Lint             | ESLint in allen 12 Workspaces, 0 Fehler, 0 Warnungen                |
| Unit/Integration | Alle Suiten grün, keine stillen Skips ohne dokumentierte Begründung |
| RLS              | Cross-Tenant-Systemtest über alle mandantenbezogenen Objekte grün   |
| Audit-Integrität | Tamper-Test erkennt Manipulation; FreeTSA-Validierung greift        |
| E2E              | Playwright-Suite grün                                               |
| Security-Gate    | `node scripts/audit-gate.mjs` Exit 0                                |

## 4. Bekannte Grenzen der Umsetzung

Drei Dinge kann diese Remediation nicht leisten und sie werden im Abschlussbericht als offene Punkte geführt statt als erledigt markiert:

1. **Repository auf privat stellen** (S08-01) — erfordert einen Eingriff des Eigentümers in GitHub.
2. **Betriebsseitige Nachweise** — ein tatsächlich durchgeführter DR-Restore-Drill (S13-08) und ein produktiv laufendes Monitoring (S13-11/-12) lassen sich im Code vorbereiten, aber nicht im Repository nachweisen.
3. **Rechtliche Bewertungen** — Aussagen zu DSGVO, eIDAS, HinSchG, NIS2, DORA und AI Act bleiben technische Bewertungen. Die Fixes stellen die technischen Voraussetzungen her; die rechtliche Würdigung, insbesondere zur Signaturklasse und zum Zielkonflikt Art. 17 vs. Unveränderlichkeit, gehört in eine anwaltliche Prüfung.
