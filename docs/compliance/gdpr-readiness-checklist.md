# EU GDPR (Regulation 2016/679) — ARCTOS Readiness Checklist

_Stand: 2026-04-18_

GDPR-relevante Artikel fuer ARCTOS **als Verarbeiter** (auf eigener Infrastruktur verarbeitete Tenant-Daten) und **als Plattform fuer Verantwortliche** (Tenant fuehrt seine GDPR-Dokumentation via ARCTOS).

**Legende**: ✅ abgedeckt · ◑ teilweise · ☐ Luecke

## Art. 5 — Grundsaetze der Verarbeitung

| Grundsatz                       | ARCTOS-Support                                               | Status |
| ------------------------------- | ------------------------------------------------------------ | ------ |
| (a) Rechtmaessigkeit            | `dpms.ropa_entry.legal_basis` + Katalog #26 GDPR Legal Bases | ✅     |
| (b) Zweckbindung                | `dpms.ropa_entry.processing_purpose`                         | ✅     |
| (c) Datenminimierung            | Katalog #25 GDPR Data Categories + `ropa_data_category`      | ✅     |
| (d) Richtigkeit                 | `dsr` Rectification-Flow                                     | ✅     |
| (e) Speicherbegrenzung          | `dpms.retention_policy` + automatisierte Deletion            | ✅     |
| (f) Integritaet/Vertraulichkeit | Audit-Chain + RLS + Encryption-at-Rest                       | ✅     |
| Art. 5(2) Rechenschaftspflicht  | Access-Log + Audit-Trail (hash chain)                        | ✅     |

## Art. 6 — Rechtsgrundlagen

| Rechtsgrundlage               | ARCTOS-Support                              | Status |
| ----------------------------- | ------------------------------------------- | ------ |
| (a) Einwilligung              | `dpms.consent_record` mit Withdrawal-Audit  | ✅     |
| (b) Vertrag                   | `contract` + `ropa_entry.contract_id`       | ✅     |
| (c) Rechtliche Verpflichtung  | Flag in `ropa_entry.legal_basis`            | ✅     |
| (d) Lebenswichtige Interessen | dto                                         | ✅     |
| (e) Oeffentliches Interesse   | dto                                         | ✅     |
| (f) Berechtigtes Interesse    | `ropa_entry.legitimate_interest_assessment` | ✅     |

## Art. 7 — Einwilligung

| Requirement                   | ARCTOS-Support                     | Status               |
| ----------------------------- | ---------------------------------- | -------------------- |
| 7(1) Nachweis                 | `consent_record.consent_proof_ref` | ✅                   |
| 7(3) Widerruf genauso einfach | `consent_record.withdrawal_flow`   | ✅                   |
| 7(4) Koppelungsverbot         | Dokumentiert in Zweck-Analyse      | ◑ — nur dokumentativ |

## Art. 13/14 — Informationspflichten

`dpms.data_subject_information` mit Template-Engine. Automatische PDF-Generierung + Versionierung.

## Art. 15–22 — Betroffenenrechte

| Artikel | Recht                            | ARCTOS-Support                                        | Status      |
| ------- | -------------------------------- | ----------------------------------------------------- | ----------- |
| 15      | Auskunft                         | `dsr.type = 'access'` + Workflow                      | ✅          |
| 16      | Berichtigung                     | `dsr.type = 'rectification'`                          | ✅          |
| 17      | Loeschung                        | `dsr.type = 'erasure'` + automatisierte Data-Deletion | ✅          |
| 18      | Einschraenkung                   | `dsr.type = 'restriction'`                            | ✅          |
| 19      | Mitteilungspflicht an Empfaenger | `dsr.notified_recipients`                             | ◑ — manuell |
| 20      | Datenuebertragbarkeit            | `dsr.type = 'portability'` + Export-Format            | ✅          |
| 21      | Widerspruch                      | `dsr.type = 'objection'`                              | ✅          |
| 22      | Automatisierte Entscheidung      | EU-AI-Act-Modul (Catalog #13, 63 Kontrollen)          | ✅          |

## Art. 25 — Privacy by Design & Default

| Requirement                 | ARCTOS-Support                                     | Status |
| --------------------------- | -------------------------------------------------- | ------ |
| Technische Massnahmen       | TOMs (Catalog #24, 56 Entries, Art. 32 GDPR)       | ✅     |
| Organisatorische Massnahmen | RBAC + LoD + Modules mit Default-Disabled          | ✅     |
| Default-Einstellungen       | `module_config` default-false fuer sensible Module | ✅     |

## Art. 28 — Auftragsverarbeiter

| Requirement                                  | ARCTOS-Support                                        | Status                      |
| -------------------------------------------- | ----------------------------------------------------- | --------------------------- |
| 28(1) Auswahl geeigneter Auftragsverarbeiter | `vendor_due_diligence` + Scorecards                   | ✅                          |
| 28(3) Vertrag mit Mindestinhalten            | `contract + contract_obligation` + GDPR-AVV-Templates | ◑ — AVV-Template-Seed fehlt |
| 28(4) Sub-Processor Kette                    | `vendor.sub_processor` + Approval-Flow                | ✅                          |

## Art. 30 — Verzeichnis von Verarbeitungstaetigkeiten (VVT / RoPA)

Voll abgedeckt durch `dpms.ropa_entry` + `ropa_data_category` + `ropa_recipient`. Export in aufsichtsbehoerdliches Format (DSK-Muster) unterstuetzt via Reporting-Engine.

## Art. 32 — Sicherheit der Verarbeitung

Catalog #24 "TOMs (Art. 32 GDPR)" mit 56 Entries:

- Verschluesselung at-rest + in-transit
- Verfuegbarkeit (Backup ADR-015)
- Resilienz (BCMS)
- Wiederherstellbarkeit (Runbook)
- Regelmaessige Ueberpruefung (`control_test`)

Mapping: GDPR Art. 32 ↔ TOMs (23 Mappings)

## Art. 33/34 — Datenschutzverletzungen

| §     | Frist                                   | ARCTOS-Support                                            | Status |
| ----- | --------------------------------------- | --------------------------------------------------------- | ------ |
| 33(1) | Meldung an Aufsichtsbehoerde binnen 72h | `dpms.data_breach` mit automatischer Timer + Notification | ✅     |
| 33(3) | Mindestinhalt der Meldung               | Pflichtfelder in `data_breach`                            | ✅     |
| 34(1) | Benachrichtigung Betroffene             | `data_breach.affected_subjects_notification`              | ✅     |
| 34(3) | Ausnahmen (Verschluesselung etc.)       | Flag mit Begruendung                                      | ✅     |

## Art. 35 — Datenschutz-Folgenabschaetzung (DSFA / DPIA)

Modul: `dpms.dpia` + `dpia_risk` + `dpia_measure`. Schwellenwert-Trigger via Catalog #10 (DPIA Criteria, 9 Entries).

## Art. 37 — DSB / DPO

Rolle `dpo` im RBAC. Separate 2nd-Line-Verantwortung neben `risk_manager`.

## Art. 44–49 — Datenuebermittlung in Drittlaender

| Instrument                       | ARCTOS-Support                          | Status                         |
| -------------------------------- | --------------------------------------- | ------------------------------ |
| Angemessenheitsbeschluss         | `ropa_recipient.adequacy_decision` Flag | ✅                             |
| Standardvertragsklauseln (SCC)   | `contract.scc_version` + Template       | ✅                             |
| TIA (Transfer Impact Assessment) | `dpms.tia` Entitaet                     | ✅                             |
| BCRs                             | `vendor.binding_corporate_rules_id`     | ◑ — nur Flag, kein Upload-Flow |

## Luecken-Zusammenfassung

| Luecke                                         | Severity | Vorschlag                                                |
| ---------------------------------------------- | -------- | -------------------------------------------------------- |
| Art. 7(4) Koppelungsverbot technisch enforced  | Low      | Zod-Schema-Flag in Consent-Flow                          |
| Art. 28(3) AVV-Template-Pack                   | Medium   | `contract_template` Seeds: DSK-Muster-AVV DE/EN          |
| Art. 19 Mitteilung an Empfaenger automatisiert | Low      | `dsr.auto_notify_recipients` Job                         |
| BCR-Upload-Flow                                | Low      | `document.category = 'bcr'` + viewer-restriction         |
| Cookie/Tracker-Discovery                       | n/a      | nicht im Scope — eigene Tool-Klasse (CookieBot/OneTrust) |

## Zusammenfassung

**ARCTOS-GDPR-Readiness: ~95 %** fuer Tenant-Use-Case. Restliche 5 % sind Content-Seeds (AVV-Templates, BCR-Dokument-Handling) und optionaler Komfort (Auto-Notify).

Fuer ARCTOS **als Verarbeiter** (Art. 28 Perspektive) gilt:

- AVV mit CWS Haniel AG separat vertraglich geregelt
- Rechenzentrum in DE (Hetzner) -> keine Drittlandsuebermittlung
- Sub-Processor: Resend (Email, EU/DE), Backblaze B2 (EU-Region, geplant)
- Incident-Prozess: SECURITY.md + `/api/v1/audit-log/integrity` fuer Integritaets-Proof
