# DPMS Assessment Plan

**Framework:** EU GDPR 2016/679 (Art. 5-49) + BDSG + DSK-Standards + TOMs (Art. 32)
**Iteration:** 1
**Status:** Draft · **Owner:** @agatho · **Begleitdoku:** [00-master-plan.md](./00-master-plan.md)

## 1. Scope + Framework-Landschaft

Das DPMS-Modul adressiert **das kontinuierliche Datenschutz-Management**
eines Tenants — nicht einen einzelnen Zyklus wie ISMS/BCMS. Es besteht
aus mehreren **parallelen Registern** (RoPA, DPIA, DSR, Breach, TIA,
Consent, Retention, Processor-Agreements) die alle gemeinsam den
GDPR-Compliance-Status bilden.

| Framework | Fokus | In ARCTOS-Katalog |
|---|---|---|
| **EU GDPR 2016/679** | Art. 5-49 Verantwortlicher + Auftragsverarbeiter | #11 (106 Entries) |
| **EDPB Guidelines** | Aufsichtsbehoerdliche Auslegung | partial in Katalog #11 |
| **BDSG** | DE-spezifische Ergaenzungen | teilweise in Katalog #11 |
| **TOMs (Art. 32)** | Technische + organisatorische Massnahmen | #24 (56 Entries) |
| **GDPR Data Categories** | Datenkategorie-Taxonomie | #25 (49 Entries) |
| **GDPR Legal Bases** | Rechtsgrundlagen Art. 6 | #26 (26 Entries) |
| **DPIA Criteria** | Schwellenwert-Liste fuer DPIA-Pflicht | #10 (9 Entries) |
| **DSK-Kurzpapiere** | Deutsche Datenschutzkonferenz-Standards | als ADR-References |

**Besonderheit DPMS**: Anders als ISMS/BCMS gibt es keinen "grossen
Jahreszyklus", sondern **9 parallele Workflows mit unterschiedlichen
Triggers**:

1. **RoPA-Pflege** — laufend, bei Prozess-Aenderungen (Art. 30)
2. **DPIA-Zyklus** — pro High-Risk-Processing (Art. 35)
3. **DSR-Bearbeitung** — on-demand (Art. 15-22, 30-Tage-Frist)
4. **Breach-Notification** — Event-driven (Art. 33, 72-Stunden-Frist)
5. **TIA-Zyklus** — pro Drittlandstransfer (Art. 44-49, Schrems II)
6. **Consent-Mgmt** — on-demand (Art. 7, laufend)
7. **Retention-Mgmt** — geplant + automatisiert (Art. 5(1)(e))
8. **Processor-Agreement-Mgmt** — pro Vendor-Change (Art. 28)
9. **Privacy-by-Design** — pro neuem System/Prozess (Art. 25)

Daruber gibt es einen **Annual DPMS-Assessment-Zyklus** der alle 9 Registers
quer-auswertet (= Iso-27001-9.3-Aequivalent fuer Datenschutz).

## 2. Standards-driven Workflow-Map

### GDPR-Artikel → Workflow-Mapping

| Art. | Anforderung | ARCTOS-Entity |
|---|---|---|
| 5(1)(a) | Rechtmaessigkeit | `ropa_entry.legal_basis` + Catalog #26 |
| 5(1)(b) | Zweckbindung | `ropa_entry.processing_purpose` |
| 5(1)(c) | Datenminimierung | `ropa_data_category` Count-Rationale |
| 5(1)(d) | Richtigkeit | `dsr.type='rectification'` |
| 5(1)(e) | Speicherbegrenzung | `retention_schedule` + `deletion_request` |
| 5(1)(f) | Integritaet/Vertraulichkeit | Audit-Chain + RLS + Encryption |
| 5(2) | Rechenschaftspflicht | Audit-Log Hash-Chain (ADR-011) |
| 6 | Rechtsgrundlagen | `ropa_entry.legal_basis` (Enum aus Katalog #26) |
| 7 | Einwilligung | `consent_record` + `consent_type` |
| 9 | Besondere Kategorien | `ropa_data_category.is_special_category` |
| 10 | Strafrechtl. Daten | dto |
| 12-14 | Informationspflichten | `document` (Datenschutzinfo-Templates) |
| 15 | Auskunftsrecht | `dsr.type='access'` |
| 16 | Berichtigung | `dsr.type='rectification'` |
| 17 | Loeschung | `dsr.type='erasure'` + `deletion_request` |
| 18 | Einschraenkung | `dsr.type='restriction'` |
| 19 | Mitteilungspflicht | `dsr.notified_recipients` |
| 20 | Datenuebertragbarkeit | `dsr.type='portability'` + Export-Format |
| 21 | Widerspruch | `dsr.type='objection'` |
| 22 | Automatisierte Entscheidung | EU-AI-Act-Modul Link |
| 25 | Privacy by Design | `pbd_assessment` |
| 28 | Auftragsverarbeiter | `processor_agreement` + `sub_processor_notification` |
| 30 | Verzeichnis | `ropa_entry` + `ropa_data_category` + `ropa_recipient` + `ropa_data_subject` |
| 32 | Sicherheit | Catalog #24 TOMs in `soa_entry` |
| 33 | Breach Aufsicht | `data_breach` + `data_breach_notification` |
| 34 | Breach Betroffene | `data_breach_notification.notified_subjects=true` |
| 35 | DPIA | `dpia` + `dpia_risk` + `dpia_measure` |
| 36 | Prior Consultation | `dpia.prior_consultation_required=true` |
| 37 | DSB | role `dpo` + `user_organization_role` |
| 44-49 | Drittlandstransfer | `tia` + `country_risk_profile` |

## 3. Vollstaendiger DPMS-Zyklus

### 3.1 Annual Setup (DPMS-Governance-Zyklus)

**Trigger**: Jaehrlich (Standard) + bei Org-Change

**Aktoren**: dpo, admin

**Workflow**:

**3.1.1 — DPMS-Scope-Definition**
- Welche Geschaeftsbereiche/Tenant-Units im Scope?
- Welche IT-Systeme (Link auf `application_portfolio`)?
- Welche Drittlaender involviert (Vor-Screening)?

**3.1.2 — DPO-Appointment + Documentation**
- `user_organization_role.role='dpo'`
- DPO-Contact-Info publiziert (Art. 37(7))
- DPO-Independence-Statement

**3.1.3 — Privacy-Policy-Review**
- `document` (category='privacy_policy') aktualisieren
- Versionierung + Publication-Date
- Multi-Language (ISO 639 codes)

**3.1.4 — Risk-Based-Prioritaet fuer DPIA-Reviews**
- Aus RoPA: welche Processings mit high-risk-Indikatoren
- Baseline aus vorherigem Jahr

**Existierend**:
- ✅ `user_organization_role` mit 'dpo'
- ✅ `document` (category='privacy_policy')
- 🟡 Keine strukturierte DPMS-Scope-Entity (ad-hoc)

**Gap**:
- 🔴 `dpms_scope_definition` Entity (Multi-Year-Scope-Management)
- 🔴 DPO-Onboarding-Wizard
- 🔴 Privacy-Policy-Template-Pack (DE/EN, DSGVO-konform)

### 3.2 RoPA-Management (Art. 30, kontinuierlich)

**Trigger**: Neuer Prozess, neue Datenkategorie, System-Change

**Aktoren**: process_owner (Input), dpo (Review + Approval)

**Workflow**:

**3.2.1 — RoPA-Entry-Creation**
- Per Processing-Activity ein `ropa_entry`:
  - `processing_purpose` (klar, nicht redundant)
  - `legal_basis` (aus Katalog #26)
  - `data_controller` (= org in Regelfall)
  - `data_controller_reps` (bei Joint-Controllers)
  - `processor_ids` (`ropa_recipient` mit type='processor')
  - `processing_scope` (welche Systeme)
  - `automated_decisioning` (Art. 22 flag)
  - `cross_border_transfer` (Ja/Nein, wenn Ja: TIA-Pflicht)
  - `lifecycle_status` (draft → active → archived)

**3.2.2 — Data-Categories attachen**
- `ropa_data_category` pro Datenkategorie:
  - `catalog_entry_id` (Katalog #25 GDPR Data Categories)
  - `is_special_category` (Art. 9 flag)
  - `is_minors` (Art. 8 flag)
  - `count_rationale` (warum diese Menge)
  - `retention_period` (Link auf `retention_schedule`)

**3.2.3 — Data-Subjects attachen**
- `ropa_data_subject` pro Subject-Kategorie:
  - Employees, Customers, Suppliers, Visitors, Minors, Patients, etc.
  - `count_estimate`
  - `vulnerability_flags` (Kinder, Mitarbeiter in Abhaengigkeit, etc.)

**3.2.4 — Recipients attachen**
- `ropa_recipient`:
  - `recipient_type`: controller | processor | third_party
  - `recipient_country` (ISO 3166)
  - `adequacy_decision` (Boolean)
  - `transfer_mechanism`: SCC | BCR | Art. 49 exception | EEA
  - `vendor_id` (TPRM-Link)

**3.2.5 — DPIA-Trigger-Check**
- Pro RoPA-Entry: prueft gegen Katalog #10 (9 DPIA-Criteria)
- Wenn >= 2 Criteria erfuellt → DPIA-Pflicht-Flag setzen
- Auto-Notification an DPO

**3.2.6 — Review + Approval**
- DPO reviewt neue oder veraenderte RoPA-Entries
- `approval_request` + `approval_decision`
- Status: draft → pending_dpo_review → active → archived

**Existierend**:
- ✅ `ropa_entry`, `ropa_data_category`, `ropa_data_subject`, `ropa_recipient`
- ✅ `/api/v1/dpms/ropa` CRUD
- ✅ UI: `/dpms/ropa`

**Gap**:
- 🔴 RoPA-Creation-Wizard (6-Step: Purpose → Legal-Basis → Data →
  Subjects → Recipients → Review)
- 🔴 RoPA-Import aus BPM-Modul (processId → Auto-RoPA-Draft)
- 🔴 DPIA-Trigger-Auto-Detection + UI-Banner
- 🔴 Bulk-RoPA-Update bei Legal-Basis-Change (z. B. neue SCC-Version)
- 🔴 RoPA-Export als DSK-konformes Muster (PDF)
- 🔴 RoPA-Changelog (Diff zwischen Versionen, wichtig bei Behoerden-Anfragen)

### 3.3 DPIA-Zyklus (Art. 35, pro High-Risk-Processing)

**Trigger**: RoPA-Entry markiert als DPIA-Pflichtig ODER DPO-manuell

**Aktoren**: dpo (owner), process_owner (input), risk_manager (review)

**Workflow**:

**3.3.1 — DPIA-Creation**
- `dpia`-Record verknuepft mit 1+ `ropa_entry`:
  - `scope_description` (was wird assessed)
  - `necessity_proportionality` (Art. 35(7)(b))
  - `consultation_dpo_completed`
  - `consultation_subjects_completed` (optional, Art. 35(9))
  - `status`: planning → in_progress → review → completed → monitoring → archived

**3.3.2 — Risk-Identification**
- `dpia_risk` pro identifiziertem Risiko:
  - `risk_description`
  - `affected_subjects_rights` (Art. 35(7)(c))
  - `likelihood` + `impact` (5-Punkt-Skala)
  - `inherent_risk_score`
  - `risk_category`: discrimination | financial_loss | reputation | etc.
  - Cross-Link auf ISMS-Risk wenn overlap

**3.3.3 — Measures-Design**
- `dpia_measure` pro Massnahme:
  - `measure_type`: technical | organizational | contractual
  - `measure_title` + `description`
  - `implementation_status`: planned | in_progress | implemented | verified
  - `cost_onetime`, `cost_annual`, `effort_hours`, `budget_id`
  - `residual_risk_after` (likelihood + impact nach Massnahme)
  - `evidence_document_ids`
  - `responsible_id`

**3.3.4 — Prior-Consultation-Check (Art. 36)**
- Wenn `dpia.residual_risk_level >= high`:
  - `prior_consultation_required = true`
  - Submission an Aufsichtsbehoerde vorbereiten
  - 8-Week-Timer (Behoerde hat 8 Wochen fuer Antwort, +6 Wochen bei Komplex)

**3.3.5 — DPO-Sign-Off**
- DPO-Opinion dokumentiert
- `approval_request` mit Role='dpo'
- Bei Ablehnung: Re-Design der Measures

**3.3.6 — Monitoring-Phase**
- Nach Completion: `status='monitoring'` fuer 12 Monate
- Quartalsweise-Reminder via `reminder_rule`
- Re-Assessment falls Processing-Change

**Existierend**:
- ✅ `dpia`, `dpia_risk`, `dpia_measure`
- ✅ `/api/v1/dpms/dpia` CRUD
- ✅ UI: `/dpms/dpia`

**Gap**:
- 🔴 DPIA-Wizard (5-Step: Scope → Risks → Measures → Consultation → Sign-Off)
- 🔴 DPIA-Template-Pack (Video-Surveillance, Employee-Monitoring,
  Customer-Analytics, Health-Data — pre-filled fuer haeufige Faelle)
- 🔴 Prior-Consultation-Package-Generator (alle Doku fuer Behoerden-Submission)
- 🔴 DPIA-Quarterly-Monitoring-Dashboard
- 🔴 DPIA-to-ISMS-Risk-Sync (automatisch `risk`-Entity erzeugen)

### 3.4 DSR-Bearbeitung (Art. 15-22, on-demand)

**Trigger**: Betroffener stellt Antrag (Web-Form, E-Mail, Telefon, Brief)

**Aktoren**: dpo (intake + coordination), process_owner (data-lookup)

**Workflow (Zeit-kritisch, 30-Tage-Frist Art. 12(3))**:

**3.4.1 — DSR-Intake**
- `dsr`-Record mit:
  - `type`: access | rectification | erasure | restriction | portability | objection | withdraw_consent
  - `received_at` (Start 30-Tage-Clock)
  - `channel`: web_form | email | phone | postal | in_person
  - `subject_identity_verified` (**Pflicht vor Processing**)
  - `identity_verification_method`
  - `authorized_representative` (bei Vertretung)
  - `priority`: standard | urgent (child-subject, special category data)

**3.4.2 — Subject-Identity-Verification**
- `dsr.subject_identity_verified=true` erforderlich bevor Daten geteilt
- Verification-Methods: Account-Login + Challenge | Passport-Upload |
  Video-Ident | Postal-Address-Match
- Fraud-Prevention: zu viele Anfragen von gleicher ID → Flag

**3.4.3 — Data-Lookup across Systems**
- Aggregation ueber alle `ropa_entry.processing_scope`
- Connector-basiert (wenn SaaS-Systeme via Connector-Framework)
- Manuelle Lookups bei Legacy-Systemen

**3.4.4 — Per-Type-Handling**:
- **Access (Art. 15)**: Full-Data-Export generieren (JSON/PDF)
- **Rectification (Art. 16)**: Feld-spezifische Update-Proposals
- **Erasure (Art. 17)**: Deletion-Plan (mit Ausnahmen Art. 17(3))
- **Restriction (Art. 18)**: Processing-Restriction-Flags setzen
- **Portability (Art. 20)**: Structured-Format-Export (JSON/CSV/XML)
- **Objection (Art. 21)**: Opt-Out aus bestimmten Processings
- **Withdraw Consent (Art. 7(3))**: `consent_record.withdrawal_flow`

**3.4.5 — Communication with Subject**
- Templates pro DSR-Type (Eingangsbestaetigung, Bearbeitungs-Update,
  Abschluss-Bericht, Extension-Notification)
- Multi-Language

**3.4.6 — Article-19-Notification**
- Wenn Rectification/Erasure/Restriction: Recipients informieren
- `dsr.notified_recipients`-Array

**3.4.7 — Audit-Trail**
- `dsr_activity`-Entries pro Aktion (intake, verification, lookup,
  response, close)
- Immutable log fuer Beweis-Zwecke

**Existierend**:
- ✅ `dsr`, `dsr_activity`
- ✅ `/api/v1/dpms/dsr` CRUD
- ✅ UI: `/dpms/dsr`

**Gap**:
- 🔴 DSR-Intake-Wizard (Web-Form) fuer Betroffene
- 🔴 Identity-Verification-Methods (Passport-Upload, Video-Ident-Partner-Integration)
- 🔴 DSR-Deadline-Countdown-Widget (30-Tage prominent)
- 🔴 Data-Lookup-Connector-Framework (Auto-Query ueber alle RoPA-Systeme)
- 🔴 DSR-Response-Template-Engine (pre-approved pro Type + Sprache)
- 🔴 Auto-Article-19-Notification an Recipients (Email/API)
- 🔴 Extension-Notification (2 Monats-Verlaengerung Art. 12(3))
- 🔴 Complainant-Portal (Betroffener kann Status selbst einsehen via Secure-Link)

### 3.5 Breach-Notification (Art. 33-34, Event-driven)

**Trigger**: `security_incident.is_data_breach=true`

**Aktoren**: dpo (coordination), CISO (technical), Legal (communication)

**Workflow (72-Stunden-Frist)**:

**3.5.1 — Breach-Record-Creation**
- `data_breach`-Record (eigenstaendig oder verknuepft mit `security_incident`):
  - `detected_at` (Start der Bewertung)
  - `discovered_by`
  - `breach_category`: confidentiality | integrity | availability (kombinierbar)
  - `affected_subjects_count_estimate`
  - `affected_data_categories_ids`
  - `likely_consequences`
  - `technical_measures_taken`
  - `organizational_measures_taken`
  - `reported_to_authority_at` (72h deadline)
  - `reported_to_subjects_at` (Art. 34)
  - `notification_threshold_reached`

**3.5.2 — Risk-Assessment**
- **Schwellenwert-Pruefung Art. 33(1)**: "unless unlikely to result in
  a risk to the rights and freedoms of natural persons"
- `data_breach.likelihood_of_harm` + `severity_of_harm`
- Entscheidung: nur Dokumentation vs. Behoerden-Meldung

**3.5.3 — Art. 33 Behoerden-Notification**
- `data_breach_notification` mit:
  - `recipient_type='authority'`
  - `recipient_name` (DE: Landes-Datenschutzbehoerde)
  - `notification_method`: online_portal | email | postal
  - `reference_number` (wenn Portal-Acknowledgment)
  - `content_snapshot` (JSON mit vollem Meldungs-Inhalt)
  - `sent_at`

**3.5.4 — Art. 34 Subjects-Notification**
- **Schwellenwert Art. 34(1)**: "high risk to the rights and freedoms"
- Ausnahmen Art. 34(3): Encryption vorher, subsequent measures, disproportionate effort
- Wenn Pflicht:
  - `data_breach_notification.recipient_type='data_subjects'`
  - Communication-Channel: personal email, postal, public announcement

**3.5.5 — Timeline + Audit**
- Kritisch: 72h-Countdown prominent in UI
- Automatic Reminder nach 24h, 48h, 60h (`reminder_rule`)
- `dsr_activity`-analoge Activity-Log per Breach

**3.5.6 — Post-Incident-Analysis**
- Nach Resolution: Root-Cause-Analysis (`root_cause_analysis`)
- Lessons-Learned → `isms_corrective_action`
- Process-Change-Proposals

**Existierend**:
- ✅ `data_breach`, `data_breach_notification`
- ✅ `/api/v1/dpms/breaches`
- ✅ UI: `/dpms/breaches`

**Gap**:
- 🔴 Breach-Decision-Tree-Wizard (Art. 33 + 34 Schwellenwert-Check)
- 🔴 72h-Countdown-Widget (prominent, rot ab <12h)
- 🔴 Notification-Template-Library (DE + EN, pre-approved)
- 🔴 Landesbehoerden-Portal-Integration (wenn API verfuegbar — z. B.
  Hamburg via HmbBfDI-Portal)
- 🔴 Subject-Notification-Mass-Send (Email-Batch bei grossen Breaches)
- 🔴 Breach-Register-Export (fuer Aufsichtsbehoerden-Audit)
- 🔴 Breach-Risk-Calculator (Art. 33 Schwellenwert automatisch)

### 3.6 TIA-Zyklus (Art. 44-49, Drittlandstransfer)

**Trigger**: Neuer Processor in Drittland ODER Country-Risk-Change

**Aktoren**: dpo (primary), vendor_manager (data)

**Workflow (Schrems II-konform)**:

**3.6.1 — Country-Risk-Pre-Screening**
- `country_risk_profile` pro Ziel-Land (Plattform-Daten):
  - `has_adequacy_decision` (EU-Liste)
  - `surveillance_laws_assessment`
  - `data_protection_authority_exists`
  - `legal_remedies_available`
  - `overall_risk_rating`: low | medium | high | critical
- Auto-Update bei EU-Kommissions-Entscheidungen

**3.6.2 — TIA-Creation**
- `tia` (= transfer_impact_assessment):
  - `ropa_entry_id` (welcher Processing)
  - `recipient_country`
  - `transfer_mechanism`: adequacy | sccs | bcrs | certifications | art_49_exceptions
  - `data_categories_transferred`
  - `data_subjects_affected`
  - `legal_analysis` (detailed narrative)
  - `technical_measures` (encryption, pseudonymization, etc.)
  - `organizational_measures` (audit rights, sub-processor restrictions)
  - `effectiveness_assessment`
  - `residual_risk`: acceptable | acceptable_with_measures | unacceptable

**3.6.3 — SCC-Addendum-Management**
- Bei SCC: Module-Auswahl (Controller-Controller, Controller-Processor, etc.)
- Docking-Clause fuer Sub-Processors
- Annexe I+II+III ausfuellen (Parties, Processing-Description, TOMs)
- Storage-Location der signed SCC

**3.6.4 — Review-Trigger**
- Annual re-assessment
- Bei neuen Surveillance-Gesetzen im Empfaenger-Land
- Bei Aufsichtsbehoerden-Entscheidungen (Schrems-III etc.)

**Existierend**:
- ✅ `tia` (= `transfer_impact_assessment`)
- ✅ `country_risk_profile`
- ✅ `/api/v1/dpms/tia` CRUD
- ✅ UI: `/dpms/tia`

**Gap**:
- 🔴 TIA-Wizard (6-Step analog Schrems-II-Schritte)
- 🔴 Country-Risk-Dashboard (Map + Trend)
- 🔴 SCC-Generator (Annexe I+II+III aus RoPA-Daten)
- 🔴 Surveillance-News-Feed (Integrations mit Regulatory-Change-Modul)
- 🔴 TIA-Bulk-Reassessment (bei Country-Risk-Change)

### 3.7 Consent-Management (Art. 7)

**Trigger**: Neue Consent-Collection (Cookie-Banner, Signup, Marketing-Opt-In)

**Aktoren**: process_owner, dpo (review)

**Workflow**:

**3.7.1 — Consent-Type-Definition**
- `consent_type`-Katalog:
  - `name`, `description_de`, `description_en`
  - `required_for_service` (Boolean — erforderlich fuer Nutzung)
  - `granularity` (single | bundled | per_purpose)
  - `default_duration_days` (z. B. 365)
  - `can_be_withdrawn_easily` (Art. 7(3))

**3.7.2 — Consent-Collection**
- `consent_record` pro Subject pro Type:
  - `subject_id` (ext. reference wenn kein ARCTOS-User)
  - `consent_text_version` (Version-Pinning fuer Beweis)
  - `collected_at`
  - `consent_proof_ref` (Hash auf evidence, z. B. Form-Submission-Log)
  - `granted` (Boolean, default true)
  - `withdrawn_at`, `withdrawn_reason`
  - `expires_at`

**3.7.3 — Consent-Withdrawal**
- UI: "Widerrufen"-Button (Art. 7(3) "genauso einfach wie Erteilen")
- `withdrawal_flow` ohne Authentifizierungs-Barrieren
- Notification an Processing-Owner

**3.7.4 — Consent-Audit-Trail**
- Immutable Log aller Consent-Events
- Hash-Chain in `audit_log`

**Existierend**:
- ✅ `consent_type`, `consent_record`
- ✅ `/api/v1/dpms/consent-types`, `/api/v1/dpms/consent-records`
- ✅ UI: `/dpms/consent`

**Gap**:
- 🔴 Cookie-Banner-Config-Builder
- 🔴 Consent-Widget-Code-Snippet fuer Embedding
- 🔴 Consent-History-Dashboard (pro Subject)
- 🔴 Withdrawal-Rate-KRI
- 🔴 A/B-Test fuer Consent-Banner-Design (Nudge-Compliance)

### 3.8 Retention-Management (Art. 5(1)(e))

**Trigger**: Scheduled Worker-Job (daily)

**Aktoren**: dpo (policy), IT (execution), automated

**Workflow**:

**3.8.1 — Retention-Schedule-Definition**
- `retention_schedule` pro Datenkategorie + Processing:
  - `retention_period_days`
  - `basis` (legal obligation | contract | consent | legitimate_interest)
  - `legal_reference` (z. B. §147 HGB fuer Rechnungsdaten)
  - `trigger_event` (contract_end | consent_withdrawal | last_interaction | fixed_date)
  - `deletion_strategy` (hard_delete | anonymize | pseudonymize | archive)

**3.8.2 — Retention-Exception-Management**
- `retention_exception` fuer Einzelfaelle:
  - Litigation-Hold
  - Tax-Audit
  - Insurance-Claims
- Zeitlich begrenzt mit Auto-Expiry

**3.8.3 — Deletion-Request-Execution**
- `deletion_request` pro betroffenem Record:
  - Source: `retention_schedule` | `dsr` (Art. 17) | manual
  - `target_system` (via Connector wenn SaaS)
  - `status`: pending | in_progress | completed | failed | blocked_by_exception
  - `verification_evidence` (Screenshot, Log, API-Response)

**3.8.4 — Anonymization-Process**
- Wenn strategy='anonymize':
  - PII-Felder replaced mit placeholders
  - Hash-Aggregation fuer Analytics (k-anonymity >= 5)
  - Documented via `deletion_request.verification_evidence`

**3.8.5 — Worker-Job**
- Daily-Batch: alle `retention_schedule` pruefen
- Wenn `trigger_event` erfuellt + `retention_period` abgelaufen:
  - Create `deletion_request`
  - Execute deletion via Connector oder Manual-Assignment
- Notification bei Exceptions (blocked)

**Existierend**:
- ✅ `retention_schedule`, `retention_exception`, `deletion_request`
- ✅ `/api/v1/dpms/retention-schedules`, `/deletion-requests`
- ✅ UI: `/dpms/retention`

**Gap**:
- 🔴 Retention-Schedule-Wizard (Processing → Data-Category → Rule)
- 🔴 Retention-Rule-Template-Library (HGB, AO, BDSG pre-filled)
- 🔴 Litigation-Hold-Management (Legal-Team-Interface)
- 🔴 Anonymization-Dashboard (was wurde wie anonymisiert)
- 🔴 Deletion-Verification-Audit (Sample-Check, ob wirklich geloescht)
- 🔴 Retention-Calendar (was steht diesen Monat zur Loeschung an)

### 3.9 Processor-Agreement-Management (Art. 28)

**Trigger**: Neuer Auftragsverarbeiter + Sub-Processor-Change

**Aktoren**: dpo, vendor_manager, Legal

**Workflow**:

**3.9.1 — AVV-Creation**
- `processor_agreement` pro Vendor:
  - `vendor_id` (TPRM-Link)
  - `agreement_version`
  - `signed_at`, `signed_by_controller`, `signed_by_processor`
  - `controller_instructions_included` (Art. 28(3)(a))
  - `confidentiality_clause` (Art. 28(3)(b))
  - `security_measures_reference` (Link auf TOMs-Dokument)
  - `assistance_with_dsr_clause`
  - `breach_notification_clause`
  - `sub_processor_management_clause`
  - `audit_rights_clause`
  - `deletion_return_clause`
  - `governing_law`, `dispute_resolution_forum`

**3.9.2 — Sub-Processor-Notifications**
- `sub_processor_notification` pro geplanten Sub-Processor:
  - `processor_agreement_id`
  - `sub_processor_vendor_id`
  - `notification_date`
  - `objection_deadline` (typ. 30 Tage)
  - `controller_approved` (Boolean)
  - `objection_notes`

**3.9.3 — Audit-Right-Execution**
- Wenn Audit-Right triggered → Cross-Link auf Audit-Modul (External-Audit-Share)

**3.9.4 — Annual-AVV-Review**
- Quartals-Worker prueft: alle AVVs >= 12 Monate alt → Review-Flag

**Existierend**:
- ✅ `processor_agreement`, `sub_processor_notification`
- ✅ `/api/v1/dpms/processor-agreements`

**Gap**:
- 🔴 AVV-Generator (Template-basiert, DSK-Muster-kompatibel)
- 🔴 Sub-Processor-Liste-Portal (Transparenz fuer Subjects/Customers)
- 🔴 Objection-Handling-Flow
- 🔴 AVV-Review-Dashboard (Ueberfaellige)

### 3.10 Privacy-by-Design (Art. 25)

**Trigger**: Neues IT-Projekt, neuer Prozess, Existing-Process-Redesign

**Aktoren**: dpo (review), project_owner, architect

**Workflow**:

**3.10.1 — PbD-Assessment-Creation**
- `pbd_assessment` pro Projekt:
  - `project_name`, `project_scope`
  - `data_minimization_measures`
  - `purpose_limitation_measures`
  - `storage_limitation_measures`
  - `transparency_measures`
  - `subject_control_measures` (Easy-Access-Rights-UI)
  - `security_by_default_measures`
  - `default_configuration_details`

**3.10.2 — Review-Gates**
- Pre-Implementation: PbD-Assessment approved by DPO
- Post-Implementation: Verification der implementierten Measures
- Sign-Off via `approval_request`

**Existierend**:
- ✅ `pbd_assessment`
- ✅ `/api/v1/dpms/pbd-assessments`

**Gap**:
- 🔴 PbD-Questionnaire-Wizard
- 🔴 PbD-Integration in Project-Lifecycle (wenn ARCTOS PM-Modul bekommt)
- 🔴 PbD-Templates pro Project-Typ (SaaS, Mobile-App, IoT, AI-System)

### 3.11 Annual-DPMS-Assessment (Quer-Report ueber alle 9 Workflows)

**Trigger**: Jaehrlich (Q1 fuer Vorjahr)

**Aktoren**: dpo (owner), admin

**Output-Report**:

| Section | Inhalt | Quelle |
|---|---|---|
| Executive-Summary | Top-Risks + Compliance-Score | alle Register |
| RoPA-Coverage | Count of RoPA-Entries + Changes | `ropa_entry` |
| DPIA-Status | Completed + In-Monitoring + Overdue | `dpia` |
| DSR-Timeliness | Avg Response-Time, Count per Type, Extended | `dsr` + `dsr_activity` |
| Breach-Register | Count, Severity-Distribution, 72h-Compliance | `data_breach` + `data_breach_notification` |
| TIA-Status | Active Transfers, Country-Risk-Exposure | `tia` + `country_risk_profile` |
| Consent-Metrics | Withdrawal-Rate, Expiring-Soon | `consent_record` |
| Retention-Execution | Scheduled vs Executed Deletions, Exceptions | `deletion_request` |
| AVV-Register | Active, Overdue-Review, Sub-Processor-Changes | `processor_agreement` + `sub_processor_notification` |
| PbD-Coverage | Projects mit vs ohne PbD | `pbd_assessment` |
| KRIs-Trend | Timeseries-Dashboard | Cross-Module |

**Management-Review-Integration**:
- DPO-Annual-Report wird Input fuer `management_review` (cross-ISMS)

**Existierend**: Keine dedizierte Report-Engine fuer Annual-DPMS-Report

**Gap**:
- 🔴 Annual-DPMS-Report-Generator (`/api/v1/dpms/annual-report/{year}`)
- 🔴 DPMS-Executive-Dashboard mit Jahres-Timeline
- 🔴 DPO-Briefing-Pack (PDF + PowerPoint fuer Board-Meeting)

## 4. Entity-Katalog (DPMS-Modul)

### 4.1 Vorhanden (22 Entitaeten)

| Entity | Tabelle | Zweck |
|---|---|---|
| RoPA-Entry | `ropa_entry` | Art. 30 Hauptrecord |
| RoPA-Data-Category | `ropa_data_category` | Verknuepfung mit Katalog #25 |
| RoPA-Data-Subject | `ropa_data_subject` | Betroffene Kategorien |
| RoPA-Recipient | `ropa_recipient` | Empfaenger-Rolle |
| DPIA | `dpia` | Art. 35 Hauptrecord |
| DPIA-Risk | `dpia_risk` | Risiken aus DPIA |
| DPIA-Measure | `dpia_measure` | Massnahmen aus DPIA |
| DSR | `dsr` | Betroffenenrechts-Antrag |
| DSR-Activity | `dsr_activity` | Activity-Log |
| Data-Breach | `data_breach` | Art. 33 Breach-Record |
| Data-Breach-Notification | `data_breach_notification` | Notifications an Authority/Subjects |
| TIA | `tia` | Art. 44-49 Transfer-Impact |
| Retention-Schedule | `retention_schedule` | Aufbewahrungsfristen |
| Retention-Exception | `retention_exception` | Ausnahmen (Litigation-Hold) |
| Deletion-Request | `deletion_request` | Konkrete Loeschung |
| Transfer-Impact-Assessment | `transfer_impact_assessment` | Detail-TIA |
| Country-Risk-Profile | `country_risk_profile` | Platform-Daten |
| Processor-Agreement | `processor_agreement` | AVV |
| Sub-Processor-Notification | `sub_processor_notification` | Art. 28(2) |
| PbD-Assessment | `pbd_assessment` | Art. 25 Privacy-by-Design |
| Consent-Type | `consent_type` | Consent-Kategorie |
| Consent-Record | `consent_record` | Einzelner Consent |

### 4.2 Neu (benoetigt)

| Entity | Zweck | Prio |
|---|---|---|
| `dpms_scope_definition` | Scope pro Jahr | Low |
| `avv_template` | Template fuer AVV-Generator | Medium |
| `ropa_version` | RoPA-Versionierung + Diff | Medium |
| `dpia_template` | Pre-filled DPIA je Use-Case | Medium |
| `breach_template` | Notification-Templates | High |
| `dsr_template` | DSR-Response-Templates | High |
| `retention_rule_template` | Retention-Regel-Templates | Medium |
| `dpms_annual_report` | Container fuer Jahresbericht | High |
| `surveillance_news_feed` | Regulatory-Feed fuer TIAs | Low |

## 5. API-Surface (Ausschnitt — gesamt ca. 60 Endpoints)

### 5.1 Existierend (30+)

```
/api/v1/dpms/ropa
/api/v1/dpms/dpia
/api/v1/dpms/dsr
/api/v1/dpms/breaches
/api/v1/dpms/tia
/api/v1/dpms/consent-types
/api/v1/dpms/consent-records
/api/v1/dpms/retention-schedules
/api/v1/dpms/deletion-requests
/api/v1/dpms/processor-agreements
/api/v1/dpms/pbd-assessments
/api/v1/dpms/country-risk-profiles
/api/v1/dpms/templates
/api/v1/dpms/erm-sync
/api/v1/dpms/dashboard
```

### 5.2 Neu benoetigt (~30)

```
POST   /api/v1/dpms/setup-wizard
POST   /api/v1/dpms/ropa/from-process       (bootstrap aus BPM-process)
POST   /api/v1/dpms/ropa/{id}/dpia-check    (trigger-Evaluation)
POST   /api/v1/dpms/ropa/{id}/archive
GET    /api/v1/dpms/ropa/changelog
POST   /api/v1/dpms/ropa/export-dsk         (DSK-Muster-Export)

POST   /api/v1/dpms/dpia/from-template
POST   /api/v1/dpms/dpia/{id}/prior-consultation-package
GET    /api/v1/dpms/dpia/monitoring

POST   /api/v1/dpms/dsr/intake              (public, fuer Subjects)
POST   /api/v1/dpms/dsr/{id}/verify-identity
POST   /api/v1/dpms/dsr/{id}/data-lookup    (triggert connector-Queries)
POST   /api/v1/dpms/dsr/{id}/respond        (sendet Response + notifies recipients)
POST   /api/v1/dpms/dsr/{id}/extend         (Art. 12(3) 2-monats-Verlaengerung)

POST   /api/v1/dpms/breaches/assess         (Schwellenwert-Check)
POST   /api/v1/dpms/breaches/{id}/notify-authority
POST   /api/v1/dpms/breaches/{id}/notify-subjects
GET    /api/v1/dpms/breaches/{id}/countdown

POST   /api/v1/dpms/tia/{id}/scc-generate   (Annexe-Generator)
POST   /api/v1/dpms/tia/bulk-reassess       (bei Country-Risk-Change)

POST   /api/v1/dpms/consent/widget-config
GET    /api/v1/dpms/consent/subject/{id}/history

POST   /api/v1/dpms/retention/{id}/execute-deletion
POST   /api/v1/dpms/retention/litigation-hold

POST   /api/v1/dpms/avv/from-template
POST   /api/v1/dpms/avv/{id}/sub-processor-approval

POST   /api/v1/dpms/pbd/questionnaire
POST   /api/v1/dpms/pbd/{id}/verify-implementation

GET    /api/v1/dpms/annual-report/{year}
POST   /api/v1/dpms/annual-report/{year}/generate
```

## 6. UI-Surface (~35 Pages, 15 existierend, 20 neu)

### Existierend
- `/dpms`, `/dpms/ropa`, `/dpms/dpia`, `/dpms/dsr`, `/dpms/breaches`,
  `/dpms/tia`, `/dpms/consent`, `/dpms/retention`

### Neu (Auswahl)
- `/dpms/setup-wizard`
- `/dpms/ropa/new-wizard`, `/dpms/ropa/[id]/versions`
- `/dpms/dpia/new-wizard`, `/dpms/dpia/[id]/prior-consultation`
- `/dpms/dsr/intake` (public!), `/dpms/dsr/[id]/verify-identity`, `/dpms/dsr/portal/[token]`
- `/dpms/breaches/assess-wizard`, `/dpms/breaches/[id]/countdown`, `/dpms/breaches/register`
- `/dpms/tia/new-wizard`, `/dpms/tia/country-risk-map`
- `/dpms/consent/banner-builder`, `/dpms/consent/subject/[id]`
- `/dpms/retention/calendar`, `/dpms/retention/litigation-holds`
- `/dpms/avv/new-wizard`, `/dpms/avv/sub-processors`
- `/dpms/pbd/new-questionnaire`
- `/dpms/annual-report/[year]`, `/dpms/dpo-dashboard`

## 7. Cross-Module-Integrationen

- **ISMS**: TOMs (Katalog #24) in SoA, Incidents → Breach-Check, Shared-Evidence-Pool
- **BCMS**: Data-Loss-Events in BIA, Recovery-Procedures fuer Data-Restoration
- **TPRM**: Processor-Agreements-Link, Vendor-Due-Diligence, Sub-Processor-Management
- **BPM**: Process-to-RoPA-Bootstrap, Process-Changes → RoPA-Update-Trigger
- **Work-Item**: DSR als Work-Item fuer Assignment + Tracking
- **EAM**: Application-Portfolio ↔ RoPA-Processing-Systems
- **Audit**: DPMS-Audit als Audit-Universe-Entry, Evidence-Sharing
- **Regulatory-Change**: EU-Kommissions-Entscheidungen triggern TIA-Re-Assessments
- **AI-Act**: High-Risk-AI-Systeme mit Personal-Data → DPIA-Pflicht + AI-Conformity-Assessment

## 8. Workflow-Gates

| Gate | Transition | Kriterium |
|---|---|---|
| **G1** | RoPA create → active | DPO-Review approved, alle Pflichtfelder, Legal-Basis gewaehlt |
| **G2** | RoPA active → DPIA-Trigger | >= 2 DPIA-Criteria Match ODER DPO-manuell |
| **G3** | DPIA planning → in_progress | Scope defined, Risks identified (mind. 3) |
| **G4** | DPIA in_progress → review | Alle Risks haben Measures, Residual-Risk calculated |
| **G5** | DPIA review → completed | DPO-Sign-Off, Prior-Consultation done wenn required |
| **G6** | DSR intake → processing | Identity verified (Art. 12) |
| **G7** | DSR processing → responded | Data gefunden, Response-Package erstellt |
| **G8** | DSR responded → closed | 30-Tage-Frist gehalten oder Extension dokumentiert |
| **G9** | Breach detected → assessed | Art-33-Schwellenwert-Check done |
| **G10** | Breach assessed → authority-notified | 72h-Frist nicht verletzt |
| **G11** | Breach → subjects-notified | Art-34-Schwellenwert-Pruefung done |
| **G12** | TIA creation → approved | Schrems-II-Analyse complete, Measures documented |
| **G13** | Retention executed | Deletion verified, Exception-Check done |
| **G14** | AVV signed → active | Alle Art-28-Pflichtklauseln enthalten |
| **G15** | Annual-Report → Management-Review | Alle 10 Sections populiert |

## 9. Compliance-Evidence-Pack (DSGVO-Audit-ready)

| Dokument | Quelle | Format |
|---|---|---|
| Datenschutz-Policy | `document` (privacy_policy) | PDF + Multi-Language |
| Verzeichnis-Verarbeitungstaetigkeiten | `ropa_*` Tables aggregated | DSK-konformes PDF |
| DPIA-Register | `dpia` + children | PDF per DPIA + Register |
| DSR-Register | `dsr` + `dsr_activity` last 12 months | CSV + Evidence-Bundles |
| Breach-Register | `data_breach` + `data_breach_notification` | CSV + PDF pro Breach |
| TIA-Register | `tia` + `transfer_impact_assessment` | PDF pro TIA |
| AVV-Register | `processor_agreement` + signed PDFs | ZIP |
| TOMs-Dokument | Katalog #24 + `soa_entry` | PDF |
| Consent-Summary | `consent_record` aggregated | CSV + Dashboard-PDF |
| Retention-Schedule | `retention_schedule` + Execution-Log | PDF + CSV |
| DPO-Annual-Report | `dpms_annual_report` | PDF |
| Audit-Trail | `/api/v1/audit-log/integrity` | JSON |

## 10. KPIs + Metriken

| KRI | Formel | Frequenz |
|---|---|---|
| DSGVO-Compliance-Score | weighted Composite aus 10 Sub-Scores | monthly |
| RoPA-Coverage | count(process WHERE hasActiveRopa) / total_processes | daily |
| DPIA-Completion-Rate | count(dpia.status='completed') / count(dpia_required) | monthly |
| DSR-Timeliness | avg(dsr.closed_at - dsr.received_at) for last-12m | weekly |
| DSR-Extension-Rate | count(dsr.extended=true) / total_dsr | monthly |
| Breach-72h-Compliance | count(breach.reported_within_72h) / total_reportable | monthly |
| Breach-Frequency | count(breaches) / month | monthly |
| Active-TIA-Count | count(tia.status='active') | weekly |
| High-Risk-Transfer-% | count(tia WHERE residual_risk='unacceptable') / total | monthly |
| Consent-Withdrawal-Rate | count(consent WHERE withdrawn_in_30d) / total_active | weekly |
| Overdue-Retention-Executions | count(deletion_request WHERE due < now AND status != 'completed') | daily |
| AVV-Review-Overdue | count(avv WHERE last_reviewed > 365d) | weekly |

## 11. Session-Outcome

**Dieses Dokument (Iter 1)**:
- ✅ DPMS-Plan mit 9 parallelen Workflows + Annual-Assessment
- ✅ GDPR-Art-5-bis-49-Mapping auf Entities
- ✅ Entity-Katalog (22 vorhanden, 9 neu)
- ✅ ~60 API-Endpoints skizziert
- ✅ ~35 UI-Pages skizziert
- ✅ 15 Workflow-Gates
- ✅ 12-dokumentiges Evidence-Pack
- ✅ 12 KPIs

**Besonderheit vs. ISMS/BCMS**: DPMS ist **kein Zyklus, sondern
9 parallele Register** mit unterschiedlichen Triggers. Die Annual-
Assessment-Schiene dient als Aggregations-Layer, nicht als primaerer
Workflow.

**Geschaetzter Implementation-Aufwand**:
- Backend: 120-160 Stunden
- Frontend (viele Wizards + Public-Pages + Dashboards): 160-220 Stunden
- Testing: 50-70 Stunden
- Legal-Review der Templates: 20-40 Stunden (externe Juristen)
- **Total: ~430 Stunden (~5-6 Personen-Wochen)**

**Offen fuer naechste Sessions**:
- Iter 2: DSR-Portal fuer Betroffene (Public-UI, Identity-Verification, eSignatur)
- Iter 3: AVV-Template-Engine mit DSK-Muster-Kompatibilitaet
- Iter 4: Breach-Response-Playbooks fuer DE-Landesbehoerden
