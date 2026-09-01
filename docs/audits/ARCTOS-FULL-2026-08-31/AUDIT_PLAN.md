# ARCTOS — Vollständiger Software-Audit-Plan

**Audit-ID:** ARCTOS-FULL-2026-08-31
**Prüfgegenstand:** `github.com/agatho/grc-platform` @ `a8d1414f` (main, 2026-08-31)
**Auditor:** Claude Opus 5, orchestriert in 14 parallelen Streams
**Auftraggeber:** Johannes Zöller
**Auftrag:** Vollständiger, granularer Audit mit anschließender vollständiger Remediation (inkl. Minor-Findings), Abschlussbericht, Commit und Push.

---

## 1. Prüfgegenstand — verifizierte Kennzahlen

Alle Zahlen am 2026-08-31 im geklonten Repo nachgezählt, nicht aus der Doku übernommen.

| Metrik                                 | Wert      | Doku sagt (`CLAUDE.md`) | Abweichung         |
| -------------------------------------- | --------- | ----------------------- | ------------------ |
| API-Routen (`route.ts`)                | **1.357** | 1.355                   | +2                 |
| Drizzle-Schema-Dateien                 | **112**   | 112                     | —                  |
| `pgTable`-Definitionen                 | **576**   | 576                     | —                  |
| SQL-Migrationen (`drizzle/`)           | **354**   | 350                     | +4                 |
| SQL-Dateien (`sql/`)                   | **81**    | —                       | nicht dokumentiert |
| Next.js Pages                          | **482**   | 482                     | —                  |
| Test-Dateien (`*.test.ts`/`*.spec.ts`) | **684**   | 332                     | +352               |
| Playwright-E2E-Specs                   | **67**    | 67                      | —                  |
| Worker-Dateien                         | **132**   | 128 Cron-Job-Files      | +4                 |

**Tech-Stack:** Next.js 15 / React 19.2.7 / Tailwind 4 / TypeScript 6.0.2 / Node ≥22 / Hono.js (Worker) / PostgreSQL 16 + TimescaleDB 2.29 + pgvector 0.6 / Drizzle ORM / Auth.js v5 / Multi-Provider-AI-Router / Resend.

## 2. Audit-Umgebung

Reproduzierbar aufgesetzt im Cloud-Container (Ubuntu 24.04, 2 vCPU, 7 GB RAM):

- Repo-Klon unter `/work/repo` @ `a8d1414f`
- `npm ci` → 983 Pakete, Lockfile unverändert
- PostgreSQL 16 lokal, Rollen `grc` (SUPERUSER, Migrationen) und `grc_app` (kein BYPASSRLS, Runtime — entspricht `APP_DATABASE_URL` aus `.env.example`)
- Extensions: `pgcrypto`, `uuid-ossp`, `vector` 0.6.0, `timescaledb` 2.29.2
- `DATABASE_URL=postgresql://grc:grc_dev_password@localhost:5432/grc_platform`

## 3. Baseline-Befund vor Streamstart

Bereits beim Aufsetzen der Umgebung erhoben — zählt als Finding und geht in das Register ein:

- **BASE-001 (Critical):** Repository ist auf GitHub öffentlich lesbar. `git ls-remote` und `git clone` funktionieren aus einem unauthentifizierten Container. Kompletter Quellcode eines kommerziellen GRC-Produkts inkl. vollständiger Historie öffentlich.
- **BASE-002 (High):** Migrationen sind nicht von Null reproduzierbar. `migrate-all.ts` gegen leere DB: 354 Migrationen, Pass 1 → 307 ok / 47 deferred, Pass 2 → 4 recovered, Pass 3 → **43 dauerhaft fehlschlagend**. Ergebnis: 533 von 576 erwarteten Tabellen. Betrifft DR-Restore, Neuaufsetzen von Umgebungen und die Auditierbarkeit des Deployments selbst.
- **BASE-003 (Medium):** `packages/db/src/migrate-all.ts` lädt `.env` nicht (im Gegensatz zu `db:migrate`, das `dotenv-cli` nutzt) und fällt auf den OS-Benutzer als DB-User zurück → `password authentication failed for user "root"`.
- **BASE-004 (Medium):** Root-`package.json` deklariert das Skript `db:migrate-all` als `turbo db:migrate-all --filter=@grc/db`, aber `packages/db/package.json` definiert die Task nicht turbo-seitig → `npm run db:migrate-all` bricht mit "Could not find task" ab. Der dokumentierte Setup-Pfad ist damit kaputt.

## 4. Severity-Rubrik

Verbindlich für alle Streams. Ein Finding ohne reproduzierbare Evidenz wird nicht aufgenommen.

| Stufe        | Kriterium                                                                                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Critical** | Cross-Tenant-Datenzugriff, Authentifizierungs-Bypass, RCE, Manipulierbarkeit des Audit-Trails, Secret-Exposure mit Produktivbezug, Totalverlust von Daten                                                            |
| **High**     | Privilegieneskalation innerhalb eines Mandanten, Umgehung von Segregation-of-Duties, DSGVO-Verstoß mit Meldepflicht-Potenzial, nicht reproduzierbares Deployment, unvalidierter Input auf sicherheitsrelevantem Pfad |
| **Medium**   | Fehlende Härtung mit Angriffsvoraussetzungen, Datenqualitäts-/Integritätsrisiko, fehlende negative Tests auf Sicherheitspfaden, Performance-Defekt mit Ausfallpotenzial                                              |
| **Low**      | Härtung ohne konkreten Angriffspfad, Wartbarkeit, inkonsistente Konventionen, Doku-Drift mit Fehlbedienungsrisiko                                                                                                    |
| **Info**     | Beobachtung ohne Handlungsdruck, Kontext für andere Findings                                                                                                                                                         |

**Evidenzpflicht pro Finding:** Datei + Zeilennummer, wörtliches Code-Zitat, konkretes Ausnutzungs-/Fehlerszenario (Eingabe → Wirkung), Begründung der Severity. Bei Behauptungen über Laufzeitverhalten: reproduzierender Befehl oder Query mit Ausgabe.

**Abgrenzung Falsch-Positiv:** Jeder Stream prüft vor Aufnahme, ob eine kompensierende Kontrolle an anderer Stelle greift (Middleware-Kette, RLS-Policy, DB-Constraint, Zod-Schema). Findet sich eine, wird das Finding herabgestuft oder verworfen und die Prüfung dokumentiert.

## 5. Streams

Jeder Stream schreibt fortlaufend nach `/work/audit/findings/S<NN>-<slug>.md` (Zwischenergebnisse während der Arbeit, nicht erst am Ende) und liefert ein strukturiertes Findings-Array zurück. Finding-IDs: `S<NN>-<lfd. Nr.>`.

---

### S01 — Mandantentrennung & Row Level Security

**Ziel:** Nachweisen oder widerlegen, dass kein Mandant Daten eines anderen lesen oder schreiben kann.

**Scope:** `packages/db/src/schema/**` (alle 576 `pgTable`), alle RLS-`CREATE POLICY` in `packages/db/drizzle/**` und `packages/db/sql/**`, `docs/security/rls-coverage-report.md`, `packages/db/vitest.rls.config.ts` und zugehörige Tests.

**Methodik:**

1. Vollständige Ist-Liste aller Tabellen mit `org_id`-Spalte gegen die Liste aller Tabellen mit aktivem RLS und mindestens einer Policy — direkt gegen die laufende DB (`pg_class.relrowsecurity`, `pg_policies`), nicht gegen die Doku.
2. Differenzmenge bilden: Tabellen mit `org_id` ohne RLS = Kandidaten für Cross-Tenant-Leak. Tabellen ohne `org_id`, die aber mandantenbezogene Daten halten (Join-Tabellen, Anhänge, Kommentare, Historien) = zweite Kandidatenklasse.
3. Policy-Qualität prüfen: `USING` ohne `WITH CHECK` (Lesen geschützt, Schreiben nicht), Policies mit `true`, Policies die auf `current_setting(...)` ohne `TRUE`-Fallback-Schutz basieren, `FORCE ROW LEVEL SECURITY` gesetzt oder nicht (ohne FORCE greift RLS nicht für den Tabelleneigentümer).
4. Prüfen, ob die Runtime tatsächlich als `grc_app` läuft und nicht als `grc` (Superuser umgeht RLS vollständig). Codepfade: `packages/db/src/index.ts`, Client-Erzeugung, Verhalten wenn `APP_DATABASE_URL` unset ist.
5. `org_id`-Setzung: Wo wird `set_config('app.current_org', ...)` gesetzt, ist das transaktionslokal, kann es über Connection-Pooling lecken?
6. Praktischer Gegenbeweis: Testdaten in zwei Orgs anlegen, als `grc_app` mit Org-A-Kontext auf Org-B-Zeilen zugreifen, tabellenweise.

**Deliverable:** Tabellenweise Matrix (Tabelle | org_id | RLS | FORCE | Policies | USING/WITH CHECK | Testergebnis), Findings.

---

### S02 — Authentifizierung, Autorisierung, Middleware-Kette, IDOR

**Ziel:** Lückenlosigkeit der Zugriffskontrolle über alle 1.357 Routen.

**Scope:** `apps/web/src/app/api/**`, `packages/auth/**`, `apps/web/src/middleware.ts`, Role-Matrix in `CLAUDE.md`, `docs/security/lod-coverage.md`.

**Methodik:**

1. Jede `route.ts` maschinell klassifizieren: welche der Kettenglieder `requireAuth` → `requireModule` → `orgContextMiddleware` → `requireRole` sind vorhanden. Vollständige Liste der Routen mit fehlenden Gliedern erzeugen.
2. Für jede Lücke bewerten: ist die Route wirklich öffentlich (Health, Auth-Callback, Webhook) oder ist es ein Defekt? Öffentliche Routen einzeln begründen.
3. IDOR/BOLA: Routen finden, die eine Ressourcen-ID aus Path/Body/Query nehmen und ohne Org- oder Ownership-Prüfung laden. Besonders `PATCH`/`DELETE`/`POST`-Handler.
4. Auth.js-Konfiguration: Session-Strategie, Cookie-Flags (`httpOnly`, `secure`, `sameSite`), Session-Lifetime, Rotation, CSRF-Schutz, Callback-URL-Whitelisting, Account-Linking (E-Mail-Kollision), Passwort-Hashing-Parameter.
5. RBAC-Konsistenz: `user_role`-Enum in DB vs. Rollenliste im Code vs. Role-Matrix in der Doku. Rollen, die im Code geprüft werden aber im Enum fehlen (siehe Baseline: `ciso`, `esg_manager`, `bcm_manager` scheitern in Migrationen).
6. Three Lines of Defense / Segregation of Duties: Kann derselbe Principal eine Maßnahme erstellen und abnehmen? Kontrolle durchführen und ihre Wirksamkeit bestätigen? Risiko akzeptieren, das er selbst bewertet hat? Konkrete Codepfade der Freigabe-Workflows (BPM-Release-Cycle, Multi-Stage-Approval).
7. Privilegieneskalation: Kann ein Nutzer sich selbst Rollen zuweisen, Org wechseln, Modulzugriff freischalten?

**Deliverable:** Routen-Matrix als CSV in `/work/audit/evidence/`, Findings.

---

### S03 — Audit-Trail-Integrität & Tamper-Evidence

**Ziel:** Prüfen, ob die zentrale Compliance-Zusage des Produkts — unveränderliche, lückenlose Protokollierung — technisch hält.

**Scope:** Die 3 Append-Only-Log-Tabellen, DB-Trigger, SHA-256-Hash-Kette, FreeTSA-Anbindung, `docs/ADR-011-rev3.md`, `docs/ADR-026-hash-chain-v3-migration.md`.

**Methodik:**

1. Append-Only real prüfen: Existieren `UPDATE`/`DELETE`-blockierende Trigger oder Rules? Sind die Rechte für `grc_app` per `REVOKE` entzogen? Was kann `grc` (Superuser) — und läuft irgendein Produktivpfad als `grc`?
2. Trigger-Deckungsgrad: Welche Tabellen haben Audit-Trigger, welche nicht? Abgleich gegen alle Tabellen mit fachlicher Relevanz. Umgehen Bulk-Inserts, Seeds, Worker-Jobs oder Drizzle-Batch-Operationen den Trigger?
3. Hash-Kette: Berechnungsvorschrift lesen, prüfen ob Vorgänger-Hash wirklich einbezogen wird, ob Feldreihenfolge deterministisch ist, ob NULL-Behandlung eindeutig ist. Kann jemand einen Eintrag einfügen und die Kette neu berechnen? Existiert eine unabhängige Verifikationsfunktion, und wird sie irgendwo automatisch ausgeführt?
4. Kettenbruch-Verhalten: Was passiert bei Restore aus Backup, bei Rollback einer Transaktion, bei parallelen Inserts (Race auf den Vorgänger-Hash)?
5. FreeTSA: Fehlerbehandlung bei Nichterreichbarkeit — wird der Eintrag trotzdem geschrieben (dann ist Tamper-Evidence lückenhaft) oder blockiert er (dann ist es ein Verfügbarkeitsrisiko)? Wird die TSA-Antwort validiert (Zertifikatskette, Nonce, Hash-Übereinstimmung)?
6. Log-Inhalt: Werden Vorher-/Nachher-Werte protokolliert? Landen Passwörter, Tokens oder Sonderkategorien personenbezogener Daten im Log?

**Deliverable:** Integritätsanalyse mit reproduzierenden SQL-Belegen, Findings.

---

### S04 — Input-Validierung, Injection, XML, Datei-Upload, SSRF

**Ziel:** Alle Eintrittspunkte für nicht vertrauenswürdige Daten.

**Scope:** Alle API-Routen, `packages/shared/**` (Validierungs-Helfer), XML-Verarbeitung (BPMN/DMN/ArchiMate-Import), Upload-Pfade, alle `fetch`/`axios`-Aufrufe mit nutzerbeeinflusster URL.

**Methodik:**

1. Zod-Deckungsgrad: Routen ohne Body-/Query-/Path-Validierung listen. `z.any()`, `z.unknown()`, `.passthrough()`, `as any`-Casts nach dem Parsen.
2. SQL-Injection: `sql.raw`, String-Interpolation in `sql`-Templates, dynamische Tabellen-/Spaltennamen aus Nutzereingabe, `ORDER BY`/`LIMIT` aus Query-Parametern.
3. XML: Parser-Konfiguration für BPMN/DMN/ArchiMate — externe Entities, DTD, Netzwerkzugriff, Entity-Expansion-Limits, Größenlimits. Auch XLSX/DOCX-Import (ZIP-Bomben, Path-Traversal in Zip-Einträgen).
4. Datei-Upload: Größenlimit, MIME-Prüfung (Content-Type-Header vs. echte Magic Bytes), Dateiendungs-Whitelist, Speicherpfad-Konstruktion (Traversal), Malware-Scan vorhanden oder nicht, Auslieferung (`Content-Disposition`, `X-Content-Type-Options`, kein Ausliefern von HTML/SVG von der App-Origin).
5. SSRF: Jede ausgehende HTTP-Anfrage mit nutzerbeeinflusster Ziel-URL (Webhooks, AI-Provider-Endpunkte, PDF-Rendering von URLs, Logo-/Bild-Import, LDAP/SAML-Metadaten). Prüfen auf Allowlist, Blockierung privater IP-Bereiche, Redirect-Folgen, DNS-Rebinding. Bekannt: `2ce8d6b8 fix(sec): close F-A playground SSRF` — prüfen ob der Fix vollständig ist und ob andere Pfade dieselbe Lücke haben.
6. Formula-Injection in CSV-/XLSX-Export: Felder, die mit `=`, `+`, `-`, `@`, Tab oder CR beginnen.
7. Deserialisierung, Prototype Pollution, `eval`/`new Function`, Template-Injection.
8. ReDoS: Reguläre Ausdrücke mit verschachtelten Quantoren auf Nutzereingaben.

**Deliverable:** Eintrittspunkt-Inventar, Findings.

---

### S05 — AI-Layer: Prompt Injection, Datenabfluss, Vektor-Isolation, AI Act

**Ziel:** Das jüngste und am wenigsten standardisierte Subsystem.

**Scope:** `packages/ai/**`, alle AI-Assist-Funktionen im BPM, Embedding-/Retrieval-Pfade, `control_embedding`-Migration (`0377`), pgvector-Tabellen.

**Methodik:**

1. Prompt-Konstruktion: Wo fließen nutzerkontrollierte Inhalte (Prozessbeschreibungen, DMS-Dokumente, Risikotexte, Kommentare, Dateinamen) in Prompts? Gibt es Trennung zwischen Instruktion und Daten, Delimiter, Instruktions-Härtung?
2. Wirkung von Modellausgaben: Werden Modellantworten in SQL, Shell, Dateipfade, HTML (XSS), oder in Tool-Calls mit Seiteneffekten übernommen? Wird die Ausgabe validiert, bevor sie persistiert wird?
3. Datenabfluss: Welche Daten verlassen die Installation an Claude/OpenAI/Gemini? Gibt es eine Redaktions-/Minimierungsschicht? Ist der Provider pro Org konfigurierbar? Kann ein Nutzer den Provider wechseln und damit Daten in eine andere Jurisdiktion schicken? Konsistenz mit dem Design-Prinzip "Data Sovereignty — keine US-Cloud-Abhängigkeit".
4. pgvector-Mandantentrennung: Haben Embedding-Tabellen `org_id` und RLS? Filtert die Ähnlichkeitssuche vor oder nach dem Vektor-Vergleich (Post-Filter kann über Org-Grenzen leaken, wenn Limit vor Filter greift)?
5. Secrets: API-Keys im Client-Bundle, in Logs, in der DB im Klartext.
6. Kosten-/Missbrauchskontrolle: Rate Limit, Token-Budget, Schleifenschutz bei Agenten-Funktionen.
7. EU AI Act: Vorhandensein einer Einordnung, Transparenzhinweise gegenüber Nutzern, Protokollierung von AI-Entscheidungen, menschliche Überprüfbarkeit — besonders wo AI Compliance-relevante Bewertungen vorschlägt. Tabelle `ai_transparency_entry` existiert laut Migration `0303`, scheitert aber im Migrationslauf — prüfen ob das Feature real ist.

**Deliverable:** Datenflussdiagramm des AI-Layers als Text, Findings.

---

### S06 — DMS, elektronische Signaturen, Storage

**Ziel:** Die eIDAS-Zusage und die Dokumenten-Integrität.

**Scope:** DMS-Modul, Multi-Signer-e-Signaturen, SHA-256-Hash-Kette der Dokumente, Storage-Abstraktion (local/S3/Garage), Controlled-Copy-Watermarking, `0025`-ff. DMS-Migrationen.

**Methodik:**

1. Was genau wird signiert? Hash über die Datei, über Metadaten, über das gerenderte PDF? Ist der signierte Umfang eindeutig und nachvollziehbar?
2. Signaturklasse: Wird "einfach", "fortgeschritten" oder "qualifiziert" im Sinne eIDAS behauptet? Deckt die Implementierung die behauptete Klasse (Signaturschlüssel unter alleiniger Kontrolle des Unterzeichners? Zertifikat? Nachträgliche Änderungserkennung)? Marketing-/UI-Texte gegen Implementierung prüfen.
3. Multi-Signer: Reihenfolge erzwungen? Kann ein Signaturvorgang nach Teilsignatur manipuliert werden? Was passiert bei Dokumentänderung zwischen zwei Signaturen?
4. Storage-Abstraktion: Pfadkonstruktion aus Nutzereingabe, Bucket-Isolation pro Org, Signed-URL-Lebensdauer und -Umfang, Verschlüsselung at rest, Zugriff auf fremde Objekte durch ID-Raten.
5. Controlled-Copy-Watermarking: Umgehbar? Wird das Original ohne Wasserzeichen ausgeliefert, wenn man den Endpunkt direkt anspricht?
6. Aufbewahrung und Versionierung: Kann eine freigegebene Dokumentversion überschrieben werden? Ist die Versionshistorie manipulationssicher?

**Deliverable:** Findings mit konkreten Angriffspfaden.

---

### S07 — Datenschutz, DSGVO, Aufbewahrung, Löschung

**Ziel:** Ein GRC-Produkt, das selbst datenschutzkonform sein muss.

**Scope:** Alle Schemas mit personenbezogenen Daten, Export-/Löschfunktionen, `data_export_log`, Hinweisgeber-/Vorfall-Module, Retention-Jobs im Worker, `docs/compliance/**`.

**Methodik:**

1. PII-Inventar: Alle Spalten mit personenbezogenen Daten über 112 Schemas hinweg klassifizieren, inkl. Sonderkategorien (Art. 9 DSGVO) in Vorfall-, Hinweisgeber- und Schulungsmodulen.
2. Auskunftsrecht (Art. 15): Existiert eine Funktion, die alle Daten einer natürlichen Person über alle Tabellen zusammenträgt? Ist sie vollständig?
3. Löschrecht (Art. 17): Existiert eine Löschfunktion? Was passiert mit Append-Only-Audit-Logs, Embeddings, Backups, Suchindex, Dateianhängen, E-Mail-Logs? Der Zielkonflikt zwischen Löschpflicht und Unveränderlichkeit muss explizit gelöst und dokumentiert sein — ist er das?
4. Soft-Delete: Wo wird nur ein Flag gesetzt? Werden soft-gelöschte Zeilen von allen Queries konsistent ausgeschlossen (auch von Exports, Reports, AI-Retrieval)?
5. Aufbewahrungsfristen: Sind sie konfigurierbar, werden sie durchgesetzt, gibt es Jobs die tatsächlich löschen?
6. HinSchG: Vertraulichkeit der Identität hinweisgebender Personen — technisch durchgesetzt oder nur organisatorisch? Wer kann in der DB die Identität sehen? Landet sie im Audit-Log?
7. Datenexport: `data_export_log` — wird jeder Export protokolliert, gibt es Mengenbegrenzung, Vier-Augen-Prinzip für Massenexporte?
8. Drittlandtransfer: Welche externen Dienste erhalten personenbezogene Daten (Resend, AI-Provider, FreeTSA)? Ist das im Produkt konfigurierbar/abschaltbar?

**Deliverable:** PII-Inventar als CSV, Findings.

---

### S08 — Secrets, Lieferkette, Lizenzen, Repository-Exposure

**Ziel:** Alles, was außerhalb des eigenen Codes Risiko erzeugt.

**Scope:** Gesamte Git-Historie, `package-lock.json`, `.github/workflows/**`, Docker-Images, `docs/ADR-018-secret-management.md`.

**Methodik:**

1. Git-Historie vollständig nach Secrets durchsuchen (alle Commits, alle Branches, alle Blobs): API-Keys, private Schlüssel, `.env`-Dateien, Datenbank-Dumps, Tokens, Zertifikate. Werkzeuge: gitleaks/trufflehog-artige Muster plus gezielte Suche nach Provider-Präfixen (`sk-`, `ghp_`, `AKIA`, `-----BEGIN`, `xoxb-`, `re_`).
2. Bewertung der öffentlichen Sichtbarkeit des Repos (BASE-001): Was ist dadurch konkret exponiert? Sind die gefundenen Secrets noch gültig?
3. Abhängigkeiten: `npm audit`, veraltete Pakete, Pakete ohne Maintenance, Typosquatting-Kandidaten, Pakete mit Install-Skripten. Die `overrides` in der Root-`package.json` bewerten — sie deuten auf bekannte CVEs hin, die per Override statt per Upgrade geschlossen wurden.
4. Lizenz-Compliance: Vollständige Lizenzliste aller transitiven Abhängigkeiten, Copyleft (GPL/AGPL/SSPL) in einem kommerziellen Produkt identifizieren.
5. CI/CD-Sicherheit: Workflow-Berechtigungen (`permissions:`), `pull_request_target`, ungepinnte Actions (Tag statt SHA), Secret-Nutzung in Fork-PRs, Cache-Poisoning.
6. Docker: Base-Images und deren CVEs, Root-Nutzer im Container, eingebettete Secrets, `.dockerignore`-Vollständigkeit.
7. SBOM: Existiert eine? Wird sie erzeugt?

**Deliverable:** Secret-Fundstellen (redigiert), Lizenzliste, Findings.

---

### S09 — Datenbank, Migrationen, Schema-Integrität, Performance

**Ziel:** Reproduzierbarkeit und Belastbarkeit der Datenschicht.

**Scope:** Alle 354 Migrationen, 81 SQL-Dateien, 112 Schemas, `MIGRATIONS_KNOWN_ISSUES.md`, `.github/workflows/schema-drift.yml`, `migration-policy.yml`, `docs/ADR-014`, `ADR-023`.

**Methodik:**

1. Die 43 fehlschlagenden Migrationen einzeln analysieren: Ursache, ob es ein Reihenfolgeproblem, ein fehlendes Vorgänger-Objekt oder ein echter Defekt ist. Kategorisieren und Fix-Weg pro Migration bestimmen.
2. Nummerierungslücken und Duplikate (`0349a`/`0349b`, fehlende `0358`/`0359`) auf Konsequenzen prüfen: Kann die Reihenfolge zwischen Umgebungen abweichen?
3. Schema-Drift: Drizzle-Schema (`pgTable`) gegen das tatsächliche DB-Schema nach Migration diffen. Spalten, die im Code existieren aber nicht in der DB, und umgekehrt — jede Abweichung ist ein Laufzeitfehler in Wartestellung.
4. Down-/Rollback-Fähigkeit: Existieren Rollback-Skripte? Ist `ADR-023` implementiert?
5. Constraints: Fremdschlüssel ohne Index, fehlende `NOT NULL` auf fachlich pflichtigen Feldern, fehlende `UNIQUE` auf natürlichen Schlüsseln, `ON DELETE`-Verhalten (CASCADE auf Audit-relevanten Tabellen ist ein Integritätsrisiko), CHECK-Constraints für Enums.
6. Indizes: Jede Tabelle mit `org_id` sollte einen Index haben, der `org_id` führend enthält — sonst wird jede RLS-gefilterte Query zum Seq Scan. Fehlende Indizes auf Fremdschlüsseln und auf Spalten in `WHERE`/`ORDER BY` der Hot Paths.
7. N+1: Drizzle-Queries in Schleifen, `await` in `for`-Schleifen über Datensätze, fehlende `with`-Relationen.
8. TimescaleDB: Werden Hypertables tatsächlich genutzt, gibt es Retention-/Compression-Policies?

**Deliverable:** Migrations-Defektliste mit Fix-Weg, Schema-Drift-Diff, Index-Empfehlungen, Findings.

---

### S10 — Worker, Cron, Resilienz, Rate Limiting

**Ziel:** Die unbeaufsichtigt laufenden Teile.

**Scope:** `apps/worker/**` (132 Dateien), Hono-Endpunkte des Workers, `docs/ADR-019-rate-limiting.md`, `ADR-021-error-handling.md`.

**Methodik:**

1. Jeder Cron-Job: Idempotenz (was passiert bei Doppelausführung?), Fehlerbehandlung (wird ein Fehler geschluckt?), Teilerfolg (bricht der Job mitten in einer Menge ab und hinterlässt inkonsistente Daten?), Transaktionsgrenzen.
2. Nebenläufigkeit: Können zwei Instanzen denselben Job gleichzeitig fahren? Gibt es Advisory Locks / `SELECT FOR UPDATE SKIP LOCKED`?
3. Org-Kontext in Jobs: Läuft der Worker als Superuser und umgeht damit RLS? Wie stellt er sicher, dass er nicht Daten der falschen Org verarbeitet?
4. Authentifizierung der Worker-Endpunkte: Sind die Hono-Routen geschützt? Kann jemand von außen einen Job auslösen?
5. Rate Limiting: Wo greift es, wo nicht (Login, Passwort-Reset, Export, AI-Endpunkte, Datei-Upload)? Ist es pro Org, pro Nutzer, pro IP? Ist es umgehbar über `X-Forwarded-For`?
6. Fehlerbehandlung app-weit: Werden Stack Traces oder interne Details an den Client geleakt? Konsistente Fehlerformate laut ADR-021?
7. E-Mail (Resend): Rate Limit, Fehlerbehandlung, Template-Injection, Empfänger-Validierung, kann ein Nutzer die Plattform als Spam-Relay nutzen?

**Deliverable:** Job-Matrix, Findings.

---

### S11 — Testqualität und Coverage-Realität

**Ziel:** Belastbarkeit des Sicherheitsnetzes, das die Remediation absichern soll.

**Scope:** Alle 684 Testdateien, 67 E2E-Specs, `coverage/`, `.github/workflows/coverage.yml`, `scripts/coverage-aggregate.ts`.

**Methodik:**

1. Coverage tatsächlich messen und gegen die dokumentierte Zahl halten. Coverage pro Package, nicht nur global.
2. Testqualität stichprobenartig, aber systematisch: Tests ohne Assertion, Tests die nur `toBeDefined()` prüfen, Tests die den Happy Path abbilden und nichts Negatives, Tests die Mocks gegen Mocks prüfen.
3. `.skip`, `.only`, `todo`, auskommentierte Tests zählen und listen — `.only` in einem committeten Test lässt die gesamte Datei bis auf einen Test durchfallen und wird in CI leicht übersehen.
4. Negative Sicherheitstests: Gibt es Tests, die Cross-Tenant-Zugriff explizit als verboten verifizieren? Die eine fehlende Rolle als 403 prüfen? Die einen manipulierten Audit-Log-Eintrag erkennen? Wenn nein: das ist selbst ein Finding.
5. Flaky-Erkennung: E2E-Specs auf `waitForTimeout`, feste Sleeps, Abhängigkeit von Ausführungsreihenfolge, geteilten Zustand zwischen Tests.
6. Test-Isolation: Werden Tests gegen dieselbe DB gefahren, räumen sie auf, sind sie parallelisierbar?

**Deliverable:** Coverage-Ist, Liste problematischer Tests, Findings.

---

### S12 — Frontend-Sicherheit und Next.js-Grenzen

**Ziel:** Die Client-Seite und die Server/Client-Grenze.

**Scope:** `apps/web/src/app/**` (482 Pages), `packages/ui/**`, `next.config.*`, Middleware, Server Actions.

**Methodik:**

1. Server/Client-Grenze: Landen Secrets oder Server-only-Daten im Client-Bundle? `NEXT_PUBLIC_`-Variablen prüfen. Werden vollständige DB-Objekte an Client Components serialisiert (Overfetching mit sensiblen Feldern)?
2. Server Actions: Jede Server Action ist ein öffentlicher Endpunkt. Prüfen ob jede Action Auth, Org-Kontext und Rollen prüft — Server Actions werden bei Middleware-Analysen regelmäßig vergessen.
3. XSS: `dangerouslySetInnerHTML`, Markdown-Rendering ohne Sanitizing, SVG-Upload und -Anzeige, Rich-Text-Felder (Prozessbeschreibungen, Risikotexte), BPMN-Labels.
4. Security-Header: CSP (vorhanden? `unsafe-inline`/`unsafe-eval`?), `X-Frame-Options`/`frame-ancestors`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`.
5. Open Redirect in Auth-Flows, `next/link` mit nutzerkontrollierter URL, `target="_blank"` ohne `rel="noopener"`.
6. Client-seitige Autorisierung: UI-Elemente, die nur versteckt statt serverseitig verweigert werden.
7. Caching: `revalidate`, `force-cache`, `unstable_cache` auf mandantenbezogenen Daten — ein falsch gesetzter Cache ist ein Cross-Tenant-Leak.

**Deliverable:** Findings.

---

### S13 — Betrieb: CI/CD, Deployment, Backup, Monitoring, Logging

**Ziel:** Ob das System betreibbar und wiederherstellbar ist.

**Scope:** `.github/workflows/**` (10 Workflows), `docker/**`, `deploy/**`, `scripts/**`, `docs/dr-playbook.md`, `runbook.md`, `ADR-015`, `ADR-016`, `ADR-017`.

**Methodik:**

1. CI-Vollständigkeit: Läuft CI wirklich alles (Typecheck, Lint, Unit, Integration, RLS, E2E, Migrationen von Null)? `continue-on-error`, `|| true`, ausgeschlossene Pfade.
2. Der Migrations-Baseline-Defekt (BASE-002) bedeutet, dass CI die Migrationen offensichtlich nicht von Null fährt — prüfen und belegen.
3. Deployment: Zero-Downtime möglich? Reihenfolge Migration vs. App-Deploy? Rollback-Pfad?
4. Backup: Existiert eine automatisierte Sicherung, ist der Restore je getestet, deckt sie Objektspeicher (DMS-Dateien) mit ab? Ein Backup ohne getesteten Restore ist in einem GRC-Produkt ein eigenes Finding.
5. Monitoring/Alerting: Was wird überwacht, gibt es Alarme auf sicherheitsrelevante Ereignisse (fehlgeschlagene Logins, Massenexporte, Audit-Kettenbruch)?
6. Logging-Hygiene: Landen PII, Tokens, Passwörter, vollständige Request-Bodies in Logs? Log-Level in Produktion? Aufbewahrung der Logs?
7. Konfigurations-Härtung: `.env.example` gegen tatsächlich benötigte Variablen, unsichere Defaults, fehlende Pflichtprüfung beim Start (startet die App mit fehlendem `APP_DATABASE_URL` und läuft dann als Superuser?).

**Deliverable:** Findings.

---

### S14 — i18n, Barrierefreiheit, Doku-Drift, toter Code, API-Konsistenz

**Ziel:** Die Themen, die in Ausschreibungen und Due Diligence auffallen.

**Scope:** 77 i18n-Namespaces DE/EN, 482 Pages, `docs/**`, `apps/web/src/app/api/v1/**`, `ADR-020-api-versioning.md`, `ADR-022`.

**Methodik:**

1. i18n: Fehlende Schlüssel je Sprache, unbenutzte Schlüssel, hartcodierte Strings in TSX, Platzhalter-Inkonsistenzen zwischen DE und EN, Pluralformen, Datums-/Zahlenformate.
2. Barrierefreiheit (EN 301 549 / BFSG): Automatisierte Prüfung repräsentativer Seiten mit axe, plus statische Prüfung auf fehlende Labels, `alt`-Texte, Fokus-Management in Dialogen, Tastaturbedienbarkeit der BPMN- und Diagramm-Komponenten, Farbkontraste.
3. Doku-Drift: Alle Zahlen und Zusagen in `CLAUDE.md`, `docs/STATUS.md`, `feature-catalog.md`, `API_REFERENCE.md` gegen den Code prüfen. Bereits bekannt: Testdateien-Zahl weicht um Faktor 2 ab, Migrationszahl um 4, Routenzahl um 2. In einem Compliance-Produkt ist die Richtigkeit der eigenen Doku selbst ein Compliance-Merkmal.
4. Toter Code: `grcfiles/source/grc-platform` (veraltetes Skelett) — liegt es im Repo? Ungenutzte Exporte, verwaiste Dateien, `.tmp`-Dateien im Repo (`docs/STATUS.md.tmp.38484...` existiert), auskommentierte Blöcke.
5. API-Konsistenz: Einheitliche Fehlerformate, HTTP-Statuscodes, Paginierung, Versionierung laut ADR-020, `API_REFERENCE.md` gegen die tatsächlichen 1.357 Routen.
6. TypeScript-Strenge: `any`-Vorkommen außerhalb von Type Guards (laut Konvention verboten), `@ts-ignore`/`@ts-expect-error`, `!`-Non-Null-Assertions auf Nutzerdaten.

**Deliverable:** Findings.

---

## 6. Ablauf

| Phase                    | Inhalt                                                   | Ergebnis                         |
| ------------------------ | -------------------------------------------------------- | -------------------------------- |
| **0 — Setup**            | ✅ abgeschlossen                                         | Umgebung, Baseline, BASE-001…004 |
| **1 — Audit**            | 14 Streams parallel                                      | `/work/audit/findings/S*.md`     |
| **2 — Verifikation**     | Adversariale Prüfung aller Critical/High, Deduplizierung | `FINDINGS_REGISTER.md`           |
| **3 — Remediation-Plan** | Pro Finding Fix, Risiko, Testnachweis, Reihenfolge       | `REMEDIATION_PLAN.md`            |
| **4 — Umsetzung**        | Alle Findings inkl. Minor, konfliktfrei partitioniert    | Commits                          |
| **5 — Vollverifikation** | Migrationen von Null, tsc, ESLint, Unit, RLS, E2E        | Testprotokoll                    |
| **6 — Abschluss**        | Bericht, Branch `audit/full-2026-08-31`, Push, PR        | `AUDIT_REPORT.md`, PR            |

## 7. Grenzen des Audits

Explizit **nicht** Gegenstand: Penetrationstest gegen eine laufende Produktivinstanz, Infrastruktur außerhalb des Repos, physische und organisatorische Kontrollen, Rechtsberatung. Aussagen zu DSGVO, eIDAS, NIS2, DORA und AI Act sind technische Bewertungen, keine juristische Prüfung.
