# EU-DSGVO (VO 2016/679) — ARCTOS-Readiness

_Stand: 2026-09-01 · Grundlage: Audit ARCTOS-FULL-2026-08-31, Stream S07, und die
Remediation WP8. Vorversion: 2026-04-18._

> **Abgrenzung.** Diese Liste ist eine **technische** Bestandsaufnahme der
> Implementierung gegen den Wortlaut der DSGVO. Sie ist keine Rechtsberatung und
> ersetzt keine datenschutzrechtliche Würdigung durch einen Rechtsbeistand oder die
> zuständige Aufsichtsbehörde. Sie sagt, was das Produkt technisch leistet — nicht,
> ob eine konkrete Verarbeitung rechtmäßig ist.

## Warum diese Datei neu geschrieben wurde

Die Vorversion schloss mit „**ARCTOS-GDPR-Readiness: ~95 %**" und wies 32 von 37
Anforderungen als erfüllt aus. Der Audit hat acht dieser Positionen einzeln
geprüft; **keine hielt der Prüfung stand**. Die Abweichungen waren nicht klein:

| Position der Vorversion                           | dort | tatsächlich (Stand 2026-08-31)                                                                                                                |
| ------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Art. 5(1)(e) „automatisierte Deletion"            | ✅   | Der einzige Retention-Job erzeugte Tickets und löschte nichts; die Frist lief gegen das Anlagedatum der Regel statt gegen das Alter der Daten |
| Art. 5(1)(f) „Audit-Chain + RLS"                  | ✅   | `audit_log` hatte keinerlei RLS; der Hinweisgeberkanal war über einen zweiten Trigger org-weit lesbar                                         |
| Art. 15 Auskunft                                  | ✅   | reines Workflow-Ticket, kein Sammelmechanismus über die 449 Tabellen mit Personenbezug                                                        |
| Art. 17 Löschung „+ automatisierte Data-Deletion" | ✅   | Redaktion unwirksam (26 von 96 direkt identifizierenden Spalten, keine Rekursion), Klarname per Guard unveränderbar, kein Löschjob            |
| Art. 20 Übertragbarkeit „+ Export-Format"         | ✅   | ein Export-Format existierte nicht                                                                                                            |
| Art. 25 Privacy by Design                         | ✅   | Passwort-Hashes wurden bei jeder Registrierung in den unlöschbaren Log kopiert                                                                |
| Art. 35 Schwellenwert-Trigger                     | ✅   | vom Aufrufer per `requiresDpia: false` abschaltbar                                                                                            |
| Art. 44–49 „keine Drittlandsübermittlung"         | ✅   | drei US-KI-Anbieter nicht gelistet, nicht steuerbar, nicht angezeigt                                                                          |

**Legende ab hier:** ✅ technisch umgesetzt und durch einen Test belegt ·
◑ teilweise, Einschränkung genannt · ☐ nicht umgesetzt · ⚙ organisatorisch,
nicht technisch erzwungen

---

## Art. 5 — Grundsätze

| Grundsatz                      | ARCTOS-Support                                                                                                                    | Status                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| (a) Rechtmäßigkeit             | `ropa_entry.legal_basis` + Katalog #26                                                                                            | ✅                                                               |
| (b) Zweckbindung               | `ropa_entry.processing_purpose`                                                                                                   | ✅                                                               |
| (c) Datenminimierung           | Katalog #25 + `ropa_data_category`; Authentifikatoren werden beim Schreiben aus dem Audit-Log entfernt (`audit_sensitive_column`) | ◑ — die Kataloge sind Dokumentation, die Scrub-Liste ist wirksam |
| (d) Richtigkeit                | `dsr`-Berichtigungsvorgang; Sekundärbestände (`search_index`, `copilot_rag_source`) folgen jetzt dem Soft-Delete                  | ✅                                                               |
| (e) Speicherbegrenzung         | `retention_binding` + `retention_purge_table()` + drei Cron-Jobs; jeder Lauf wird in `retention_run_log` belegt                   | ◑ — **siehe Einschränkung unten**                                |
| (f) Integrität/Vertraulichkeit | Hash-Kette v4 mit externem HMAC-Siegel, FORCE-RLS auf `audit_log`, HinSchG-Trennung durchgesetzt                                  | ✅                                                               |
| Art. 5(2) Rechenschaft         | `audit_log`, `access_log`, `data_export_log`, `retention_run_log`, `gdpr_erasure_log`                                             | ✅                                                               |

**Einschränkung zu (e):** Die Fristen werden für die eingetragenen
`retention_binding`-Zeilen durchgesetzt (Zugriffs- und Sitzungsprotokolle,
Exportprotokoll, Benachrichtigungen, Schulungsergebnisse, Hinweisgeber-
Dokumentation, Dokumente). Eine Datenkategorie **ohne** Bindung kann die Plattform
nicht automatisch räumen — sie erzeugt dann ein Ticket und benennt den Grund im
Klartext („no retention_binding"). Das ist der ehrliche Rest, kein Automatismus.
**Zum Auslöser:** die Jobs sind inzwischen im Scheduler eingetragen
(`retention-monitoring` 01:45 UTC, `retention-access-logs` 02:00,
`retention-whistleblowing` 02:40, `document-retention-purge` 01:30). Damit ist
die Frist nicht mehr nur konfigurierbar, sondern wird durchgesetzt —
vorausgesetzt, der Scheduler läuft im Betrieb tatsächlich.

## Art. 6/7 — Rechtsgrundlagen und Einwilligung

| Anforderung                     | ARCTOS-Support                                   | Status |
| ------------------------------- | ------------------------------------------------ | ------ |
| Art. 6 Rechtsgrundlagen (a)–(f) | `ropa_entry.legal_basis`                         | ✅     |
| 7(1) Nachweis                   | `consent_record.consent_proof_ref`               | ✅     |
| 7(3) Widerruf                   | `consent_record.withdrawn_at` + Widerrufsvorgang | ✅     |
| 7(4) Koppelungsverbot           | in der Zweckanalyse dokumentiert                 | ⚙      |

## Art. 13/14 — Informationspflichten

`data_subject_information` mit Vorlagen-Engine, PDF-Erzeugung und Versionierung. ✅

## Art. 15–22 — Betroffenenrechte

| Art. | Recht                       | ARCTOS-Support                                                                                                                                                               | Status                                         |
| ---- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 15   | Auskunft                    | `POST/GET /api/v1/dpms/dsr/:id/collect` → `dsr_collect_subject_data()` sammelt über ein aus dem Datenbankkatalog erzeugtes Fundstellenregister; Ausgabe als JSON-Anlage      | ✅                                             |
| 16   | Berichtigung                | `dsr.request_type = 'rectification'`                                                                                                                                         | ⚙ — Vorgang, die Änderung erfolgt im Fachmodul |
| 17   | Löschung                    | `POST /api/v1/dpms/dsr/:id/erase` → `gdpr_erase_subject()`: Fachdaten anonymisiert, Zugangsdaten vernichtet, Sitzungen gelöscht, Audit-Trail redigiert, Nachweis geschrieben | ✅ — siehe `gdpr-erasure-vs-immutability.md`   |
| 18   | Einschränkung               | `dsr.request_type = 'restriction'`                                                                                                                                           | ⚙                                              |
| 19   | Mitteilung an Empfänger     | `dsr` + `ropa_recipient`                                                                                                                                                     | ⚙ — manuell                                    |
| 20   | Übertragbarkeit             | `GET …/collect?scope=portability` — JSON, ohne Protokolle und abgeleitete Bewertungen                                                                                        | ✅                                             |
| 21   | Widerspruch                 | `dsr.request_type = 'objection'`                                                                                                                                             | ⚙                                              |
| 22   | Automatisierte Entscheidung | EU-AI-Act-Modul (Katalog #13)                                                                                                                                                | ◑ — Dokumentation, kein technischer Blocker    |

**Zwei Einschränkungen, die zur Auskunft gehören:**

1. **Identitätsprüfung ist Voraussetzung.** `collect` und `erase` verweigern die
   Arbeit, solange `dsr.verified_at` leer ist (Art. 12 Abs. 6). Eine Auskunft an
   die falsche Person ist selbst eine Datenschutzverletzung.
2. **Hinweisgeberdaten sind ausgenommen.** `wb_*` steht nicht im
   Auskunfts-Register — Art. 15 Abs. 4 DSGVO und §§ 8, 9 HinSchG. Die Antwort
   weist das ausdrücklich aus (`excluded`), statt es zu verschweigen. Auskünfte im
   Meldeverfahren laufen über die Meldestelle.

## Art. 25 — Privacy by Design und by Default

| Anforderung                              | ARCTOS-Support                                                                                         | Status                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Keine Authentifikatoren im Protokoll     | `audit_scrub_changes()` + `audit_sensitive_column`; Bestandszeilen einmalig bereinigt (Migration 0428) | ✅                                      |
| Pseudonymisierung nach Stand der Technik | HMAC unter einem Schlüssel außerhalb der Datenbank für Melder-IP, Akteur im Fachlog und Tombstone-Hash | ✅                                      |
| Voreinstellungen                         | `module_config` default-false für sensible Module                                                      | ✅                                      |
| TOMs                                     | Katalog #24 (56 Einträge)                                                                              | ⚙ — Katalog, keine technische Kontrolle |

## Art. 28 — Auftragsverarbeiter

| Anforderung                  | ARCTOS-Support                        | Status                      |
| ---------------------------- | ------------------------------------- | --------------------------- |
| 28(1) Auswahl                | `vendor_due_diligence` + Scorecards   | ✅                          |
| 28(3) Vertragsmindestinhalte | `contract` + `contract_obligation`    | ◑ — AVV-Vorlagen-Seed fehlt |
| 28(4) Sub-Prozessor-Kette    | `vendor.sub_processor` + Freigabelauf | ✅                          |

## Art. 30 — Verzeichnis der Verarbeitungstätigkeiten

`ropa_entry` + `ropa_data_category` + `ropa_recipient`, Export als CSV/XLSX
(`GET /api/v1/dpms/ropa/export`, Rollen `admin`/`dpo`/`compliance_officer`/
`auditor`/`external_auditor`, jeder Aufruf in `data_export_log` belegt). ✅

Der DPMS-Jahresbericht zählt seit dieser Remediation keine soft-gelöschten
Verzeichniseinträge mehr mit — vorher wies der Rechenschaftsnachweis gelöschte
Verarbeitungen weiter aus.

## Art. 32 — Sicherheit der Verarbeitung

| Maßnahme                                      | Stand                                                               |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Verschlüsselung in transit                    | ✅                                                                  |
| Verschlüsselung der Hinweisgeberdaten at rest | ✅ AES-256-GCM, an die Zeile gebunden (AAD), mit Rotationspfad      |
| Verschlüsselung der übrigen Daten at rest     | ⚙ — Speicher-/Backup-Ebene, nicht im Prüfumfang dieses Audits       |
| Mandantentrennung                             | ✅ FORCE-RLS, Systemtest über alle mandantenbezogenen Objekte (WP2) |
| Manipulationserkennung im Protokoll           | ✅ Hash-Kette v4 + HMAC-gesiegelte Anker (WP4)                      |
| Wiederherstellbarkeit                         | ⚙ — Runbook vorhanden, ein durchgeführter Restore-Drill fehlt       |

## Art. 33/34 — Datenschutzverletzungen

`data_breach` mit 72-Stunden-Zähler, Pflichtfeldern und Benachrichtigungsablauf. ✅
Der Versandweg selbst hängt am E-Mail-Dienst; dessen Zuverlässigkeit ist Gegenstand
von S10-03/-04 (WP9).

## Art. 35 — Datenschutz-Folgenabschätzung

`dpia` + `dpia_risk` + `dpia_measure`, Schwellenwerte über Katalog #10. ✅

Der Automatismus ist seit dieser Remediation **nicht mehr abschaltbar**: liegen
besondere Kategorien oder eine Drittlandübermittlung vor, wird `requires_dpia`
gesetzt, und ein `requiresDpia: false` im Request wird ignoriert und protokolliert.
Eine freiwillige DSFA ohne Indikator bleibt möglich.

## Art. 37 — Datenschutzbeauftragte

Rolle `dpo` im RBAC, zweite Verteidigungslinie. ✅

## Art. 44–49 — Drittlandübermittlung

| Instrument                                   | ARCTOS-Support                      | Status              |
| -------------------------------------------- | ----------------------------------- | ------------------- |
| Angemessenheitsbeschluss                     | `ropa_recipient.adequacy_decision`  | ✅                  |
| Standardvertragsklauseln                     | `contract.scc_version`              | ✅                  |
| TIA                                          | `tia`                               | ✅                  |
| BCR                                          | `vendor.binding_corporate_rules_id` | ◑ — nur Kennzeichen |
| **Steuerbarkeit der KI-Anbieter je Mandant** | —                                   | ☐ **offen**         |

**Klarstellung, die die Vorversion nicht hatte:** die Aussage „keine
Drittlandsübermittlung" trifft nur zu, solange ausschliesslich lokale Modelle
konfiguriert sind. Der AI-Router unterstützt Anthropic, OpenAI und Google; der
Einbettungspfad ist auf OpenAI festverdrahtet. Die Auswahl erfolgt prozessglobal
über Umgebungsvariablen, nicht je Mandant, und es gibt keine Redaktionsschicht vor
dem Versand. Vollständige Aufstellung:
[`subprocessors-and-third-country-transfers.md`](./subprocessors-and-third-country-transfers.md).
Die technische Behebung (Anbieter je Mandant, fail-closed statt Cloud-Rückfall)
liegt bei S05-01/-03/-22.

---

## HinSchG (nationale Ergänzung, kein DSGVO-Artikel)

| Anforderung                           | ARCTOS-Support                                                                                                                                                       | Status |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| § 8 Vertraulichkeit der Identität     | Kein `wb_*`-Vorgang schreibt mehr in den org-weiten `audit_log`; der vertrauliche Kanal führt ein eigenes, mandantengetrenntes Log mit HMAC-pseudonymisiertem Akteur | ✅     |
| § 10 Dokumentation                    | `whistleblowing_audit_log`, jetzt über `GET /api/v1/whistleblowing/audit-log` auch für die Meldestelle lesbar                                                        | ✅     |
| § 11 Abs. 5 Löschung nach drei Jahren | `whistleblowing_retention_purge()` + `whistleblowing_orphan_report_purge()`, Cron `retention-whistleblowing`                                                         | ✅     |
| § 12 Funktionsfähiger Meldekanal      | Portal weist bei fehlender Schlüsselkonfiguration mit 503 ab, statt Meldungen zu verlieren                                                                           | ✅     |
| Beweismittel werden verwahrt          | Upload speichert erst, verifiziert, dann entsteht die Datenbankzeile; bei Speicherfehler kein 201                                                                    | ✅     |

---

## Offene Punkte

| Punkt                                                 | Art                         | Anmerkung                                                                                                                                                                            |
| ----------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scheduler im Betrieb überwachen                       | betrieblich                 | Die vier Retention-Jobs sind eingeplant und werfen bei Fehlern, statt grün zu melden. Ein stiller Ausfall des Schedulers ist eine nicht durchgesetzte Frist und braucht einen Alarm. |
| `PII_PSEUDONYM_KEY` in der Produktionsumgebung setzen | betrieblich                 | ohne ihn greift der Installationsschlüssel in der Datenbank — schwächer, aber nicht wirkungslos                                                                                      |
| `audit_log.metadata` ist nicht redigierbar            | technisch, Restrisiko       | Hashformel v4, siehe `gdpr-erasure-vs-immutability.md` §7                                                                                                                            |
| Backups nach einer Löschung                           | betrieblich                 | Löschung wirkt endgültig, sobald das letzte Backup aus der Zeit vor dem Antrag abgelaufen ist                                                                                        |
| Legal Hold gegen Art. 17                              | technisch, zurückgestellt   | ADR-011 rev.2 „R5", heute organisatorisch geprüft                                                                                                                                    |
| KI-Anbieterwahl je Mandant                            | technisch                   | S05-01/-03/-22 (WP6)                                                                                                                                                                 |
| 19 Exportrouten ohne Nachweis                         | technisch                   | zentraler Helfer `lib/export-audit.ts` steht bereit, Einbau je Route offen                                                                                                           |
| AVV-Vorlagenpaket, BCR-Upload, Art.-19-Automatik      | Inhalt/Komfort              | wie in der Vorversion                                                                                                                                                                |
| Cookie-/Tracker-Discovery                             | außerhalb des Produktzwecks | eigene Werkzeugklasse                                                                                                                                                                |

## Zusammenfassung

Eine Prozentzahl steht hier bewusst nicht mehr. Sie hat in der Vorversion genau
das getan, was der Audit ihr vorwirft: eine Genauigkeit vorgetäuscht, die die
Prüfung nicht trägt, und die offenen Punkte in einer Restgröße verschwinden lassen.

Was sich sagen lässt: **die Betroffenenrechte nach Art. 15, 17 und 20 sind seit
dieser Remediation technisch umgesetzt und durch Tests belegt** — ein Löschantrag
beendet den Personenbezug über alle registrierten Schemas hinweg, und die
Audit-Kette verifiziert danach weiter. **Die Speicherbegrenzung nach Art. 5(1)(e)
ist gebaut und eingeplant; ihre Wirksamkeit hängt jetzt am Betrieb des
Schedulers, nicht mehr an fehlendem Code.** **Die
Vertraulichkeit des Meldekanals nach HinSchG § 8 ist hergestellt.** Offen und
ausdrücklich als offen geführt bleiben die Steuerbarkeit der KI-Anbieter, das
Backup-Verhalten und der Legal Hold.

### ARCTOS als Verarbeiter

- AVV mit dem Auftraggeber separat vertraglich geregelt
- Rechenzentrum in DE (Hetzner)
- Sub-Prozessoren und mögliche Drittlandtransfers: siehe
  [`subprocessors-and-third-country-transfers.md`](./subprocessors-and-third-country-transfers.md)
  — die frühere pauschale Aussage „keine Drittlandsübermittlung" war unvollständig
- Vorfallprozess: `SECURITY.md`, Integritätsnachweis über
  `GET /api/v1/audit-log/integrity`

### Belege

Die technischen Zusagen dieser Liste sind reproduzierbar:

- `packages/db/tests/integration/gdpr-privacy.test.ts` (37 Prüfungen: HinSchG-Trennung, Pseudonymisierung, Art.-17-Löschung mit Kettenprüfung, Retention, Vier-Augen-Export)
- `packages/shared/tests/wb-crypto.test.ts` (Wörterbuchangriff auf die Melder-IP, AAD-Bindung, Schlüsselrotation)
- `apps/web/src/__tests__/api/export-bulk-four-eyes.test.ts` (Rolle, Mengenbegrenzung, Vier-Augen, kein Export ohne Nachweis)
- `apps/web/src/__tests__/lib/export-audit.test.ts` (PII-Kennzeichen aus der Entity-Registry statt aus einer Literalliste)
- `apps/web/src/__tests__/lib/ropa-validation.test.ts` (Art.-35-Schwelle nicht übersteuerbar)
- `packages/auth/tests/bulk-export-guard.test.ts` (Entscheidungsfunktion des Massenexports)
