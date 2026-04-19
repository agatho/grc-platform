/**
 * Inline handbook for the 15 core modules.
 *
 * Rendered on-demand via the help button in the header. Each entry is short
 * enough for a user to read without leaving their task — if they need more,
 * the deep-links point at the full UI. Language is DE + EN because German
 * customers are the primary target but international tenants exist.
 *
 * The structure is kept flat per-module and handwritten, not generated. A
 * generator would produce prose that's too generic to be useful. The cost
 * of writing 15 hand-tuned entries is repaid the first time a user avoids
 * a support ticket.
 */

export interface HandbookSection {
  headingDe: string;
  headingEn: string;
  bodyDe: string;
  bodyEn: string;
}

export interface ModuleHandbook {
  /** Module key — matches module_definition.moduleKey */
  key: string;
  titleDe: string;
  titleEn: string;
  /** One-sentence summary shown under the title */
  taglineDe: string;
  taglineEn: string;
  /** The regulatory frameworks this module principally supports */
  frameworks: string[];
  /** Sections in the order they should render */
  sections: HandbookSection[];
  /** Links to deep-dive docs / external references */
  externalLinks?: { labelDe: string; labelEn: string; href: string }[];
}

// Shared section factory for the "Three Lines of Defense" attribution pattern.
const lodSection = (line: "1st" | "2nd" | "3rd", rolesDe: string, rolesEn: string): HandbookSection => ({
  headingDe: `${line === "1st" ? "1." : line === "2nd" ? "2." : "3."} Verteidigungslinie`,
  headingEn: `${line} line of defense`,
  bodyDe: rolesDe,
  bodyEn: rolesEn,
});

export const MODULE_HANDBOOKS: Record<string, ModuleHandbook> = {
  erm: {
    key: "erm",
    titleDe: "Enterprise Risk Management (ERM)",
    titleEn: "Enterprise Risk Management (ERM)",
    taglineDe: "Unternehmensweite Erfassung, Bewertung und Steuerung von Risiken.",
    taglineEn: "Organisation-wide identification, assessment and treatment of risks.",
    frameworks: ["ISO 31000:2018", "COSO ERM 2017", "FAIR", "ISO 27005", "NIST 800-30"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "ERM zentralisiert alle Risiken — strategisch, operationell, finanziell, Informationssicherheits-, ESG-Risiken — in einem Register mit einheitlicher Bewertungsmethodik. Jedes Risiko ist mit Assets, Kontrollen, Maßnahmen und Budgets verknüpft. KRIs messen die Wirksamkeit, FAIR quantifiziert monetär, RCSA sichert die Selbstbewertung der 1. Linie.",
        bodyEn: "ERM centralises every risk — strategic, operational, financial, information security, ESG — in one register using a unified methodology. Each risk links to assets, controls, treatments and budgets. KRIs measure effectiveness, FAIR quantifies monetarily, RCSA captures first-line self-assessment.",
      },
      {
        headingDe: "Kernartefakte",
        headingEn: "Core artefacts",
        bodyDe: "Risikoregister, KRI-Zeitreihen, Risk Appetite Statements, Risikomatrix, FAIR-Szenarien, RCSA-Kampagnen, Risiko-Asset-Kopplungen, Risikobehandlungspläne mit Kosten-/Effort-Feldern.",
        bodyEn: "Risk register, KRI time series, risk appetite statements, risk matrix, FAIR scenarios, RCSA campaigns, risk-asset links, risk treatment plans with cost/effort fields.",
      },
      {
        headingDe: "Typischer Ablauf",
        headingEn: "Typical workflow",
        bodyDe: "1. Risiko erfassen (Identifikation) · 2. Inherent-Bewertung (Methodik aus Settings) · 3. Bestehende Kontrollen zuordnen · 4. Residualbewertung · 5. Behandlung wählen (akzeptieren/mitigieren/übertragen/vermeiden) · 6. Maßnahmen mit Budget + Owner · 7. KRI/FAIR-Monitoring · 8. periodischer Review.",
        bodyEn: "1. Capture risk (identification) · 2. Inherent rating (methodology from Settings) · 3. Map existing controls · 4. Residual rating · 5. Choose treatment (accept/mitigate/transfer/avoid) · 6. Actions with budget + owner · 7. KRI/FAIR monitoring · 8. periodic review.",
      },
      lodSection(
        "2nd",
        "Risk Manager als 2. Linie koordiniert Methodik, Register und Aggregation. Process/Control Owner bewerten operativ.",
        "Risk Manager as 2nd line coordinates methodology, register and aggregation. Process/Control Owners assess operationally.",
      ),
      {
        headingDe: "Wichtige Einstellungen",
        headingEn: "Key settings",
        bodyDe: "Einstellungen → Risiko-Methodik (Skalen, Matrix, FAIR-Parameter), Risk Appetite, Review-Zyklen.",
        bodyEn: "Settings → Risk methodology (scales, matrix, FAIR parameters), Risk appetite, Review cycles.",
      },
    ],
  },
  isms: {
    key: "isms",
    titleDe: "Information Security Management System (ISMS)",
    titleEn: "Information Security Management System (ISMS)",
    taglineDe: "ISO-27001-konformes ISMS mit Schutzbedarf, Bedrohungen, SoA und Reifegrad-Monitoring.",
    taglineEn: "ISO 27001-compliant ISMS with protection needs, threats, SoA, and maturity monitoring.",
    frameworks: ["ISO 27001:2022", "ISO 27002:2022", "ISO 27005:2022", "BSI IT-Grundschutz", "NIS2", "DORA", "EU AI Act", "TISAX"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Ein zertifizierbares Informationssicherheits-Managementsystem. Assets → Schutzbedarf → Bedrohungen × Schwachstellen → Risiken → Annex-A-Kontrollen (SoA) → Nachweise → Audit. Inklusive NIS2-Meldeketten, DORA-Resilienztests und EU-AI-Act-Full-Compliance (13 DB-Tabellen, 14 Seiten).",
        bodyEn: "A certifiable information security management system. Assets → protection needs → threats × vulnerabilities → risks → Annex A controls (SoA) → evidence → audit. Includes NIS2 reporting chains, DORA resilience tests and EU AI Act full compliance (13 DB tables, 14 pages).",
      },
      {
        headingDe: "Kernartefakte",
        headingEn: "Core artefacts",
        bodyDe: "Asset-Inventar, Schutzbedarfsanalyse, Bedrohungs- und Schwachstellenkatalog (ISO 27005 + BSI), IS-Risiken, SoA mit 93 Annex-A-Kontrollen, Reifegradmessung (5 Stufen), Management-Reviews, Incident-Playbooks, CAPs, ISO-27001-Zertifikatsmappe.",
        bodyEn: "Asset inventory, protection needs analysis, threat and vulnerability catalogs (ISO 27005 + BSI), IS risks, SoA with 93 Annex A controls, maturity measurement (5 levels), management reviews, incident playbooks, CAPs, ISO 27001 certification dossier.",
      },
      {
        headingDe: "Typischer Ablauf",
        headingEn: "Typical workflow",
        bodyDe: "1. Scope definieren · 2. Assets inventarisieren + Schutzbedarf · 3. Bedrohungen × Schwachstellen → IS-Risiken · 4. Bewertung in ERM-Synchronisation · 5. Kontrollen auswählen (SoA) · 6. Nachweise sammeln · 7. Internes Audit (Modul Audit) · 8. Management-Review · 9. CAPs verfolgen.",
        bodyEn: "1. Define scope · 2. Inventory assets + protection needs · 3. Threats × vulnerabilities → IS risks · 4. Assessment with ERM sync · 5. Select controls (SoA) · 6. Gather evidence · 7. Internal audit (Audit module) · 8. Management review · 9. Follow up on CAPs.",
      },
      lodSection(
        "2nd",
        "CISO / Security Officer als 2. Linie. Asset Owner und System Owner in der 1. Linie. Externe Auditoren nutzen das Modul lesend für den Zertifizierungsaudit.",
        "CISO / security officer as 2nd line. Asset owners and system owners in the 1st line. External auditors use the module read-only for the certification audit.",
      ),
      {
        headingDe: "Wichtige Einstellungen",
        headingEn: "Key settings",
        bodyDe: "SoA-Aktivierung/Ausschluss, Management-Review-Zyklus, Reifegradmodell, Incident-Klassifizierungsmatrix (DORA/NIS2).",
        bodyEn: "SoA activation/exclusion, management review cycle, maturity model, incident classification matrix (DORA/NIS2).",
      },
    ],
  },
  ics: {
    key: "ics",
    titleDe: "Internes Kontrollsystem (ICS)",
    titleEn: "Internal Control System (ICS)",
    taglineDe: "Kontrollbibliothek, Testkampagnen, Mängelmanagement und Evidence-Sammlung.",
    taglineEn: "Control library, test campaigns, finding management and evidence collection.",
    frameworks: ["COSO Internal Control 2013", "COBIT 2019", "IDW PS 980/981/982/986", "SOX", "ISAE 3402 / SOC 2"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Zentrales Repository aller internen Kontrollen mit periodischen Tests, Evidence-Anhängen und Mängelnachverfolgung. Risiken werden über die Risk-Control-Matrix (RCM) auf Kontrollen abgebildet. Design- und Wirksamkeitsprüfungen folgen ISA 315 / IDW PS 981.",
        bodyEn: "Central repository of all internal controls with periodic tests, evidence attachments and finding follow-up. Risks map to controls via the Risk-Control-Matrix (RCM). Design and operating-effectiveness tests follow ISA 315 / IDW PS 981.",
      },
      {
        headingDe: "Kernartefakte",
        headingEn: "Core artefacts",
        bodyDe: "Kontroll-Objekt (type, frequency, owner, automated/manual), Test-Kampagnen, Kontrolltests mit Stichproben, Findings (shared mit Audit), Evidence (Dokumente, Screenshots, exported Reports), RCM.",
        bodyEn: "Control object (type, frequency, owner, automated/manual), test campaigns, control tests with samples, findings (shared with Audit), evidence (documents, screenshots, exported reports), RCM.",
      },
      {
        headingDe: "Typischer Ablauf",
        headingEn: "Typical workflow",
        bodyDe: "1. Kontrollen aus Framework/Katalog oder eigene erfassen · 2. Owner + Frequenz + Evidence-Art festlegen · 3. Test-Kampagne starten · 4. Tests durchführen (Pass/Fail/Partial) · 5. Mängel dokumentieren · 6. Remediation tracken · 7. Rezertifizierung.",
        bodyEn: "1. Capture controls from framework/catalog or custom · 2. Set owner + frequency + evidence type · 3. Launch test campaign · 4. Execute tests (Pass/Fail/Partial) · 5. Document findings · 6. Track remediation · 7. Recertification.",
      },
      lodSection(
        "1st",
        "Control Owner ist 1. Linie, operativ verantwortlich. Risk Manager / Compliance Officer in der 2. Linie. Interne Revision prüft unabhängig (3. Linie).",
        "Control owner is 1st line, operationally accountable. Risk manager / compliance officer in 2nd line. Internal audit reviews independently (3rd line).",
      ),
    ],
  },
  dpms: {
    key: "dpms",
    titleDe: "Datenschutz-Managementsystem (DPMS)",
    titleEn: "Data Protection Management System (DPMS)",
    taglineDe: "GDPR-konformes Datenschutzmanagement: RoPA, DPIA, Betroffenenrechte, Meldungen.",
    taglineEn: "GDPR-compliant privacy management: RoPA, DPIA, data subject rights, breach notification.",
    frameworks: ["GDPR (EU 2016/679)", "BDSG", "ISO 27701:2019 PIMS", "ISO 27018:2019", "TOMs (Art. 32 GDPR)"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Komplettes Datenschutz-Managementsystem: Verarbeitungsverzeichnis (Art. 30), DPIAs, Betroffenenrechte-Tickets (DSR), Datenpannen mit 72-h-Uhr, Drittland-Transfers (TIA / SCC), Einwilligungen und Aufbewahrung.",
        bodyEn: "End-to-end privacy management: records of processing (Art. 30), DPIAs, data subject request tickets (DSR), data breaches with 72-hour timer, third-country transfers (TIA / SCC), consents and retention.",
      },
      {
        headingDe: "Kernartefakte",
        headingEn: "Core artefacts",
        bodyDe: "RoPA-Einträge, DPIA mit Risikomatrix + Maßnahmen, DSR-Lebenszyklus (Eingang → Validierung → Bearbeitung → Antwort), Data-Breach mit DORA/NIS2/GDPR-Fristtimer, TIA, Consent-Records, Retention-Rules, Processor-Agreements (Art. 28).",
        bodyEn: "RoPA entries, DPIA with risk matrix + measures, DSR lifecycle (intake → validation → processing → response), data breach with DORA/NIS2/GDPR deadline timers, TIA, consent records, retention rules, processor agreements (Art. 28).",
      },
      {
        headingDe: "Typischer Ablauf",
        headingEn: "Typical workflow",
        bodyDe: "1. RoPA-Eintrag pro Verarbeitungstätigkeit · 2. Bei hohem Risiko: DPIA · 3. TIA bei Drittlandtransfer · 4. Auftragsverarbeiter-Verträge · 5. Laufender Betrieb: DSR-Tickets, ggf. Data-Breach · 6. Aufbewahrungsplan überwachen.",
        bodyEn: "1. RoPA entry per processing activity · 2. DPIA if high risk · 3. TIA for third-country transfer · 4. Processor agreements · 5. Ongoing: DSR tickets, data breaches · 6. Monitor retention.",
      },
      lodSection(
        "2nd",
        "DPO (Data Protection Officer) als 2. Linie mit Vetorecht. Prozess-Owner erfassen in der 1. Linie. Audit / externe Aufsicht in der 3. Linie.",
        "DPO (data protection officer) as 2nd line with veto right. Process owners capture in 1st line. Audit / external supervisory authority in 3rd line.",
      ),
      {
        headingDe: "Wichtige Einstellungen",
        headingEn: "Key settings",
        bodyDe: "Aufbewahrungsfristen (Art. 5 Speicherbegrenzung), TIA-Schwellenwerte, Standard-TOMs, Einwilligungs-Rückruf-Workflow, DSR-Fristen.",
        bodyEn: "Retention deadlines (Art. 5 storage limitation), TIA thresholds, default TOMs, consent withdrawal workflow, DSR deadlines.",
      },
    ],
  },
  bcms: {
    key: "bcms",
    titleDe: "Business Continuity Management System (BCMS)",
    titleEn: "Business Continuity Management System (BCMS)",
    taglineDe: "ISO-22301-konformes BCMS mit BIA, Plänen, Übungen und Krisen-Lifecycle.",
    taglineEn: "ISO 22301-compliant BCMS with BIA, plans, exercises and crisis lifecycle.",
    frameworks: ["ISO 22301:2019", "NIS2 Art. 21(d)", "DORA Kap. III", "BSI 200-4"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Business-Continuity: Prozesse werden kritikalitätsbasiert bewertet (BIA → RTO/RPO/MTPD/MBCO), Notfallpläne (BCP) pro Prozess, Krisenszenarien mit DORA 4-h-/72-h-/1-m-Timer, jährliche Übungen nach ISO 22301 Kap. 8.5.",
        bodyEn: "Business continuity: processes are scored by criticality (BIA → RTO/RPO/MTPD/MBCO), business-continuity plans (BCP) per process, crisis scenarios with DORA 4h/72h/1m timer, annual exercises per ISO 22301 clause 8.5.",
      },
      {
        headingDe: "Kernartefakte",
        headingEn: "Core artefacts",
        bodyDe: "BIA-Assessment (je Prozess), BCP (Runbook, Rollen, Eskalationsbaum), Krisen-Szenarien, BC-Strategien (Ausweich, Redundanz, Wiederherstellung), Übungsprotokolle, Readiness-Monitor.",
        bodyEn: "BIA assessment (per process), BCP (runbook, roles, escalation tree), crisis scenarios, BC strategies (failover, redundancy, recovery), exercise protocols, readiness monitor.",
      },
      {
        headingDe: "Typischer Ablauf",
        headingEn: "Typical workflow",
        bodyDe: "1. BIA pro Prozess → Ableitung RTO/RPO · 2. BCP je kritischem Prozess · 3. Strategien zuordnen · 4. Übung jährlich, Test alle 6 Mon · 5. Bei echtem Vorfall: Krise aktivieren → DORA-Timer läuft · 6. Nachbereitung als Finding.",
        bodyEn: "1. BIA per process → derive RTO/RPO · 2. BCP per critical process · 3. Map strategies · 4. Annual exercise, test every 6 mo · 5. Real incident: activate crisis → DORA timer starts · 6. Post-mortem as finding.",
      },
    ],
  },
  audit: {
    key: "audit",
    titleDe: "Audit Management",
    titleEn: "Audit Management",
    taglineDe: "Interne Revision: Universe → Plan → Durchführung → QA-Review nach IIA Standards.",
    taglineEn: "Internal audit: universe → plan → execution → QA review per IIA Standards.",
    frameworks: ["IIA Standards 2024", "IIR DIIR-Standards", "ISA 315", "IDW PS 983"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Dritte Verteidigungslinie. Audit Universe listet alle prüfbaren Einheiten mit Risiko-Score; der risikoorientierte Jahresplan wird vom CAE freigegeben; Durchführung mit Checklisten, Stichproben, Evidence, Findings; QA-Review schließt den Zyklus.",
        bodyEn: "Third line of defense. Audit universe lists every auditable unit with a risk score; the risk-based annual plan is CAE-approved; execution uses checklists, samples, evidence and findings; QA review closes the cycle.",
      },
      {
        headingDe: "Kernartefakte",
        headingEn: "Core artefacts",
        bodyDe: "Audit-Universe-Eintrag, Audit-Plan (Jahresplan), Audit (Einzelauftrag), Checkliste, Audit-Evidence, Findings, QA-Review.",
        bodyEn: "Audit universe entry, audit plan (annual), audit (individual engagement), checklist, audit evidence, findings, QA review.",
      },
      lodSection(
        "3rd",
        "Interne Revision (auditor) und Chief Audit Executive (CAE). Lesezugriff auf alle anderen Module ist gesetzlich verankert.",
        "Internal audit (auditor) and Chief Audit Executive (CAE). Read-only access across modules is mandated.",
      ),
    ],
  },
  tprm: {
    key: "tprm",
    titleDe: "Third-Party Risk Management (TPRM)",
    titleEn: "Third-Party Risk Management (TPRM)",
    taglineDe: "Vendor-Onboarding, Due Diligence, LkSG, Konzentrationsrisiko, Exit-Pläne.",
    taglineEn: "Vendor onboarding, due diligence, LkSG supply-chain, concentration risk, exit plans.",
    frameworks: ["LkSG (Lieferkettensorgfaltspflichtengesetz)", "EU CSDDD", "DORA Kap. V", "ISO 27036"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Ein Register aller Dienstleister mit Kritikalitäts-Einstufung, Due-Diligence-Sitzungen, Vertrags- und SLA-Tracking, Scorecards, Konzentrationsrisiko-Analyse, Sub-Processor-Kette und Exit-Plänen nach DORA Art. 28.",
        bodyEn: "Register of all providers with criticality tiering, DD sessions, contract and SLA tracking, scorecards, concentration risk analysis, sub-processor chain and exit plans per DORA Art. 28.",
      },
      {
        headingDe: "Kernartefakte",
        headingEn: "Core artefacts",
        bodyDe: "Vendor-Stammdaten, Due-Diligence-Session (TPRM-DD-Kampagne), LkSG-Assessment, Scorecard, Konzentrationsanalyse, Sub-Processor-Register, Exit-Plan.",
        bodyEn: "Vendor master data, due diligence session, LkSG assessment, scorecard, concentration analysis, sub-processor registry, exit plan.",
      },
    ],
  },
  contract: {
    key: "contract",
    titleDe: "Vertragsmanagement",
    titleEn: "Contract Management",
    taglineDe: "Vertrags-Lifecycle, SLA-Monitoring und Pflichtenverfolgung.",
    taglineEn: "Contract lifecycle, SLA monitoring and obligation tracking.",
    frameworks: ["DORA (ICT-Verträge)", "GDPR Art. 28 (AVV)", "ISO 15489"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Zentrale Ablage aller Verträge mit Laufzeit-Alerts, SLA-Klauseln, Vertragspflichten und Genehmigungs-Workflows.",
        bodyEn: "Central repository of all contracts with renewal alerts, SLA clauses, obligations and approval workflows.",
      },
      {
        headingDe: "Kernartefakte",
        headingEn: "Core artefacts",
        bodyDe: "Vertragskopf, Klausel-Bibliothek, SLA-Kennzahlen, Pflichten-Kalender, Vertragsänderungen.",
        bodyEn: "Contract header, clause library, SLA KPIs, obligation calendar, amendments.",
      },
    ],
  },
  bpm: {
    key: "bpm",
    titleDe: "Business Process Management (BPM)",
    titleEn: "Business Process Management (BPM)",
    taglineDe: "BPMN-2.0-Modellierung, Process Mining, KPIs und Governance.",
    taglineEn: "BPMN 2.0 modelling, process mining, KPIs and governance.",
    frameworks: ["BPMN 2.0", "ISO 9001", "Six Sigma"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Formale Modellierung von Geschäftsprozessen (BPMN 2.0) mit Versionierung, Ownership, Review-Zyklen und Kontroll-Verknüpfung. Process Mining liest Event-Logs aus Quellsystemen; KPIs messen die Wirksamkeit.",
        bodyEn: "Formal business process modelling (BPMN 2.0) with versioning, ownership, review cycles and control mapping. Process mining ingests event logs from source systems; KPIs measure effectiveness.",
      },
      {
        headingDe: "Kernartefakte",
        headingEn: "Core artefacts",
        bodyDe: "Prozess-Header (Level 1-4), BPMN-Versionen, Prozessschritte, Prozess-Kontrollen (RCM), KPIs, Reifegradmodell.",
        bodyEn: "Process header (level 1-4), BPMN versions, process steps, process controls (RCM), KPIs, maturity model.",
      },
    ],
  },
  dms: {
    key: "dms",
    titleDe: "Document Management System (DMS)",
    titleEn: "Document Management System (DMS)",
    taglineDe: "Versionierte Dokumente mit Genehmigungen, Verteilerlisten und Compliance-Flag.",
    taglineEn: "Versioned documents with approvals, distribution lists and compliance flag.",
    frameworks: ["ISO 27001 A.5", "ISO 9001", "ISO 15489"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Richtlinien, Verfahrensanweisungen, Formulare und Nachweisdokumente zentral ablegen. Alle Versionen werden als append-only Historie aufbewahrt. Lese-Quittung für verpflichtende Policies.",
        bodyEn: "Central storage for policies, procedures, forms and evidence records. All versions are kept as append-only history. \"Read receipts\" for mandatory policies.",
      },
    ],
  },
  eam: {
    key: "eam",
    titleDe: "Enterprise Architecture Management (EAM)",
    titleEn: "Enterprise Architecture Management (EAM)",
    taglineDe: "Capability-, App-, Daten- und Tech-Landschaft mit Governance.",
    taglineEn: "Capability, app, data and tech landscape with governance.",
    frameworks: ["TOGAF", "ArchiMate", "IT4IT"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Konsolidierte Sicht auf die IT- und Fachlandschaft: Capabilities, Applikationen, Datenflüsse, Tech-Radar. Dient als Grundlage für Modernisierungs- und Risikoentscheidungen.",
        bodyEn: "Consolidated view of the IT and business landscape: capabilities, applications, data flows, tech radar. Foundation for modernisation and risk decisions.",
      },
    ],
  },
  esg: {
    key: "esg",
    titleDe: "ESG & Sustainability",
    titleEn: "ESG & Sustainability",
    taglineDe: "CSRD/ESRS-konforme Nachhaltigkeits-Berichterstattung inkl. Doppelter Wesentlichkeit.",
    taglineEn: "CSRD/ESRS-compliant sustainability reporting incl. double materiality.",
    frameworks: ["CSRD / ESRS", "GRI Standards", "TCFD", "GHG Protocol", "EU Taxonomie"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Vollständige ESG-Prozesskette: Doppelte Wesentlichkeit → Datenpunkte (E1-E5, S1-S4, G1) → Metriken → Emissionsbilanz → Ziele → Report. Integriert Tax-CMS und EU-Taxonomie.",
        bodyEn: "End-to-end ESG process: double materiality → datapoints (E1-E5, S1-S4, G1) → metrics → emissions → targets → report. Integrates Tax CMS and EU Taxonomy.",
      },
    ],
  },
  whistleblowing: {
    key: "whistleblowing",
    titleDe: "Hinweisgebersystem",
    titleEn: "Whistleblowing",
    taglineDe: "HinSchG-konformes Hinweisgebersystem — isoliert, rollengebunden, anonymisierbar.",
    taglineEn: "HinSchG-compliant whistleblowing — isolated, role-locked, anonymisable.",
    frameworks: ["EU-Hinweisgeberrichtlinie (2019/1937)", "HinSchG (DE)"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Rechtlich isoliertes Modul — nur `whistleblowing_officer` und Ombudsperson haben Zugriff. Andere Admins sehen das Modul nicht. Eingänge sind anonymisierbar. Statistik-Reports ohne personenbezogene Daten.",
        bodyEn: "Legally isolated module — only `whistleblowing_officer` and ombudsperson have access. Other admins cannot see the module. Reports are anonymisable. Statistics reports contain no personal data.",
      },
    ],
  },
  reporting: {
    key: "reporting",
    titleDe: "Reporting & Export",
    titleEn: "Reporting & Export",
    taglineDe: "Report-Templates, PDF/Excel/CSV-Export, geplante Auslieferung.",
    taglineEn: "Report templates, PDF/Excel/CSV export, scheduled delivery.",
    frameworks: ["XBRL (für regulatorische Reports)", "ISAE 3402 Reports"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Zentrale Render-Engine für alle Reports. Templates können pro Organisation angepasst werden. Geplante Exports laufen im Worker und landen per E-Mail oder S3 beim Empfänger.",
        bodyEn: "Central render engine for all reports. Templates are per-org customisable. Scheduled exports run in the worker and ship via email or S3.",
      },
    ],
  },
  academy: {
    key: "academy",
    titleDe: "GRC Academy",
    titleEn: "GRC Academy",
    taglineDe: "Schulungen, Onboarding und rollenspezifische Zertifikate.",
    taglineEn: "Trainings, onboarding and role-specific certificates.",
    frameworks: ["ISO 27001 A.6.3 (Awareness)", "NIS2 Art. 20 (Training)", "DORA Art. 13"],
    sections: [
      {
        headingDe: "Zweck",
        headingEn: "Purpose",
        bodyDe: "Integriertes LMS: verpflichtende Schulungen je Rolle (z.B. Informationssicherheit für alle Mitarbeiter), Abschluss-Zertifikate mit Audit-Trail, Awareness-Quizzes.",
        bodyEn: "Integrated LMS: role-based mandatory trainings (e.g. security awareness for all staff), completion certificates with audit trail, awareness quizzes.",
      },
    ],
  },
};

// Resolve the module handbook for a URL path, e.g. /isms/threats → ISMS.
export function resolveHandbookForPath(pathname: string): ModuleHandbook | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const first = segments[0];

  // Direct module-key match
  if (MODULE_HANDBOOKS[first]) return MODULE_HANDBOOKS[first];

  // Path aliases — URL segments that aren't literal module keys
  const ALIASES: Record<string, string> = {
    risks: "erm",
    erm: "erm",
    rcsa: "erm",
    "predictive-risk": "erm",
    budget: "erm",
    controls: "ics",
    "control-testing": "ics",
    "ai-act": "isms",
    dora: "isms",
    documents: "dms",
    processes: "bpm",
    bpm: "bpm",
    contracts: "contract",
    tprm: "tprm",
    isms: "isms",
    audit: "audit",
    bcms: "bcms",
    dpms: "dpms",
    esg: "esg",
    "tax-cms": "esg",
    eam: "eam",
    whistleblowing: "whistleblowing",
    academy: "academy",
    reports: "reporting",
  };

  const resolved = ALIASES[first];
  return resolved ? MODULE_HANDBOOKS[resolved] ?? null : null;
}
