# S07 — Datenschutz, DSGVO, Aufbewahrung, Löschung

**Audit-ID:** ARCTOS-FULL-2026-08-31 · Stream S07
**Prüfgegenstand:** `/work/repo` @ `a8d1414f`, laufende PostgreSQL `grc_platform` (527 Basistabellen, 7.361 Spalten)
**Auditor:** Claude Opus 5
**Stand:** abgeschlossen

> **Abgrenzung:** Alle Aussagen sind _technische_ Bewertungen der Implementierung gegen den Wortlaut von DSGVO, BDSG und HinSchG. Sie sind keine Rechtsberatung und ersetzen keine datenschutzrechtliche Würdigung durch einen Rechtsbeistand oder die zuständige Aufsichtsbehörde.

---

## 1. Zusammenfassung

29 Findings: **1 Critical, 10 High, 8 Medium, 7 Low, 3 Info.**

Der Befund lässt sich in vier Sätzen zusammenfassen:

1. **Das Hinweisgeber-Modul ist technisch nicht vertraulich.** Ein zweiter, generischer Datenbank-Trigger kopiert Meldungen, Fallnachrichten und — entscheidend — den Mailbox-Zugangstoken der hinweisgebenden Person in den allgemeinen `audit_log`, den jede `admin`-, `auditor`- und `dpo`-Rolle über eine reguläre API-Route ausliest. Genau diese Rollen schließt der Anwendungscode an anderer Stelle ausdrücklich aus, mit Verweis auf HinSchG §8. Mit dem Token ist der unauthentifizierte Hinweisgeber-Kanal vollständig übernehmbar (S07-01). Drei weitere Pseudonymisierungen im selben Modul — `ip_hash`, `actor_hash`, Tombstone-Hash — sind nach demselben Muster gebaut: Hash über ein Merkmal mit kleinem Wertebereich, Salt im Klartext in derselben Zeile, in Sekunden rückrechenbar (S07-02, S07-03, S07-08).

2. **Der Zielkonflikt Löschpflicht vs. Unveränderlichkeit ist erkannt, entworfen und zu etwa 70 % gebaut — aber nicht fertig.** ADR-011 rev.2 benennt ihn, wählt Tombstoning als Lösung und die Implementierung existiert. Sie trägt jedoch nicht: der im ADR vorausgesetzte Tombstone-Key wurde nie gebaut, `entity_title` mit dem Klarnamen ist von der Redaktion ausgenommen _und_ per Guard dauerhaft unveränderbar, und die Redaktion greift nur auf oberster JSON-Ebene für 26 feste Schlüsselnamen — gemessen am maschinell erhobenen Inventar von 96 direkt identifizierenden und 418 Freitext-Spalten ist das ein Bruchteil. Passwort-Hashes werden bei jeder Registrierung und jeder Passwortänderung in den unlöschbaren Log kopiert und sind dort nicht redigierbar (S07-03 bis S07-06, S07-15, S07-28).

3. **Es wird nichts automatisch gelöscht.** Der einzige Retention-Job über personenbezogene Daten erzeugt Tickets, keine Löschungen, und rechnet die Frist gegen das Anlagedatum der Regel statt gegen das Alter der Daten. Ausgenommen ist ein einziger, korrekt gebauter Purge-Job für Dokumente. Zugriffsprotokolle, Sitzungen, Signatur-Metadaten und die gesamte Hinweisgeber-Dokumentation (HinSchG §11 Abs. 5: Löschung nach drei Jahren) haben keinen Löschpfad (S07-07, S07-12, S07-24).

4. **Die Produktdokumentation behauptet das Gegenteil.** `docs/compliance/gdpr-readiness-checklist.md` weist „automatisierte Deletion", Art. 15, Art. 17, Art. 20 und „keine Drittlandsuebermittlung" als erfüllt aus und schließt mit „ARCTOS-GDPR-Readiness ~95 %". Von acht überprüften Positionen dieser Checkliste hält keine der Prüfung stand (S07-29). Für ein GRC-Produkt ist das der schwerwiegendste Befund dieses Streams — nicht wegen der technischen Lücke, sondern weil die erste Frage jeder Kunden-Due-Diligence genau diese Zusagen betrifft.

**Was gut gebaut ist** (ausdrücklich festgehalten, weil es die Bewertung der Lücken einordnet): die Verschlüsselung der Hinweisgeber-Freitexte greift tatsächlich; `data_export_log` ist mit FORCE-RLS und Append-Only-Rules sauber gehärtet; der Export-Engine filtert Soft-Deletes korrekt und hat ein Zeilenlimit; `control-embedding-sync` filtert `deleted_at`; die DPIA-Gate-Logik (`evaluateDpiaGates`) ist gegen die Produktivfunktion getestet; die Entkopplung von `compute_audit_hash_v3` und den PII-Spalten ist ein durchdachter Entwurf, der die Redaktion überhaupt erst ermöglicht.

**Cross-Stream-Hinweise:** S01 (RLS auf `audit_log`, `wb_anonymous_mailbox`, `whistleblowing_audit_log`), S02 (Rollen-Enum-Drift, `withAuth()` ohne Rollenliste auf Export-Routen), S03 (`changes` in der Tombstone-Allowlist ⇒ Inhalt eines Audit-Eintrags ist überschreibbar, ohne dass `entry_hash` bricht), S04 (Bezeichner-Injektion im Export-Filter), S05 (KI-Layer), S06 (verlorene Hinweisgeber-Uploads, Storage-Pfadbau), S11 (Test spiegelt Route statt sie zu importieren), S14 (Doku-Drift).

---

## 2. Methodik-Protokoll

| #   | Methodikpunkt (AUDIT_PLAN §S07)             | Status | Vorgehen / Evidenzartefakt                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PII-Inventar über alle Schemas inkl. Art. 9 | ✅     | Maschinell aus `information_schema.columns` (7.361 Spalten, 527 Basistabellen) plus FK-Katalog (411 Fremdschlüssel auf `user`). Klassifikator: `/work/audit/evidence/S07-pii-classifier.py`. Ergebnis: `/work/audit/evidence/S07-pii-inventar.csv`. Art.-9/Art.-10-Erkennung über Spaltennamen, Enum-Werte (`wb_category` mit `health_safety`/`discrimination`) und Modulkontext. |
| 2   | Auskunftsrecht Art. 15                      | ✅     | DSR-Modul und alle acht Zustandsübergangs-Routen gelesen; `grep` auf `subjectEmail`/`subjectName` über die gesamte Codebasis. Ergebnis: reiner Workflow, kein Sammelmechanismus → S07-13.                                                                                                                                                                                         |
| 3   | Löschrecht Art. 17 vs. Append-Only          | ✅     | `tombstone_audit_entry`, `redact_pii_jsonb`, `audit_log_tombstone_only_guard`, `compute_audit_hash_v3` aus `pg_proc` gelesen; ADR-011 rev.2 §D4 gegen die Implementierung gehalten; drei reproduzierende SQL-Skripte gefahren (Reversal, `entity_title`-Persistenz, Passwort-Hash im Log) → S07-03 bis S07-06, S07-15, S07-28.                                                    |
| 4   | Soft-Delete-Konsistenz                      | ✅     | 48 Tabellen mit `deleted_at` ermittelt; 625 Lesezugriffe aus API-Routen maschinell auf `isNull(<t>.deletedAt)` geprüft (`/work/audit/evidence/S07-softdelete-routen.txt`, 101 ohne Filter); Stichproben manuell auf Falsch-Positive geprüft (SCIM verworfen); Sekundärbestände Suchindex, RAG-Index, Export-Engine separat geprüft → S07-16, S07-17, S07-25.                      |
| 5   | Aufbewahrungsfristen                        | ✅     | Alle 128 Cron-Jobs auf löschende Operationen gescannt; `retention-monitoring.ts` und `document-retention-purge.ts` vollständig gelesen; `retention_schedule`/`deletion_request` gegen die Behauptung der Compliance-Doku gehalten → S07-07, S07-12, S07-24.                                                                                                                       |
| 6   | HinSchG-Vertraulichkeit                     | ✅     | Trigger-Katalog aller 13 `wb_*`-Tabellen, RLS-Status und Policies, `whistleblowing_audit_trigger`, `wb-crypto.ts`, alle sechs Fall-Routen und die drei Portal-Routen gelesen; End-to-End-Leckpfad mit SQL reproduziert → S07-01, S07-02, S07-08, S07-09, S07-12, S07-19 bis S07-22.                                                                                               |
| 7   | `data_export_log` / Massenexport            | ✅     | Alle 25 Export-Routen einzeln auf Protokollierung, Rollenprüfung und PII-Kennzeichen geprüft; Export-Engine und Entity-Registry gelesen; Härtung der Log-Tabelle (RLS, Rules) verifiziert → S07-14, S07-26, S07-27.                                                                                                                                                               |
| 8   | Drittlandtransfer                           | ✅     | AI-Router, Embedding-Pfad, FreeTSA-/OpenTimestamps-Anbindung und Resend-Konfiguration gegen die Sub-Prozessor-Liste der Compliance-Doku gehalten; Suche nach einer Redaktionsschicht in `packages/ai` → S07-18.                                                                                                                                                                   |

**Nicht abschließend geprüft** (außerhalb des S07-Scopes oder ohne verfügbare Evidenz): Verschlüsselung at rest auf Speicher-/Backup-Ebene (keine Infrastruktur im Prüfumfang, siehe AUDIT_PLAN §7), tatsächlicher Inhalt von Backups, Resend-seitige Aufbewahrung, Wirksamkeit der TOMs aus Katalog #24 als organisatorische Kontrollen.

---

## 3. PII-Inventar — Auswertung

**Artefakt:** `/work/audit/evidence/S07-pii-inventar.csv` — eine Zeile je Spalte, 7.361 Zeilen.
Spalten: `table, column, data_type, nullable, modul, klassifikation, art_der_daten, art9_sonderkategorie, konfidenz`.

**Erzeugung:** vollmaschinell aus dem Datenbankkatalog der migrierten Instanz (nicht aus den Drizzle-Dateien — so werden auch die 43 nicht migrierten Objekte korrekt als nicht existent behandelt und die tatsächlich vorhandene Struktur bewertet). Personenreferenzen wurden nicht nur über Spaltennamen, sondern über den Fremdschlüsselkatalog erkannt: 411 Spalten sind echte FK auf `"user"`.

### Verteilung

| Klassifikation               | Spalten | Bedeutung                                                                               |
| ---------------------------- | ------: | --------------------------------------------------------------------------------------- |
| direkt identifizierend       |  **96** | Name, E-Mail, Telefon, Anschrift, IP, User-Agent, Steuer-ID, Lichtbild, Authentifikator |
| pseudonym identifizierend    | **544** | FK auf `user` bzw. `*_by`/`*_id`-Personenreferenzen                                     |
| Freitext (PII möglich)       | **418** | `description`, `notes`, `content`, `resolution`, `message`, …                           |
| Beschäftigten-Leistungsdaten |  **10** | Lern-/Testergebnisse (§ 26 BDSG, § 87 Abs. 1 Nr. 6 BetrVG)                              |
| kein Personenbezug           |   6.293 |                                                                                         |

**449 von 527 Tabellen (85 %) enthalten mindestens eine Spalte mit Personenbezug.** Personenbezug ist in diesem Produkt kein Randthema einzelner Module, sondern der Normalfall — das ist der Maßstab, an dem die 26-Schlüssel-Allowlist des Löschwerkzeugs (S07-06) zu messen ist.

### Verteilung nach Modul

| Modul                    | Spalten mit Personenbezug |
| ------------------------ | ------------------------: |
| Other/GRC-Core           |                       757 |
| Audit/Logging            |                        50 |
| TPRM/Vendor              |                        45 |
| DPMS/GDPR                |                        39 |
| Identity/Platform        |                        37 |
| DMS/Signature            |                        30 |
| Whistleblowing (HinSchG) |                        27 |
| Incident/Breach          |                        26 |
| Stakeholder/Portal       |                        24 |
| Academy/Training         |                        17 |
| ESG                      |                        16 |

### Besondere Kategorien (Art. 9) und strafrechtsbezogene Daten (Art. 10)

| Einstufung                                     | Spalten | Beispiele                                                                                                                                                         |
| ---------------------------------------------- | ------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Art. 9 — ja (Spaltenname)                      |       1 | `device_registration.biometric_enabled`                                                                                                                           |
| Art. 9 — ja (Enum-Wert)                        |       1 | `wb_report.category` — Enum `wb_category` enthält `health_safety` und `discrimination`                                                                            |
| Art. 9/Art. 10 — möglich (Hinweisgebermeldung) |      22 | `wb_report.description`, `wb_case.resolution`, `wb_case_message.content`, `wb_investigation_log.description`, `wb_protection_event.review_notes` …                |
| Art. 9 — möglich (Modulkontext)                |      17 | `data_breach.description`, `security_incident.description`, `nis2_incident_report.contact_*`, `incident_timeline_entry.description`, `academy_course.description` |

**Zwei Punkte, die aus dem Inventar unmittelbar folgen:**

1. `wb_report.category` ist **im Klartext** gespeichert, während `description` und `contact_email` verschlüsselt sind. Die Kategorie allein — `health_safety`, `discrimination` — ist bereits eine Angabe, die auf Gesundheit, ethnische Herkunft, Religion oder sexuelle Orientierung schließen lässt, und sie steht über S07-01 in einem organisationsweit lesbaren Log. Das Schutzniveau des Moduls wird durch das eine unverschlüsselte Feld bestimmt, nicht durch die beiden verschlüsselten.

2. Hinweisgebermeldungen enthalten regelmäßig **Art.-10-Daten über die beschuldigte Person** (Vorwurf einer Straftat). Diese Personengruppe kommt in der Datenschutz-Dokumentation des Produkts nicht vor; `ropa_data_subject` und die DSFA-Trigger adressieren sie nicht.

### Methodische Grenzen des Inventars

- Die Klassifikation ist heuristisch. `konfidenz` unterscheidet `hoch` (eindeutiger Spaltenname, FK-Nachweis) und `mittel` (kontextabhängig, z. B. `name`, Freitextspalten, generische `*_by`-Referenzen). Für die Findings wurden ausschließlich Spalten mit `hoch` als Beleg herangezogen.
- Freitextspalten sind als _möglicher_ Personenbezug klassifiziert. Ob im Betrieb tatsächlich Personendaten hineingeschrieben werden, lässt sich statisch nicht entscheiden — in einem GRC-Produkt (Risikobeschreibungen, Vorfallschilderungen, Prüfungsnotizen) ist es die Regel.
- JSONB-Spalten (`metadata`, `answers_json`, `templateData`, `affected_systems`, `changes`) sind pauschal als Freitext geführt. Ihr Inhalt ist schemalos und damit weder inventarisierbar noch — siehe S07-06 — redigierbar.

---

## 4. Findings

### S07-01 — Critical — Hinweisgeber-Meldungen und Mailbox-Token landen im allgemeinen `audit_log` und heben die HinSchG-Rollentrennung auf

**Evidenz**

Der generische `audit_trigger()` liegt auf _allen_ Whistleblowing-Tabellen — zusätzlich zum dedizierten `whistleblowing_audit_trigger()`:

```
$ psql -c "select c.relname, t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid
           join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and c.relname like 'wb\_%'"
wb_report                    | audit_trigger                          <-- nur generisch
wb_anonymous_mailbox         | wb_anonymous_mailbox_audit_trigger     <-- nur generisch
wb_investigation             | audit_trigger                          <-- nur generisch
wb_interview                 | audit_trigger                          <-- nur generisch
wb_evidence                  | audit_trigger                          <-- nur generisch
wb_protection_case           | audit_trigger                          <-- nur generisch
wb_protection_event          | audit_trigger                          <-- nur generisch
wb_ombudsperson_assignment   | audit_trigger                          <-- nur generisch
wb_ombudsperson_activity     | audit_trigger                          <-- nur generisch
wb_investigation_log         | wb_investigation_log_audit_trigger     <-- nur generisch
wb_case                      | audit_trigger + whistleblowing_audit_trigger_wb_case
wb_case_message              | audit_trigger + whistleblowing_audit_trigger_wb_case_message
wb_case_evidence             | audit_trigger + whistleblowing_audit_trigger_wb_case_evidence
```

`audit_trigger()` schreibt bei INSERT die **komplette Zeile** in `audit_log.changes`:

```plpgsql
IF TG_OP = 'INSERT' THEN
  v_changes := jsonb_build_object('new', v_new);
```

(`pg_proc.prosrc` von `public.audit_trigger`, Rumpf ab „IF TG_OP = 'INSERT'", ident. Quelle: `packages/db/drizzle/` Audit-Trigger-Migration)

`audit_log` wird von `apps/web/src/app/api/v1/audit-log/route.ts:23` an `admin`, `auditor` und `dpo` ausgeliefert, und zwar mit `db.select()` — also **alle Spalten inkl. `changes`**:

```ts
// apps/web/src/app/api/v1/audit-log/route.ts:23
const ctx = await withAuth("admin", "auditor", "dpo");
...
// Zeile 122-128
db.select().from(auditLog).where(where).orderBy(...).limit(limit).offset(offset)
```

Genau dieselbe Datei behauptet in Zeile 19-21 die Kompensation:

```ts
// The whistleblowing_audit_log table is a separate relation and is NEVER
// returned by this endpoint — only the whistleblowing role can access it
// via /api/v1/whistleblowing/audit-log.
```

Die Aussage ist für `whistleblowing_audit_log` korrekt und **für die Sache irrelevant**, weil der Inhalt über den zweiten, generischen Trigger ohnehin in `audit_log` steht.

Das Anwendungs-Rollenmodell schließt `admin` bewusst aus (`apps/web/src/app/api/v1/whistleblowing/cases/route.ts:5-14`):

```ts
// HinSchG §10/§11 + GDPR Art. 9(2)(b) require **case content isolation**
// from any role outside the designated reporting channel staff. Admin must
// NOT read case lists or case content — even for "platform oversight".
```

Und `docs/ADR-011-rev2.md:80-86` legt fest:

> „Eigener Trigger `whistleblowing_audit_trigger()` auf den wb-Tabellen […] RLS-Policy: nur `whistleblowing_officer` und `ombudsperson` haben Read-Access. Platform-Admin hat keinen Direktzugriff […] Rationale: HinSchG §8 schützt Whistleblower-Identität."

**Reproduktion** (`/work/audit/evidence/S07-repro-wb-audit-leak.sql`, Ausgabe in `.out`):

```
--- Genau die Felder, die ein org-admin ueber GET /api/v1/audit-log auslesen kann ---
 entity_type          | report_token                                          | mailbox_token                                            | kategorie     | ip_hash
 wb_anonymous_mailbox |                                                       | MAILBOXTOKEN_SECRET_abcdefghijklmnopqrstuvwxyz0123456789 |               |
 wb_report            | TESTTOKEN_REPORT_1234567890abcdefghijklmnopqrstuvwxyz |                                                          | health_safety | 4a172f68…
```

**Szenario**

1. Ein Org-Admin (Rolle `admin`, kein Whistleblowing-Zugriff) ruft `GET /api/v1/audit-log?entityType=wb_anonymous_mailbox&includeInternal=true` auf.
2. Die Antwort enthält je Meldung `changes.new.token` — den 128-stelligen Mailbox-Token.
3. `GET /api/v1/portal/mailbox/<token>` ist **unauthentifiziert** und gibt den Fall samt _entschlüsselter_ Nachrichten zurück (`apps/web/src/app/api/v1/portal/mailbox/[token]/route.ts:45-80`, `content: decrypt(m.content)`), `POST` erlaubt zusätzlich das Schreiben von Nachrichten **im Namen der hinweisgebenden Person**.
4. Über `?entityType=wb_report` erhält derselbe Admin zusätzlich `category` (u. a. `health_safety`, `discrimination` — Art. 9 DSGVO) und den `ip_hash` (siehe S07-02).

Damit ist die zentrale Schutzzusage des HinSchG-Moduls — Vertraulichkeit der Identität, Zugriff nur für die Meldestellen-Beauftragten — durch einen zweiten Datenbank-Trigger vollständig aufgehoben. Der Angreifer braucht keine erhöhten Rechte: `admin`, `auditor` und `dpo` sind reguläre Mandantenrollen.

**Kompensierende Kontrollen geprüft:** RLS auf `wb_report` (vorhanden, greift aber nicht für `audit_log`); Rollen-Gate auf `/whistleblowing/cases` (vorhanden, wird umgangen); Verschlüsselung von `description`/`contact_email` (greift, schützt aber weder Token noch Kategorie noch `ip_hash`); `whistleblowing_audit_log` mit eigener RLS (existiert, ist aber nicht der Leckpfad). Keine der Kontrollen adressiert `audit_log`.

**Severity: Critical** — Offenlegung besonderer Kategorien personenbezogener Daten (Art. 9) und Aufhebung einer gesetzlich (HinSchG §8) geforderten Vertraulichkeit gegenüber einer Rolle, die davon ausdrücklich ausgeschlossen sein soll; zusätzlich vollständige Übernahme des Hinweisgeber-Kanals.

---

### S07-02 — High — `wb_report.ip_hash`: ungesalzener SHA-256 einer IP-Adresse ist keine Pseudonymisierung

**Evidenz** — `packages/shared/src/wb-crypto.ts:55-60`:

```ts
/**
 * Hash an IP address using SHA-256 (for privacy-preserving duplicate detection).
 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}
```

Aufruf: `apps/web/src/app/api/v1/portal/report/[orgCode]/route.ts:90` → `const ipHashed = hashIp(ip);`, gespeichert in `wb_report.ip_hash` (Zeile 121).

**Reproduktion** (`/work/audit/evidence/S07-repro-wb-audit-leak.sql`):

```
--- ip_hash ist ungesalzen: Rueckrechnung aus einem /24-Netz ---
 gefundener_hash                                                  | rueckgerechnete_ip
 4a172f681b6ccafc1f6a9f499576317c1732ba93e6b3f8400e2cc899a1b5c529 | 10.20.30.44
```

256 Hash-Operationen für ein /24; der gesamte IPv4-Raum (2^32) ist auf handelsüblicher Hardware in Minuten durchgerechnet.

**Szenario:** Die Meldestelle oder — über S07-01 — jeder Org-Admin liest `ip_hash`, rechnet ihn gegen den bekannten internen Adressraum des Unternehmens zurück und ordnet die Meldung über DHCP-/VPN-/Proxy-Logs einer konkreten Person zu. Die IP-Adresse ist damit faktisch im Klartext gespeichert; der Kommentar „NOT plaintext" in `packages/db/src/schema/whistleblowing.ts:71` ist irreführend.

**Severity: High** — Deanonymisierung hinweisgebender Personen (HinSchG §8), Verstoß gegen Art. 25/32 DSGVO (Stand der Technik: gesalzener KDF oder Verzicht auf die Speicherung).

---

### S07-03 — High — Der Art.-17-Tombstone ist mit einem im Klartext danebenstehenden Salt gebildet und damit rückrechenbar

**Evidenz** — `tombstone_audit_entry()` (Migration 0284, `pg_proc.prosrc`):

```plpgsql
-- Deterministic hashes using entry_hash as salt
v_email_hash := encode(digest(COALESCE(v_existing.user_email,'') || '|' || v_existing.entry_hash, 'sha256'),'hex');
v_name_hash  := encode(digest(COALESCE(v_existing.user_name,'')  || '|' || v_existing.entry_hash, 'sha256'),'hex');
```

`entry_hash` steht in **derselben Zeile** und bleibt beim Tombstoning unverändert (`audit_log.entry_hash`, siehe `audit_log_tombstone_only_guard` — `entry_hash` ist nicht in der Allowlist).

`docs/ADR-011-rev2.md:103` formuliert die Sicherheitsvoraussetzung, die die Implementierung verletzt:

> „Re-Identifikation der Person aus dem Hash ist nicht möglich, **wenn der Tombstone-Key nach Ablauf vernichtet wird**"

Es gibt keinen Tombstone-Key. Der ADR-Kommentar in Zeile 94 sagt `SHA-256(PII|tombstone_key)`; implementiert ist `SHA-256(PII|entry_hash)`.

**Reproduktion** (`/work/audit/evidence/S07-repro-tombstone-reversal.sql`):

```
--- (b) Rueckrechnung gegen eine Kandidatenliste (z.B. Inhalt der user-Tabelle) ---
 rueckgerechnete_email        | rueckgerechneter_name
 erika.musterfrau@example.org | Erika Musterfrau
```

**Szenario:** Nach einem stattgegebenen Löschantrag ruft ein `auditor` `GET /api/v1/audit-log` ab, nimmt sich die E-Mail-Liste aus `GET /api/v1/users` (oder eine erratene Namensliste — ein Unternehmen hat typischerweise < 10⁴ Beschäftigte) und rechnet für jede tombstonete Zeile `sha256(kandidat || '|' || entry_hash)` durch. Ein Treffer identifiziert die Person eindeutig. Der Aufwand ist `Kandidaten × Zeilen` Hash-Operationen, also Sekunden.

Damit ist die Maßnahme technisch eine **Pseudonymisierung**, keine Löschung. Nach Art. 4 Nr. 5 DSGVO bleiben pseudonymisierte Daten personenbezogen; Art. 17 verlangt „unverzügliche Löschung".

**Kompensierende Kontrollen geprüft:** keine. Es existiert kein Key-Management für den Tombstone (kein `WB_ENCRYPTION_KEY`-Äquivalent, kein KMS-Bezug, keine Key-Destruktion). `grep -rn "tombstone_key" /work/repo` → keine Treffer.

**Severity: High** — Betroffenenrecht nach Art. 17 wird nicht erfüllt, obwohl das Produkt es als erfüllt ausweist (`docs/compliance/gdpr-readiness-checklist.md`, Art. 17 „✅").

---

### S07-04 — High — `audit_log.entity_title` konserviert den Klarnamen und ist per Guard dauerhaft unveränderbar

**Evidenz** — `audit_trigger()` befüllt `entity_title` aus den Klarnamensfeldern der Zeile:

```plpgsql
v_entity_title := COALESCE(v_new->>'name', v_new->>'title', v_new->>'email');
```

`tombstone_audit_entry()` fasst `entity_title` nicht an. Der Guard verbietet jede nachträgliche Korrektur (`audit_log_tombstone_only_guard`, Allowlist):

```plpgsql
v_allowed text[] := ARRAY['user_email','user_name','ip_address','changes',
                          'pii_tombstoned_at','pii_tombstone_reason','hash_version'];
```

**Reproduktion** (`/work/audit/evidence/S07-repro-tombstone-reversal.sql`):

```
--- (a) Zustand nach Tombstoning ---
 entity_title     | user_email                        | user_name
 Erika Musterfrau | __tombstoned__:babdb92f…          | __tombstoned__:82d7bc62…

--- (a2) Versuch, entity_title nachtraeglich zu bereinigen ---
ERROR:  audit_log is append-only — column entity_title cannot be updated
        (use tombstone_audit_entry for PII redaction)
```

**Szenario:** Eine Person macht ihr Löschrecht geltend. Der DPO ruft `POST /api/v1/dpms/audit-log-tombstone` für jede betroffene Zeile auf. `user_email`/`user_name` werden gehasht, der **Klarname bleibt in `entity_title` unverändert und für `admin`/`auditor`/`dpo` über `GET /api/v1/audit-log` lesbar** — dauerhaft und ohne jede vorgesehene Korrekturmöglichkeit. Betroffen ist jede Tabelle mit `name`, `title` oder `email` in der ersten Spaltenebene, insbesondere `user` (Klarname), `stakeholder`, `vendor_contact`, `organization_contact`.

Gleiches gilt für `session_id`, `metadata` und `user_agent` — ebenfalls nicht in der Allowlist, also weder redigierbar noch löschbar. `user_agent` ist ausweislich des PII-Inventars ein Geräte-/Browser-Fingerabdruck.

**Severity: High** — Das einzige vorgesehene Werkzeug zur Erfüllung von Art. 17 im Audit-Trail lässt strukturell einen Klarnamen zurück, und die Architektur schließt eine nachträgliche Behebung aktiv aus.

---

### S07-05 — High — Passwort-Hashes und Bearer-Token werden dauerhaft in den unlöschbaren `audit_log` kopiert

**Evidenz / Reproduktion** (`/work/audit/evidence/S07-repro-user-delete-audit.sql`, Ausgabe in `.out`):

```
 action | entity_title   | changes
 create | Max Mustermann | { "new": { … "email": "max.mustermann@example.org",
                                      "avatar_url": "https://cdn/av/max.png",
                                      "ical_token": null,
                                      "password_hash": "$2b$12$ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghij" … } }
 delete | Max Mustermann | { "old": { … identisch … } }
```

Nach `tombstone_audit_entry(..., 'gdpr_art_17')`:

```
 "password_hash": "$2b$12$ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghij",   <-- unverändert
 "avatar_url":    "https://cdn/av/max.png",                                   <-- unverändert
 "name":  "__tombstoned__:4ccc68e9…",
 "email": "__tombstoned__:bc76d8f3…"
```

Ursache: `redact_pii_jsonb()` redigiert nur eine feste Schlüssel-Allowlist (`email, first_name, last_name, full_name, name, phone, phone_number, mobile, date_of_birth, birthday, birth_date, national_id, tax_id, passport_no, id_number, iban, bic, account_number, address, street, postal_code, city, country_of_birth, ip_address, user_agent`).

**Szenario:** Jedes `INSERT`/`UPDATE` auf `user` — also jede Registrierung und **jede Passwortänderung** — legt den bcrypt-Hash in `audit_log.changes` ab. Bei einer Passwortänderung enthält der UPDATE-Diff sogar alten _und_ neuen Hash (`v_diff := … jsonb_build_object(v_key, jsonb_build_object('old',…,'new',…))`). Ein `auditor` oder `dpo` — Rollen ohne Benutzerverwaltungsrechte — ruft `GET /api/v1/audit-log?entityType=user` ab, exportiert sämtliche jemals vergebenen Passwort-Hashes aller Nutzer der Organisation und knackt sie offline. `DELETE` auf `audit_log` ist per Rule blockiert (`audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING`), `UPDATE` auf `changes` nur über den Tombstone, der `password_hash` nicht kennt.

Gleiches gilt für `user.ical_token` (Bearer-Token für Kalenderfeeds) und — siehe S07-01 — `wb_report.report_token` / `wb_anonymous_mailbox.token`.

**Kompensierende Kontrollen geprüft:** Es gibt keine Spalten-Denylist im `audit_trigger()` und keine RLS auf `audit_log` (`pg_class.relrowsecurity = f`, keine Policy — siehe S07-11).

**Severity: High** — Dauerhafte, nicht rückgängig machbare Offenlegung von Authentifikatoren gegenüber Rollen, die sie nicht benötigen; zugleich Verstoß gegen Art. 5(1)(c) (Datenminimierung) und Art. 32.

---

### S07-06 — High — `redact_pii_jsonb()` erfasst nur oberste JSON-Ebene und eine Schlüsselliste, die den Großteil des PII-Inventars verfehlt

**Evidenz** — `pg_proc.prosrc` von `public.redact_pii_jsonb`:

```plpgsql
IF p_obj IS NULL OR jsonb_typeof(p_obj) <> 'object' THEN RETURN p_obj; END IF;
FOR v_key IN SELECT jsonb_object_keys(p_obj) LOOP
  IF v_key = ANY(v_pii_keys) AND jsonb_typeof(p_obj->v_key) = 'string' THEN …
```

Keine Rekursion, keine Array-Behandlung, nur `string`-Werte, feste Schlüsselliste (26 Namen).

**Abgleich gegen das maschinell erzeugte PII-Inventar** (`/work/audit/evidence/S07-pii-inventar.csv`): 96 Spalten sind direkt identifizierend. Von der Redaktion **nicht** erfasst sind unter anderem:

| Tabelle.Spalte                                                                | Datenart                                |
| ----------------------------------------------------------------------------- | --------------------------------------- |
| `dsr.subject_email`, `dsr.subject_name`                                       | Name/E-Mail der antragstellenden Person |
| `wb_report.contact_email`, `wb_report.report_token`                           | Hinweisgeber-Kontakt und -Token         |
| `stakeholder.contact_email`, `.contact_name`, `.contact_phone`                | Stakeholder-Kontaktdaten                |
| `vendor_contact.email`, `.phone`                                              | Lieferantenkontakt                      |
| `nis2_incident_report.contact_person/_email/_phone`                           | Meldekontakt                            |
| `organization.dpo_name`, `.dpo_email`, `asset.dpo_email`                      | DSB-Kontakt                             |
| `portal_session.external_email`, `.external_name`                             | externe Portalnutzer                    |
| `esg_materiality_vote.voter_name`                                             | Abstimmende Person                      |
| `user.avatar_url`, `user.password_hash`, `user.ical_token`                    | Lichtbild / Authentifikatoren           |
| `scim_sync_log.user_email`, `data_breach_notification.recipient_email`        | E-Mail-Adressen                         |
| alle 418 Freitextspalten (`description`, `notes`, `content`, `resolution`, …) | Klartext mit PII                        |

Zusätzlich: Der `audit_trigger()` legt die Zeile unter `changes.new` bzw. `changes.old` ab; `tombstone_audit_entry` reicht genau diese eine Ebene an `redact_pii_jsonb` weiter. Verschachtelte Strukturen (`notification_preferences`, `metadata`, `affected_systems`, `answers_json`, `completed_lessons`, `templateData`) werden **nie** erreicht — bereits eine Ebene tiefer liegende E-Mail-Adressen überleben.

**Szenario:** Person X stellt einen Löschantrag. Der DPO tombstonet alle 340 `audit_log`-Zeilen, die X betreffen. Zeilen aus `entity_type='dsr'` enthalten weiterhin `changes.new.subject_email = "x@firma.de"` — die Löschanfrage selbst dokumentiert also den Namen und die E-Mail-Adresse der Person dauerhaft und unlöschbar.

**Severity: High** — Der Löschmechanismus deckt einen kleinen Bruchteil des tatsächlichen PII-Bestandes ab; die Nichtabdeckung ist systematisch, nicht Einzelfall.

---

### S07-07 — High — Es gibt keine automatisierte Löschung nach Aufbewahrungsfristen; die Compliance-Doku behauptet das Gegenteil

**Evidenz** — `apps/worker/src/crons/retention-monitoring.ts:26-73` ist der einzige Retention-Job über personenbezogene Daten. Er löscht nichts:

```ts
// Zeile 33
if (monthsSinceCreation >= schedule.retentionPeriodMonths) {
  …
  if (!existing) {
    await db.insert(deletionRequest).values({
      orgId: schedule.orgId, scheduleId: schedule.id,
      title: `Auto-generated: ${schedule.name} - Retention period exceeded`,
      dataCategory: schedule.dataCategory, status: "identified",
    });
```

`deletion_request` ist eine reine Workflow-/Ticket-Tabelle: `deletion_started_at`, `deletion_completed_at`, `verified_by`, `verification_method`, `evidence_description` sind Felder, die ein Mensch ausfüllt. Es gibt keinen Verbraucher, der aus einem `deletion_request` eine Löschung ableitet:

```
$ grep -rn "deletionRequest" apps/ packages/ --include=*.ts | grep -v node_modules | grep -v .test.
apps/web/.../dpms/annual-report/[year]/route.ts        # nur Zählung für den Jahresbericht
apps/web/.../dpms/annual-report/[year]/pdf/route.ts    # dito
apps/web/.../dpms/deletion-requests/route.ts           # CRUD
apps/worker/src/crons/retention-monitoring.ts          # Erzeugung
```

Zweiter Defekt in derselben Datei: die Frist wird gegen `schedule.createdAt` gerechnet, nicht gegen das Alter der Daten —

```ts
// Zeile 28-31
const monthsSinceCreation = Math.floor(
  (now.getTime() - new Date(schedule.createdAt).getTime()) /
    (1000 * 60 * 60 * 24 * 30),
);
```

`retention_schedule` enthält keinerlei Bezug zu konkreten Datensätzen (nur `data_category varchar(50)` und `affected_systems jsonb` als Freitext). Eine Auswertung, _welche_ Zeilen die Frist überschritten haben, ist damit gar nicht möglich. `retention_start_event` wird im Job nicht ausgewertet.

**Doku-Drift** — `docs/compliance/gdpr-readiness-checklist.md`:

> „(e) Speicherbegrenzung | `dpms.retention_policy` + **automatisierte Deletion** | ✅"
> „17 | Loeschung | `dsr.type = 'erasure'` + **automatisierte Data-Deletion** | ✅"
> „**ARCTOS-GDPR-Readiness: ~95 %**"

**Gegenprobe / kompensierende Kontrolle:** `apps/worker/src/crons/document-retention-purge.ts` löscht tatsächlich hart — aber ausschließlich `document`-Zeilen mit `retention_until < now() AND legal_hold = false AND status IN ('archived','expired')` (Zeile 36-46). Das deckt genau eine von 449 Tabellen mit Personenbezug ab. Die Aussage „automatisierte Deletion" ist dadurch nicht getragen.

**Szenario:** Ein Kunde konfiguriert für die Datenkategorie „Bewerberdaten" eine Frist von 6 Monaten. Nach 6 Monaten erscheint täglich ein Ticket und eine Eskalations-Benachrichtigung; gelöscht wird nichts. Bei einer aufsichtsbehördlichen Prüfung ist die im Produkt dokumentierte Frist nachweislich nicht durchgesetzt — und die Produktdokumentation behauptet, sie sei automatisiert.

**Severity: High** — Art. 5(1)(e) wird nicht durchgesetzt, und die Abweichung zwischen zugesicherter und implementierter Funktion ist in einem Compliance-Produkt selbst ein Compliance-Mangel (Verkaufsargument ohne technische Grundlage).

---

### S07-08 — High — Der `actor_hash` im Hinweisgeber-Audit-Log ist mit der daneben gespeicherten `case_id` gesalzen und damit rückrechenbar

**Evidenz** — `whistleblowing_audit_trigger()` (`pg_proc.prosrc`):

```plpgsql
-- Actor identity is HASHED — never store the user_id directly in wb
-- audit log (HinSchG §8 confidentiality requirement)
v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
v_actor_hash := encode(
  digest(COALESCE(v_user_id::text,'system') || '|' || v_case_id::text, 'sha256'), 'hex');
```

`case_id` ist eine eigene Spalte derselben Zeile (`whistleblowing_audit_log.case_id`, `NOT NULL`).

**Szenario:** Wer `whistleblowing_audit_log` lesen darf, liest `case_id` mit. Die Kandidatenmenge sind die UUIDs aus `user` — in einem Mandanten typischerweise 10²–10⁴ Zeilen. `sha256(uid||'|'||case_id)` für jede Kombination reproduziert den `actor_hash` und benennt die handelnde Person exakt. Das trifft insbesondere die Ombudsperson und die hinweisgebende Person selbst, wenn diese als angemeldeter Nutzer agiert (`wb_case_message.author_id`). Der Kommentar „never store the user_id directly … HinSchG §8" beschreibt eine Schutzwirkung, die die Konstruktion nicht hat.

Identisches Muster wie S07-02 (`ip_hash`) und S07-03 (Tombstone-Hash): Hash über ein Merkmal mit kleinem Wertebereich, Salt im Klartext in derselben Zeile.

**Severity: High** — Aufhebung der Pseudonymisierung im am strengsten geschützten Log des Produkts.

---

### S07-09 — High — `whistleblowing_audit_log` hat keine Mandantentrennung und lässt `admin` ausdrücklich lesen

**Evidenz** — Tabellenstruktur (`\d whistleblowing_audit_log`): Spalten `id, case_id, actor_role, actor_hash, entity_type, entity_id, action, changes, metadata, previous_hash, entry_hash, created_at`. **Kein `org_id`.**

Policies:

```
POLICY "wb_audit_log_officer_read" FOR SELECT
  USING (current_setting('app.current_user_role', true)
         = ANY (ARRAY['whistleblowing_officer','ombudsperson','admin']))
POLICY "wb_audit_log_no_direct_write" USING (false) WITH CHECK (false)
```

`pg_class.relforcerowsecurity = f` — RLS greift für den Tabelleneigentümer nicht.

**Widerspruch zur Spezifikation** — `docs/ADR-011-rev2.md:82-83`:

> „RLS-Policy: nur `whistleblowing_officer` und `ombudsperson` haben Read-Access
> Platform-Admin hat keinen Direktzugriff (auch nicht nach Court-Order direkt — nur über dual-control Prozess)"

Implementiert ist das Gegenteil: `admin` steht in der Allowlist. Zusätzlich fehlt jede Org-Bedingung, d. h. ein `whistleblowing_officer` der Organisation A sieht bei einem SQL-Zugriff die Fallhistorie **aller** Mandanten.

**Nicht ausnutzbar über HTTP — mit Vorbehalt:** die in `apps/web/src/app/api/v1/audit-log/route.ts:21` als Kompensation genannte Route `/api/v1/whistleblowing/audit-log` existiert nicht (`ls apps/web/src/app/api/v1/whistleblowing/` → `cases intake intake-codes investigations protection statistics`). Es gibt derzeit **keinen** Lesepfad auf die Tabelle; sie ist faktisch write-only. Deshalb High statt Critical — der Defekt wird in dem Moment kritisch, in dem die im Code angekündigte Route gebaut wird.

**Severity: High** — Fehlende Mandantengrenze auf Art.-9/Art.-10-Daten plus dokumentwidrige Admin-Freigabe; latenter Cross-Tenant-Zugriff.

---

### S07-10 — High — Der Art.-35-DPIA-Automatismus lässt sich vom Aufrufer abschalten; ein Test zementiert das Verhalten

**Evidenz** — `apps/web/src/app/api/v1/processes/[id]/ropa-profile/route.ts:87` (Rollen) und `:108-111`:

```ts
export async function PUT(req, { params }) {
  const ctx = await withAuth("admin", "dpo", "process_owner");
  …
  // Auto-mark requires_dpia when high-risk indicators present
  const highRisk =
    (parsed.data.specialCategories?.length ?? 0) > 0 ||
    parsed.data.thirdCountryTransfers === true;
  const requiresDpia = parsed.data.requiresDpia ?? highRisk;
```

`??` greift nur bei `undefined`. Ein explizites `requiresDpia: false` im Request-Body gewinnt gegen `highRisk` — auch dann, wenn `specialCategories` besetzt ist. Der Folgeblock (`:148`) erzeugt die DSFA nur bei `requiresDpia === true`, also gar nicht.

Der Unit-Test hält dieses Verhalten ausdrücklich als gewollt fest — `apps/web/src/__tests__/lib/ropa-validation.test.ts:128-136`:

```ts
it("respects explicit requiresDpia=false override even for high-risk", () => {
  expect(
    autoDpiaFlag({
      isProcessingActivity: true,
      specialCategories: ["health"],
      requiresDpia: false,
    }),
  ).toBe(false);
});
```

**Szenario:** Ein `process_owner` — eine breit vergebene Fachrolle, nicht der DSB — pflegt ein Prozess-ROPA-Profil mit `specialCategories: ["health"]` und setzt im selben Request `requiresDpia: false`. Es entsteht keine DSFA, keine DSB-Benachrichtigung (`// Notify org DPOs` läuft nur im DSFA-Zweig), kein Blocker, keine Begründungspflicht. Die Art.-35-Schwellenwertprüfung ist damit eine reine Vorbelegung im Frontend, keine Kontrolle.

**Nebenbefund (Testqualität, cross-ref S11):** `ropa-validation.test.ts:9-41` repliziert das Zod-Schema der Route, statt es zu importieren — „Re-derive the schema shape from the route so we don't import the route directly". Drift zwischen Route und Test wird dadurch nie erkannt. Der Test in `dpia-gates.test.ts` importiert dagegen die Produktivfunktion `evaluateDpiaGates` und ist qualitativ in Ordnung.

**Severity: High** — Umgehung einer gesetzlichen Pflichtprüfung (Art. 35 DSGVO) durch eine Fachrolle ohne Kontrolle, Begründung oder Protokollierung des Übersteuerns.

---

### S07-11 — Medium — `audit_log` hat keinerlei Row Level Security

**Evidenz**

```
$ psql -tAc "select relrowsecurity, relforcerowsecurity from pg_class where relname='audit_log'"
f|f
$ psql -tAc "select count(*) from pg_policy where polrelid='audit_log'::regclass"
0
```

Die Mandantentrennung des Audit-Trails beruht ausschließlich auf dem `WHERE org_id = …` in `apps/web/src/app/api/v1/audit-log/route.ts:67-70`. Jeder andere Zugriffsweg — ein Reporting-Query, eine künftige Route, ein Worker-Job, ein direkter SQL-Zugriff — sieht die Audit-Trails aller Mandanten.

Da im `audit_log` ausweislich S07-01 und S07-05 Hinweisgeber-Token, Passwort-Hashes und vollständige Zeilenabbilder aller 508 Tabellen mit Audit-Trigger liegen, ist das die datenschutzrechtlich sensibelste Tabelle der Installation.

**Severity: Medium aus S07-Sicht** (fehlende Tiefenverteidigung, kein heute belegter Ausnutzungspfad über HTTP). Die abschließende Bewertung der RLS-Lücke gehört zu **S01**; dort ist sie ggf. höher einzustufen. Gleiches gilt für `wb_anonymous_mailbox` (`relrowsecurity=f`, keine Policy) — die Tabelle mit dem Hinweisgeber-Mailbox-Token hat als einzige der wb-Tabellen keine RLS.

---

### S07-12 — Medium — HinSchG §11 Abs. 5: keine Löschung der Hinweisgeber-Dokumentation nach drei Jahren

**Evidenz** — Kein Worker-Job berührt Whistleblowing-Daten löschend:

```
$ grep -rn "DELETE FROM\|\.delete(" apps/worker/src/crons/*.ts
analytics-cleanup.ts:14        .delete(auditAnalyticsImport)
dashboard-cleanup.ts:27        DELETE FROM custom_dashboard
document-retention-purge.ts    tx.delete(document) / storage.delete()
eam-suggestion-compute.ts:18   DELETE FROM eam_object_suggestion …
process-mining-conformance.ts  .delete(processConformanceResult)
scim-sync-cleanup.ts:19        DELETE FROM scim_sync_log
$ grep -rn "wbReport\|wbCase" apps/worker/src/
apps/worker/src/crons/wb-deadline-monitor.ts   # nur Fristen-Benachrichtigung
```

`wb_report.token_expires_at` (~6 Monate, gesetzt in `apps/web/src/app/api/v1/portal/report/[orgCode]/route.ts:75`) lässt nur den Zugangstoken verfallen; die Zeile mit `description`, `contact_email`, `ip_hash` und `category` bleibt unbefristet bestehen. `wb_case`, `wb_case_message`, `wb_case_evidence`, `wb_investigation*`, `wb_interview`, `wb_protection_*` haben weder ein Fristfeld noch einen Löschpfad.

**Szenario:** Ein Fall wird 2026 geschlossen. HinSchG §11 Abs. 5 verlangt Löschung der Dokumentation drei Jahre nach Verfahrensabschluss. Die Plattform bietet dafür weder eine Funktion noch einen Job noch ein Feld; die Frist kann nur manuell per SQL durchgesetzt werden — und selbst dann bleiben die Kopien im `audit_log` (S07-01) und im `whistleblowing_audit_log` bestehen, beide append-only.

**Severity: Medium** — gesetzlich vorgeschriebene Löschfrist ohne technische Unterstützung; zusätzlich verschärft durch die append-only-Kopien.

---

### S07-13 — Medium — Kein automatisiertes Auskunfts- oder Übertragbarkeitsverfahren (Art. 15 / Art. 20)

**Evidenz** — Das DSR-Modul ist reine Vorgangssteuerung. `dsr` (`packages/db/src/schema/dpms.ts:353-388`) speichert `requestType`, `status`, `subjectName`, `subjectEmail`, `deadline`, `handlerId`, `notes` — keinen Bezug auf gefundene Datensätze, kein Ergebnisartefakt.

Die Zustandsübergänge machen nichts als den Status setzen. `apps/web/src/app/api/v1/dpms/dsr/[id]/process/route.ts:87-94`:

```ts
await tx.insert(dsrActivity).values({
  activityType: "data_collection",
  details: body.data.note ?? "Processing started — DPO collecting subject data",
```

`apps/web/src/app/api/v1/dpms/dsr/[id]/respond/route.ts:50-58` setzt lediglich `status: "response_sent"` und `respondedAt`.

Es existiert keine Funktion, die zu einer natürlichen Person über die 449 Tabellen mit Personenbezug hinweg zusammenträgt:

```
$ grep -rn "subjectEmail" apps/ packages/ --include=*.ts | grep -v node_modules
# nur: CRUD auf dsr, das Zod-Schema, die State-Machine — keine Suchfunktion
```

**Szenario:** Ein Beschäftigter verlangt Auskunft nach Art. 15. Der DSB muss die 544 Spalten mit Personenreferenz und die 418 Freitextspalten (siehe PII-Inventar) manuell durchsuchen. Bei einer Frist von einem Monat (Art. 12 Abs. 3) ist das ohne Werkzeug praktisch nicht vollständig leistbar; die Vollständigkeit der Auskunft ist weder überprüfbar noch belegbar.

Die Selbsteinschätzung `docs/compliance/gdpr-readiness-checklist.md` führt Art. 15 und Art. 20 als „✅" mit dem Beleg „`dsr.type = 'access'` + Workflow" bzw. „+ Export-Format". Ein Export-Format existiert nicht.

**Severity: Medium** — Ein Workflow-Ticket ist eine zulässige organisatorische Lösung; die Doku behauptet aber eine technische Abdeckung, die nicht existiert. In einem GRC-Produkt, das genau dieses Verfahren für seine Kunden abbilden soll, ist das ein Funktionsversprechen ohne Substanz.

---

### S07-14 — Medium — Massenexport ohne Rollenprüfung, ohne Vier-Augen-Prinzip, mit falschem PII-Kennzeichen; 19 von 25 Export-Routen protokollieren gar nicht

**Evidenz**

_Keine Rollenprüfung_ — `apps/web/src/app/api/v1/export/bulk/route.ts:8` und `apps/web/src/app/api/v1/export/[entityType]/route.ts:17`:

```ts
const ctx = await withAuth(); // keine Rollenliste => jede authentifizierte Rolle, auch `viewer`
```

Gleiches in `apps/web/src/app/api/v1/dpms/ropa/export/route.ts:17` — das vollständige Art.-30-Verzeichnis ist für jeden angemeldeten Nutzer exportierbar.

_Falsches PII-Kennzeichen_ — `export/bulk/route.ts:45-47` und `export/[entityType]/route.ts:66`:

```ts
containsPersonalData: ["ropa_entry", "incident"].includes(entityType),
```

Die exportierbaren Typen sind `risk, control, asset, vendor, contract, incident, process, ropa_entry, bia, finding` (`apps/web/src/lib/import-export/entity-registry.ts:1009-1020`). Personenbezogene Exportspalten enthalten laut derselben Registry u. a. `owner_email` (risk :74, control :218, process :725), `contact_person` (asset :315), `reporter_email` (incident :637), `tax_id`/`legal_name` (vendor :421/:379), `responsible_email` (ropa_entry :855). Ein Export von 5.000 Risiken mit allen Risiko-Eigentümer-E-Mail-Adressen wird als `contains_personal_data = false` protokolliert — genau die Spalte, nach der ein DSB später filtern würde.

_Lückenhafte Protokollierung_ — 6 von 25 Export-Routen schreiben nach `data_export_log`:

```
LOGGED: bcms/bia/export, dpms/ropa/export, export/[entityType], export/bulk, findings/export, risks/export
NICHT : audit-mgmt/…/checklists/[checklistId]/export, compliance/cci/export-pdf,
        dashboards/[id]/export-pdf, dpms/dpia/[id]/export-pdf, eam/bi-export,
        esg/report/[year]/export, export/schedules(+[id]), isms/reviews/[id]/export/pdf,
        isms/soa/export, kris/export, policies/distributions/[id]/export-pdf,
        processes/[id]/export/xml, processes/[id]/raci/export, processes/[id]/ropa/export,
        processes/ropa-export, rcsa/campaigns/[id]/export-pdf,
        risk-quantification/export, translations/export
```

Darunter `dpms/dpia/[id]/export-pdf` (DSFA-Inhalte) und `processes/ropa-export` (ein zweiter, ungeloggter ROPA-Exportpfad neben dem geloggten).

_Protokollierung nicht verbindlich_ — jede Schreiboperation ist in ein `try { … } catch (logErr) { console.error(…) }` gehüllt (`export/bulk/route.ts:37-55`, `export/[entityType]/route.ts:53-74`, `dpms/ropa/export/route.ts:43-58`). Schlägt die Protokollierung fehl, wird der Export trotzdem ausgeliefert. `data_export_log.ip_address` wird von keiner Route gesetzt und ist immer NULL.

_Kein Vier-Augen-Prinzip, keine Mengenbegrenzung im datenschutzrechtlichen Sinn_ — es existiert nur ein technisches `MAX_EXPORT_ROWS = 5000` (`apps/web/src/lib/import-export/export-engine.ts:13`); pro Aufruf, nicht pro Zeitraum. Ein Skript ruft die Route in einer Schleife auf.

**Kompensierende Kontrollen geprüft:** `data_export_log` ist selbst append-only (`data_export_log_no_delete`/`_no_update` Rules) und hat FORCE-RLS mit Org-Isolation — die Protokollierung ist, _wo sie stattfindet_, manipulationssicher. Der Soft-Delete-Filter greift im Export-Engine (`export-engine.ts:137-140`). Das ändert nichts an Reichweite und Kennzeichnung.

**Severity: Medium** — Art. 5(2)/Art. 32: die Nachweisfunktion für Datenabflüsse ist unvollständig und in der Kernaussage (`contains_personal_data`) falsch; jede Rolle kann Personendaten in Massen ausleiten.

---

### S07-15 — Medium — Löschung von Dokumenten nach Aufbewahrungsfrist schreibt den vollständigen Datensatz in den unlöschbaren `audit_log`

**Evidenz** — `apps/worker/src/crons/document-retention-purge.ts:104`:

```ts
await tx.delete(document).where(eq(document.id, doc.id));
```

`document` trägt den generischen Audit-Trigger:

```
$ psql -tAc "select pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid
             where c.relname='document' and not tgisinternal"
CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.document
  FOR EACH ROW EXECUTE FUNCTION audit_trigger()
```

und `audit_trigger()` legt bei DELETE die komplette alte Zeile ab: `v_changes := jsonb_build_object('old', v_old);`.

Nachgewiesen am Beispiel `user` (`/work/audit/evidence/S07-repro-user-delete-audit.sql`): das `DELETE` erzeugt einen `audit_log`-Eintrag mit dem vollständigen Datensatz inklusive `email`, `name`, `avatar_url`, `password_hash`.

Zusätzlich schreibt der Job selbst PII-nahe Daten in den Log (`:81-98`): `user_name = 'system:document-retention-purge'`, `entity_title = doc.title` und `metadata.purgedFiles = [...filePaths]` — Dateipfade, die den ursprünglichen Dateinamen enthalten.

**Szenario:** Die Aufbewahrungsfrist für ein Personaldokument läuft ab, der Job löscht es korrekt aus `document` und aus dem Objektspeicher — und legt im selben Moment eine vollständige Kopie des Datensatzes im append-only `audit_log` ab, wo sie weder gelöscht (`ON DELETE … DO INSTEAD NOTHING`) noch (wegen S07-06) sinnvoll redigiert werden kann. Die Löschung hebt sich selbst auf.

Das ist die allgemeine Form des Zielkonflikts: **jede** Löschung personenbezogener Daten in einer der 508 Tabellen mit Audit-Trigger erzeugt eine unlöschbare Volltextkopie.

**Nebenbefund:** Die physische Dateilöschung läuft nach dem Commit, best effort, mit leerem `catch` (`:119-127`). Schlägt sie fehl (S3 nicht erreichbar, Rechte), bleibt die Datei im Speicher liegen, während der DB-Eintrag verschwunden ist — die Datei ist danach weder auffindbar noch löschbar. Cross-ref S06/S10.

**Severity: Medium** — Die Löschung erfolgt, wird aber im selben Vorgang durch eine unveränderliche Kopie entwertet. Die Severity liegt unter S07-04/S07-06, weil dort die konkrete Unwirksamkeit des Redaktionswerkzeugs bereits belegt ist; dieses Finding beschreibt den systematischen Mechanismus.

---

### S07-16 — Medium — Soft-gelöschte Datensätze werden vom Copilot-RAG-Index eingesammelt und nie entfernt

**Evidenz** — `apps/worker/src/crons/copilot-rag-indexer.ts:22-39`:

```ts
const risks = await db.execute(
  sql`SELECT id, title, description FROM risk WHERE org_id = ${orgId}::uuid LIMIT 1000`,
);

for (const risk of risks) {
  await db.insert(copilotRagSource).values({
      orgId, sourceType: "risk", entityId: r.id,
      title: r.title ?? "Untitled Risk",
      content: `${r.title ?? ""}\n${r.description ?? ""}`,
      lastIndexedAt: new Date(),
    }).onConflictDoNothing();
```

`risk.deleted_at` existiert (`information_schema.columns`), wird hier aber nicht gefiltert. `onConflictDoNothing()` bedeutet zusätzlich: ein einmal indizierter Datensatz wird nie aktualisiert und nie entfernt — es gibt keinen Pfad, der `copilot_rag_source` bereinigt.

`risk.description` ist im PII-Inventar als Freitext mit möglichem Personenbezug klassifiziert (Risikobeschreibungen enthalten regelmäßig Namen von Verantwortlichen, Vorfällen und Betroffenen).

**Szenario:** Ein Risiko wird soft-gelöscht, weil die Beschreibung personenbezogene Angaben enthielt, die dort nicht hingehören. Titel und Beschreibung bleiben unverändert in `copilot_rag_source` stehen.

**Ausnutzbarkeit heute begrenzt:** `copilot_rag_source` wird derzeit nur von `apps/web/src/app/api/v1/copilot/rag/route.ts:37-43` gelesen, und zwar aggregiert (`count`, `max(lastIndexedAt)` je `sourceType`) — die Inhalte werden noch nicht an ein Modell gegeben. `packages/ai/src/embeddings.ts:3-8` hält fest, dass die `embedding`-Spalte nie befüllt wurde. Der Datenbestand entsteht trotzdem und wächst.

**Gegenprobe:** `apps/worker/src/crons/control-embedding-sync.ts:66` filtert korrekt (`isNull(control.deletedAt)`) — der Defekt ist also nicht systemweit, sondern spezifisch für den Copilot-Indexer.

**Severity: Medium** — Art. 17/Art. 5(1)(d): Löschungen und Korrekturen propagieren nicht in einen Sekundärbestand, für den kein Bereinigungspfad existiert.

---

### S07-17 — Medium — Der DPMS-Jahresbericht (Art.-30-Rechenschaftsnachweis) zählt soft-gelöschte Datensätze mit

**Evidenz** — `apps/web/src/app/api/v1/dpms/annual-report/[year]/route.ts`:

```ts
:53  .from(ropaEntry).where(eq(ropaEntry.orgId, ctx.orgId));
:64  .from(dpia).where(eq(dpia.orgId, ctx.orgId));
:141 .where(eq(tia.orgId, ctx.orgId));
```

`ropa_entry`, `dpia` und `tia` haben alle eine `deleted_at`-Spalte; keiner der Zählpfade filtert sie. Dasselbe gilt für die PDF-Variante `.../[year]/pdf/route.ts:353-358`.

**Systematische Erhebung** (`/work/audit/evidence/S07-softdelete-routen.txt`): von 625 Stellen, an denen eine API-Route eine soft-delete-fähige Tabelle liest, fehlt an **101** der `isNull(<tabelle>.deletedAt)`-Filter. Nach Stichprobenprüfung sind viele davon unkritisch (Rücklesen einer gerade geschriebenen Zeile, Nachschlagen der eigenen Organisation per ID) — die SCIM-Route `apps/web/src/app/api/v1/scim/v2/Users/[id]/route.ts` etwa filtert in allen Listen-Queries korrekt (`:38-39`, `:92-93`, `:174-175`, `:279-280`) und wurde als Falsch-Positiv verworfen. Die DPMS-Berichtspfade sind es nicht.

**Szenario:** Eine Organisation löscht 12 veraltete Verarbeitungstätigkeiten. Der Jahresbericht, der gegenüber der Aufsichtsbehörde als Rechenschaftsnachweis dient, weist sie weiterhin aus. Der Bericht bildet nicht den Zustand des Verzeichnisses ab.

**Severity: Medium** — Datenqualitätsdefekt auf einem Artefakt mit Nachweisfunktion.

---

### S07-18 — Medium — Drittlandübermittlung an KI-Anbieter ist weder mandantenseitig steuerbar noch dokumentiert

**Evidenz** — Die Anbieterauswahl ist prozessglobal über Umgebungsvariablen, nicht pro Mandant (`packages/ai/src/router.ts:29-57`):

```ts
export function getAvailableProviders(): AiProvider[] {
  …
  if (process.env.ANTHROPIC_API_KEY) available.push("claude_api");
  if (process.env.OPENAI_API_KEY)    available.push("openai");
  if (process.env.GOOGLE_AI_API_KEY) available.push("gemini");
```

Einbettungen gehen an OpenAI (`packages/ai/src/embeddings.ts:37`, `DEFAULT_EMBEDDING_MODELS.openai = "text-embedding-3-small"`, Endpunkt `https://api.openai.com/v1`).

Es gibt keine Minimierungs-/Redaktionsschicht vor dem Versand:

```
$ grep -rniln "redact|anonymi[sz]e|scrub|mask" packages/ai/src/
# keine Treffer
```

`docs/compliance/gdpr-readiness-checklist.md` listet als Sub-Prozessoren ausschließlich:

> „Rechenzentrum in DE (Hetzner) -> keine Drittlandsuebermittlung
> Sub-Processor: Resend (Email, EU/DE), Backblaze B2 (EU-Region, geplant)"

Anthropic, OpenAI und Google sind nicht genannt, obwohl der Router sie unterstützt und der Embedding-Pfad OpenAI fest verdrahtet als einzigen nicht-lokalen Anbieter führt. Die Aussage „keine Drittlandsuebermittlung" ist damit nur richtig, solange ausschließlich `claude_cli`/`ollama`/`lmstudio` konfiguriert sind — was das Produkt weder erzwingt noch prüft noch dem Mandanten anzeigt.

Ebenfalls nicht in der Liste: **FreeTSA** (`freetsa.org`, `apps/web/src/app/api/v1/audit-log/anchor/route.ts:190`) und die **OpenTimestamps-Calendar-Server** (`:209`). Beide erhalten nur einen Merkle-Root-Hash, also keine personenbezogenen Daten im engeren Sinn — die Verbindung selbst offenbart aber Existenz, Zeitpunkt und Frequenz der Audit-Aktivität eines Mandanten. Als Übermittlung ist das nicht bewertet.

**Szenario:** Ein Kunde konfiguriert ARCTOS mit `OPENAI_API_KEY`, um die Copilot-Funktionen zu nutzen. Ab diesem Moment fließen Risikobeschreibungen, Prozessdokumentationen und DMS-Inhalte — laut PII-Inventar 418 Freitextspalten mit möglichem Personenbezug — an einen US-Verarbeiter. Weder existiert im Produkt ein Schalter je Mandant, noch ein Hinweis in der Oberfläche, noch ein automatischer Eintrag in `ropa_recipient`/`tia`. Der Kunde führt sein eigenes VVT in genau diesem Produkt und bekommt den Transfer nicht angezeigt.

**Severity: Medium** — Art. 44 ff.: fehlende Steuerbarkeit und fehlende Dokumentation eines Drittlandtransfers in einem Produkt, dessen Zweck die Dokumentation ebensolcher Transfers ist. Die Bewertung des KI-Layers im Übrigen (Prompt Injection, Vektor-Isolation, AI Act) liegt bei **S05**.

---

### S07-19 — Low — `WB_ENCRYPTION_KEY`: ein globaler Schlüssel, kein Rotationspfad, keine Bindung des Chiffrats an den Datensatz

**Evidenz** — `packages/shared/src/wb-crypto.ts:13-37`:

```ts
function getKey(): Buffer {
  const keyHex = process.env.WB_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) { throw new Error("SECURITY: …"); }
  return Buffer.from(keyHex, "hex");
}

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  …
}
```

Einzelbefunde:

1. **Ein Schlüssel für alle Mandanten und alle Fälle.** Wer den Schlüssel hat (Betreiber, jeder mit Zugriff auf die Prozessumgebung), entschlüsselt sämtliche Hinweisgeber-Meldungen aller Kunden.
2. **Kein Rotationspfad.** Für `SECRET_ENCRYPTION_KEY` existiert ein `SECRET_ENCRYPTION_KEY_PREVIOUS`-Fallback plus Re-Seal-Skript (`.env.example:113`, `docs/env-vars-reference.md:87`). Für `WB_ENCRYPTION_KEY` gibt es beides nicht — der Schlüssel kann nie gewechselt werden, ohne alle Bestandsdaten unlesbar zu machen.
3. **Keine Additional Authenticated Data.** GCM wird ohne AAD verwendet. Ein Chiffrat ist nicht an seine Zeile gebunden; wer `UPDATE`-Rechte hat, kann das Chiffrat von Meldung A nach Meldung B kopieren, und die Entschlüsselung gelingt unbemerkt.
4. **Doku-Drift.** `docs/env-vars-reference.md:79` beschreibt den Schlüssel als „32-byte hex fuer **Ende-zu-Ende-Verschluesselung der Case-Attachments**". Beides trifft nicht zu: der Server hält den Schlüssel und entschlüsselt selbst (`/portal/mailbox/[token]/route.ts:79` `content: decrypt(m.content)`) — das ist Verschlüsselung at rest, keine Ende-zu-Ende-Verschlüsselung —, und Anhänge werden überhaupt nicht verschlüsselt (siehe S07-20).
5. **Kein Startzeit-Check.** `getKey()` wirft erst beim ersten Aufruf. Eine Installation mit fehlendem Schlüssel startet, das Meldeportal nimmt Meldungen entgegen und quittiert sie mit einem 500 — der Meldekanal ist unbemerkt tot. HinSchG §12 verlangt einen funktionsfähigen internen Meldekanal.

**Severity: Low** — Einzeln jeweils Härtungsdefizite ohne unmittelbaren Angriffspfad; in Summe ein schwaches Schlüsselmanagement für die sensibelste Datenkategorie des Produkts.

---

### S07-20 — High — Hochgeladene Hinweisgeber-Beweismittel werden nie gespeichert; der Dateiname landet stattdessen im allgemeinen `audit_log`

**Evidenz** — `apps/web/src/app/api/v1/portal/mailbox/[token]/evidence/route.ts:78-100` (die Datei hat insgesamt 114 Zeilen; ein Schreibvorgang existiert an keiner Stelle):

```ts
// Read file bytes and compute SHA-256
const buffer = Buffer.from(await file.arrayBuffer());
const sha256 = createHash("sha256").update(buffer).digest("hex");

// Store file (in production: encrypted storage to S3/MinIO)
const storagePath = `wb/${caseRow.orgId}/${caseRow.id}/${Date.now()}-${file.name}`;

const [evidence] = await db.insert(wbCaseEvidence).values({ … storagePath, sha256Hash: sha256, … })
```

```
$ grep -n "storage|writeFile|put(|upload" .../evidence/route.ts
83:  // Store file (in production: encrypted storage to S3/MinIO)
84:  const storagePath = `wb/${caseRow.orgId}/${caseRow.id}/${Date.now()}-${file.name}`;
```

`buffer` wird nach der Hash-Berechnung verworfen. Die Route antwortet mit `201` und liefert `fileName`, `fileSize` und `sha256Hash` zurück — die hinweisgebende Person erhält eine Bestätigung für eine Datei, die es nicht gibt. `wb_case_evidence.is_immutable = true` und ein SHA-256 über einen Inhalt, den niemand mehr hat.

Zugleich wird `fileName` unverändert gespeichert und über den generischen `audit_trigger` auf `wb_case_evidence` in den allgemeinen `audit_log` kopiert (siehe S07-01). Dateinamen aus dem Hinweisgeberkontext („Kuendigung_Mueller_2026.pdf", „Abrechnung_Abteilung_XY.xlsx") sind identifizierend.

**Szenario:** Eine hinweisgebende Person lädt den entscheidenden Beleg hoch, erhält eine Erfolgsmeldung und einen Hash. Die Meldestelle findet später einen Datenbankeintrag ohne Datei. Die Meldung bleibt unbelegt; die Dokumentationspflicht nach HinSchG §11 ist verletzt. Der Dateiname — und damit oft der Hinweis auf die betroffene Person — ist gleichzeitig im organisationsweit lesbaren `audit_log` gelandet.

**Nebenbefund (cross-ref S04/S06):** `storagePath` interpoliert `file.name` ungefiltert. Sobald der Speicherpfad tatsächlich implementiert wird, ist das ein Path-Traversal-Kandidat.

**Severity: High** — Datenverlust auf einem gesetzlich vorgeschriebenen Meldekanal bei gleichzeitiger Erfolgsquittung, kombiniert mit einer Identitätspreisgabe über den Dateinamen.

---

### S07-21 — Low — Die im Code als Kompensation benannte Route `/api/v1/whistleblowing/audit-log` existiert nicht

**Evidenz** — `apps/web/src/app/api/v1/audit-log/route.ts:19-21`:

```ts
// The whistleblowing_audit_log table is a separate relation and is NEVER
// returned by this endpoint — only the whistleblowing role can access it
// via /api/v1/whistleblowing/audit-log.
```

```
$ ls apps/web/src/app/api/v1/whistleblowing/
cases  intake  intake-codes  investigations  protection  statistics
$ grep -rn "whistleblowing_audit_log|whistleblowingAuditLog" apps/ packages/ --include=*.ts | grep -v node_modules
apps/web/src/app/api/v1/audit-log/route.ts:19:  # nur der Kommentar
```

`whistleblowing_audit_log` wird ausschließlich vom DB-Trigger befüllt und von nichts gelesen. Die Meldestelle hat keinen Zugang zu ihrem eigenen Zugriffsprotokoll — die in ADR-011 rev.2 D3 vorgesehene Nachvollziehbarkeit, wer auf einen Fall zugegriffen hat, ist praktisch nicht verfügbar.

**Severity: Low** — Doku-/Kommentar-Drift mit Fehlbedienungsrisiko: der Kommentar suggeriert einer prüfenden Person eine Kontrolle, die nicht existiert (siehe S07-01, wo genau dieser Kommentar die eigentliche Lücke verdeckt).

---

### S07-22 — Low — Rolle `ombudsperson` existiert im Code, aber nicht im Datenbank-Enum

**Evidenz** — `packages/db/src/schema/platform.ts:38-49`:

```ts
export const userRoleEnum = pgEnum("user_role", [
  "admin", "risk_manager", "control_owner", "auditor", "dpo",
  "process_owner", "viewer", "esg_manager", "esg_contributor",
  "whistleblowing_officer", "ombudsperson", …
```

```
$ psql -tAc "select string_agg(enumlabel,', ' order by enumsortorder) from pg_enum e
             join pg_type t on t.oid=e.enumtypid where t.typname='user_role'"
admin, risk_manager, control_owner, auditor, dpo, process_owner, viewer,
whistleblowing_officer, vendor_manager
```

Elf der 20 im Drizzle-Schema deklarierten Rollen fehlen in der migrierten Datenbank (`esg_manager`, `esg_contributor`, `ombudsperson`, `compliance_officer`, `ciso`, `bcm_manager`, `contract_manager`, `quality_manager`, `security_analyst`, `department_head`, `external_auditor`). Alle sechs Hinweisgeber-Fallrouten prüfen jedoch auf `withAuth("whistleblowing_officer", "ombudsperson")` (`cases/route.ts:25`, `cases/[id]/route.ts:23`, `.../resolve:17`, `.../assign:16`, `.../acknowledge:17`, `.../message:17`), und die RLS-Policy `wb_audit_log_officer_read` nennt sie ebenfalls.

**Konsequenz für S07:** Die im ADR-011 rev.2 vorgesehene Zweiteilung des Meldestellen-Zugriffs (interne Beauftragte vs. externe Ombudsperson) ist nicht herstellbar; es bleibt genau eine Rolle. Die von der Rollentrennung erwartete Vertraulichkeitsstufe existiert nicht.

**Severity: Low aus S07-Sicht.** Die Enum-Drift insgesamt (auch `ciso`, `esg_manager`, `bcm_manager` u. a.) gehört zu **S02/S09**; hier wird nur die datenschutzrechtliche Folge festgehalten.

---

### S07-23 — Low — Beschäftigten-Leistungsdaten aus dem Schulungsmodul werden dauerhaft im Audit-Trail gespiegelt

**Evidenz** — `academy_quiz_attempt` (Spalten `user_id, answers_json, score_pct, passed, attempt_number, duration_seconds`), `academy_enrollment` (`user_id, status, progress_pct, completed_lessons`) und `policy_quiz_response` (`selected_option_index, is_correct`) sind personenbezogene Leistungs- und Verhaltensdaten.

Beide Academy-Tabellen tragen einen Audit-Trigger:

```
$ psql: academy_quiz_attempt | academy_quiz_attempt_audit | audit_trigger
        academy_enrollment   | academy_enrollment_audit   | audit_trigger
```

Damit wird jeder Testversuch samt Antworten (`answers_json`), Punktzahl und Bearbeitungsdauer zusätzlich in den append-only `audit_log` kopiert und ist dort für `admin`, `auditor` und `dpo` über `GET /api/v1/audit-log?entityType=academy_quiz_attempt` abrufbar — ohne Aufbewahrungsfrist (kein Purge-Job, siehe S07-12) und ohne wirksame Redaktionsmöglichkeit (S07-06: weder `score_pct` noch `answers_json` stehen in der PII-Schlüsselliste).

Der Kurstyp-Enum enthält u. a. `phishing` (`packages/db/src/schema/academy.ts:33`) — Phishing-Simulationsergebnisse einzelner Beschäftigter sind das klassische Beispiel für mitbestimmungspflichtige Verhaltens- und Leistungskontrolle.

**Szenario:** Ein Beschäftigter fällt dreimal durch die Phishing-Awareness-Prüfung. Ergebnis, Antworten und Bearbeitungsdauer liegen unbefristet im Audit-Trail und sind für jede Person mit `auditor`-Rolle einsehbar. Eine Löschung nach Zweckerfüllung ist technisch nicht vorgesehen.

**Severity: Low** — Kein Angriffspfad, aber ein Konfigurations- und Aufbewahrungsdefizit mit Relevanz für § 26 BDSG und § 87 Abs. 1 Nr. 6 BetrVG, das bei Betriebsratsbeteiligung regelmäßig zum Rollout-Blocker wird.

---

### S07-24 — Low — Zugriffs-, Sitzungs- und Signaturprotokolle mit IP-Adresse und User-Agent unterliegen keiner Löschfrist

**Evidenz** — Tabellen mit `ip_address` und/oder `user_agent` laut PII-Inventar: `access_log`, `audit_log`, `audit_sign_off`, `consent_record`, `data_export_log`, `dd_session.ip_address_log`, `document_signature`, `mobile_session`, `policy_acknowledgment`, `portal_audit_trail`, `portal_session`, `process_sign_off`, `sovereignty_audit_log`, `vendor_sign_off`.

Kein einziger Worker-Job berührt eine davon löschend (vollständige Liste der löschenden Jobs siehe S07-12). `access_log` speichert zusätzlich `email_attempted`, `geo_location` und `failure_reason` — also auch fehlgeschlagene Anmeldeversuche mit E-Mail-Adresse, unbefristet.

**Severity: Low** — Art. 5(1)(e): unbefristete Vorhaltung von Telemetrie mit Personenbezug. Kein Angriffspfad, aber ein Aufbewahrungsdefizit, das bei jeder Datenschutzprüfung auffällt.

---

### S07-25 — Low — `search_index` hält Volltexte soft-gelöschter Datensätze vor und wird von nichts genutzt

**Evidenz** — Keine der vier Sync-Funktionen berücksichtigt `deleted_at`:

```
sync_risk_search_index      -> deleted_at beruecksichtigt: NEIN
sync_control_search_index   -> deleted_at beruecksichtigt: NEIN
sync_document_search_index  -> deleted_at beruecksichtigt: NEIN
sync_process_search_index   -> deleted_at beruecksichtigt: NEIN
```

`sync_document_search_index` behandelt nur das harte `DELETE`:

```plpgsql
IF TG_OP = 'DELETE' THEN
  DELETE FROM search_index WHERE entity_type = 'document' AND entity_id = OLD.id;
  RETURN OLD;
END IF;
INSERT INTO search_index (…, content, …)
VALUES (NEW.org_id, 'document', NEW.id, NEW.title,
        coalesce(NEW.title,'') || ' ' || coalesce(NEW.content,''), …)
```

Ein Soft-Delete ist ein `UPDATE` und fällt in den `INSERT … ON CONFLICT DO UPDATE`-Zweig — der Volltext wird also beim Löschen sogar noch aktualisiert.

**Kompensierende Kontrolle geprüft:** `apps/web/src/app/api/v1/search/route.ts` liest nicht aus `search_index`, sondern joint die Basistabellen und filtert dort korrekt (`:57` `isNull(document.deletedAt)`, `:93` `control`, `:129` `risk`). `search_index` hat außerhalb der Trigger keinen Leser:

```
$ grep -rn "search_index|searchIndex" apps/ packages/ --include=*.ts | grep -v node_modules
apps/web/.../audit-log/route.ts:92        # nur als ausgeblendeter entity_type
apps/web/.../audit-log/integrity/route.ts:93  # nur ein Kommentar
apps/worker/tests/helpers/db-exports.ts   # Testhilfe
```

**Severity: Low** — Keine Offenlegung über einen erreichbaren Pfad; verbleibt als Datenminimierungs- und Löschvollständigkeitsdefekt (Schattenkopie ohne Zweck und ohne Bereinigung).

---

### S07-26 — Low — Der Export-Filter interpoliert Query-Parameter-Namen ungefiltert in SQL

**Evidenz** — `apps/web/src/lib/import-export/export-engine.ts:142-155`:

```ts
for (const [key, value] of Object.entries(filters)) {
  …
  // Sanitize filter values to prevent SQL injection
  const sanitizedValue = value.replace(/'/g, "''");
  conditions.push(`"${key}" = '${sanitizedValue}'`);
}
const whereClause = conditions.join(" AND ");
const result = await db.execute(sql.raw(
  `SELECT * FROM "${def.tableName}" WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${MAX_EXPORT_ROWS}`));
```

Der _Wert_ wird escaped, der _Schlüssel_ nicht. `key` stammt direkt aus `url.searchParams` (`apps/web/src/app/api/v1/export/[entityType]/route.ts:41-47`). Ein Anführungszeichen im Parameternamen bricht aus der Bezeichner-Quotierung aus.

**Datenschutz-Relevanz:** Der Aufruf läuft ohne Rollenprüfung (S07-14) und die erste Bedingung ist `org_id = '<ctx.orgId>'` — eine erfolgreiche Injektion in den `WHERE`-Ausdruck hebt die Mandantengrenze auf und exportiert Personendaten fremder Mandanten.

**Severity: Low aus S07-Sicht — mit ausdrücklichem Vorbehalt.** Die Bewertung von Injektionspfaden liegt bei **S04**; dort ist dieses Finding nach vollständiger Ausnutzbarkeitsprüfung voraussichtlich deutlich höher einzustufen. Es wird hier nur festgehalten, weil es im S07-Beweispfad (Massenexport personenbezogener Daten) aufgetreten ist.

---

### S07-27 — Info — `data_export_log` selbst ist sauber gehärtet

**Evidenz** — Zur Abgrenzung gegenüber S07-14 festgehalten, was _funktioniert_:

```
Policies (forced row security enabled):
    POLICY "data_export_log_org_isolation"
      USING (((org_id)::text = current_setting('app.current_org_id'::text, true)))
Rules:
    data_export_log_no_delete AS ON DELETE TO data_export_log DO INSTEAD NOTHING
    data_export_log_no_update AS …
```

FORCE-RLS, Org-Isolation, append-only per Rule, Indizes auf `(org_id, created_at)` und `user_id`. Wo protokolliert wird, ist der Eintrag nicht manipulierbar. Der Mangel liegt ausschließlich in der Abdeckung und im Inhalt (S07-14), nicht im Schutz der Tabelle.

---

### S07-28 — Info — Der Zielkonflikt Art. 17 vs. Unveränderlichkeit ist begonnen, aber nicht zu Ende geführt

Zur Einordnung der Findings S07-03 bis S07-06 und S07-15, weil dieser Punkt für die Verkäuflichkeit des Produkts der entscheidende ist.

**Was vorhanden ist:** ADR-011 rev.2 §D4 benennt den Konflikt ausdrücklich, wählt einen anerkannten Lösungsansatz (Tombstoning mit erhaltenem `entry_hash`) und begründet ihn. Der Ansatz ist implementiert: Spalten `pii_tombstoned_at`/`pii_tombstone_reason`, SQL-Funktion `tombstone_audit_entry`, Guard-Trigger, API-Route mit Rollenschutz und Meta-Audit. `compute_audit_hash_v3` bezieht `user_email`/`user_name`/`entity_title`/`ip_address` bewusst nicht in den Hash ein, damit die Redaktion die Kette nicht bricht. Das ist ein durchdachter Entwurf, und er ist mehr, als die meisten Produkte dieser Klasse vorweisen.

**Was fehlt, damit er trägt:**

| Lücke                                                                                                                                                                                                                                                                                     | Finding        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Der Tombstone-Key aus dem ADR existiert nicht; als Salt dient der in derselben Zeile lesbare `entry_hash`                                                                                                                                                                                 | S07-03         |
| `entity_title` — die Spalte, die den Klarnamen trägt — ist von der Redaktion ausgenommen und per Guard unveränderbar                                                                                                                                                                      | S07-04         |
| Die Redaktion greift nur auf oberster JSON-Ebene und nur für 26 feste Schlüsselnamen                                                                                                                                                                                                      | S07-06         |
| Nur `audit_log` ist abgedeckt; `whistleblowing_audit_log`, `access_log`, `portal_audit_trail`, `sovereignty_audit_log`, `abac_access_log` haben keinen Tombstone                                                                                                                          | —              |
| Kein Mengen-Einstiegspunkt: die Route tombstonet genau eine Zeile per UUID. Ein Löschantrag betrifft typischerweise hunderte Zeilen, die zuerst gefunden werden müssen (S07-13)                                                                                                           | S07-13         |
| Der im ADR beschriebene Legal-Hold-Vorrang ist nicht implementiert — es gibt keine `legal_hold_id` auf `audit_log` und keine Prüfung in `tombstone_audit_entry`; `legal_hold` existiert nur auf `document`. ADR-011 rev.2 führt „R5 Legal Hold Integration" selbst als deferred (Phase 3) | —              |
| Backups, Objektspeicher und Suchindex sind im ADR nicht adressiert                                                                                                                                                                                                                        | S07-25, S07-15 |
| Es existiert keine Dokumentation, die einem Kunden oder einer Aufsichtsbehörde erklärt, wie ARCTOS Art. 17 im Audit-Trail auflöst. Weder `docs/compliance/gdpr-readiness-checklist.md` noch die ADR-Index-Zeile erwähnen den Tombstone; die Checkliste führt Art. 17 schlicht als „✅"    | —              |

**Bewertung:** Der Konflikt ist _architektonisch_ erkannt und _teilweise_ gelöst, aber weder vollständig implementiert noch nach außen dokumentiert. Für eine Due Diligence oder eine Ausschreibung bedeutet das: auf die Frage „wie erfüllen Sie Art. 17 bei unveränderlichen Logs?" gibt es heute keine belastbare Antwort, obwohl die Vorarbeit dafür zu 70 % geleistet ist. Das ist kein technisches, sondern ein Fertigstellungs- und Dokumentationsproblem — und in dieser Form das größte einzelne Verkaufshindernis des Moduls.

---

### S07-29 — Info — Selbsteinschätzung „GDPR-Readiness ~95 %" ist durch die Findings nicht getragen

`docs/compliance/gdpr-readiness-checklist.md` weist 32 von 37 geprüften Anforderungen als „✅" aus und schließt mit „**ARCTOS-GDPR-Readiness: ~95 %** fuer Tenant-Use-Case". Der Abgleich mit den Findings dieses Streams:

| Position der Checkliste                                       | Bewertung dort | Befund S07                                                         |
| ------------------------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| Art. 5(1)(e) Speicherbegrenzung + „automatisierte Deletion"   | ✅             | S07-07: keine automatisierte Löschung; S07-12, S07-24              |
| Art. 5(1)(f) Integrität/Vertraulichkeit — „Audit-Chain + RLS" | ✅             | S07-01, S07-11: `audit_log` ohne RLS, HinSchG-Trennung aufgehoben  |
| Art. 15 Auskunft                                              | ✅             | S07-13: reines Ticket, kein Sammelmechanismus                      |
| Art. 17 Löschung + „automatisierte Data-Deletion"             | ✅             | S07-03/04/06/15: Redaktion unwirksam, kein Löschjob                |
| Art. 20 Übertragbarkeit „+ Export-Format"                     | ✅             | S07-13: kein Export-Format vorhanden                               |
| Art. 25 Privacy by Design/Default                             | ✅             | S07-05: Passwort-Hashes im Log; S07-10: Art.-35-Gate übersteuerbar |
| Art. 35 DSFA + Schwellenwert-Trigger                          | (implizit ✅)  | S07-10: Trigger vom Aufrufer abschaltbar                           |
| Art. 44–49 „keine Drittlandsuebermittlung"                    | ✅             | S07-18: KI-Anbieter nicht gelistet, nicht steuerbar                |

Von den acht geprüften Positionen hält keine der Prüfung stand. Die Checkliste ist zudem auf Stand 2026-04-18, also viereinhalb Monate älter als der geprüfte Commit.

**Severity: Info** — kein eigener technischer Defekt, aber der Grund, warum die vorstehenden Findings in einer Kundenprüfung besonders schwer wiegen: das Produkt bewertet sich in seinem eigenen Kerngegenstand nachweislich zu gut. Cross-ref S14 (Doku-Drift).

---
