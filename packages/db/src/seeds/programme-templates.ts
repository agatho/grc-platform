// Programme Cockpit — Template Seeds
//
// Seeds für 4 Norm-Templates:
//   - ISO 27001:2022 (ISMS, 23 Schritte aus Y1-Roadmap)
//   - ISO 22301:2019 (BCMS, 18 Schritte)
//   - GDPR / EU 2016/679 (DPMS, 14 Schritte)
//   - ISO 42001:2023 (AIMS, 16 Schritte)
//
// Bezug: docs/isms-bcms/03-roadmap-year-1.md

import { db } from "../index";
import {
  programmeTemplate,
  programmeTemplatePhase,
  programmeTemplateStep,
  programmeTemplateSubtask,
  type MsType,
  type PdcaPhase,
} from "../schema/programme";
import { eq, and } from "drizzle-orm";
import { CIS_TEMPLATES } from "./cis-controls-templates";

// ──────────────────────────────────────────────────────────────
// Type-defs für Seed-Daten
// ──────────────────────────────────────────────────────────────

interface SeedPhase {
  code: string;
  sequence: number;
  name: string;
  description?: string;
  pdcaPhase: PdcaPhase;
  defaultDurationDays: number;
  isGate?: boolean;
  gateCriteria?: Array<{ check: string; description: string }>;
}

interface SeedSubtask {
  title: string;
  description?: string;
  defaultOwnerRole?: string;
  defaultDurationDays?: number;
  deliverableType?: string;
  isMandatory?: boolean;
}

interface SeedStep {
  code: string;
  phaseCode: string;
  sequence: number;
  name: string;
  description?: string;
  isoClause?: string;
  defaultOwnerRole?: string;
  defaultDurationDays: number;
  prerequisiteStepCodes?: string[];
  targetModuleLink?: {
    module?: string;
    route?: string;
    entityType?: string;
    createIfMissing?: boolean;
  };
  requiredEvidenceCount?: number;
  isMandatory?: boolean;
  isMilestone?: boolean;
  subtasks?: SeedSubtask[];
}

interface SeedTemplate {
  code: string;
  msType: MsType;
  name: string;
  description: string;
  version: string;
  frameworkCodes: string[];
  estimatedDurationDays: number;
  phases: SeedPhase[];
  steps: SeedStep[];
}

// ──────────────────────────────────────────────────────────────
// ISO 27001:2022 — granulare Schritte mit Subtasks
// ──────────────────────────────────────────────────────────────

const ISO_27001_STEPS: SeedStep[] = [
  // ── Setup ──
  {
    code: "S00-CHARTER",
    phaseCode: "setup",
    sequence: 0,
    name: "GL-Commitment & Programm-Charter",
    description:
      "Bevor irgendeine ISMS-Arbeit beginnt, muss die Geschäftsleitung das Programm formal beauftragen, Budget freigeben und einen Lenkungsausschuss benennen. Output ist ein unterzeichnetes Charter-Dokument inkl. Sponsorenrolle, Eskalationspfad und Erstbudget. Ohne diese Schritte bleibt jede ISMS-Arbeit ohne Mandat und scheitert spätestens beim ersten Ressourcenkonflikt.",
    isoClause: "5.1",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    requiredEvidenceCount: 1,
    isMilestone: true,
    targetModuleLink: { module: "documents", route: "/documents" },
    subtasks: [
      {
        title: "Initial-Briefing für GL vorbereiten",
        description:
          "Foliendeck mit Treibern (NIS2-Pflicht, Kunden-Anforderungen, Wettbewerbslage), Nutzen, Aufwand und Zeithorizont. ~12 Folien, 30-Minuten-Termin einplanen.",
        defaultOwnerRole: "risk_manager",
        defaultDurationDays: 3,
        deliverableType: "presentation",
      },
      {
        title: "Charter-Entwurf schreiben",
        description:
          "Inhalte: Ziel, Geltungsbereich (Hochlevel), Sponsoren, Steering-Committee-Mitglieder, Budget Y1, Reporting-Kadenz, Eskalationspfad. Vorlage in /policies hinterlegen.",
        defaultOwnerRole: "admin",
        defaultDurationDays: 5,
        deliverableType: "policy",
      },
      {
        title: "Lenkungsausschuss benennen + Termine setzen",
        description:
          "Mitglieder: CEO/Geschäftsführer, CFO, CIO/CISO, ggf. CISO-Vertreter Tochter. Quartalstermine über das Jahr im Kalender blocken.",
        defaultOwnerRole: "admin",
        defaultDurationDays: 2,
      },
      {
        title: "Charter durch GL unterzeichnen lassen",
        description:
          "Originalunterschrift + signiertes PDF. Dokument als Evidence am Schritt verlinken.",
        defaultOwnerRole: "admin",
        defaultDurationDays: 4,
        deliverableType: "evidence",
      },
    ],
  },

  // ── Plan ──
  {
    code: "Y1-M1-01",
    phaseCode: "plan",
    sequence: 1,
    name: "Stakeholder-Analyse + Stakeholder-Register",
    description:
      "ISO 27001 §4.2 verlangt explizit, dass interessierte Parteien identifiziert und ihre relevanten Anforderungen festgehalten sind. Ergebnis: Stakeholder-Register mit Erwartungen, Power/Interest-Bewertung und Engagement-Strategie pro Gruppe. Dieses Register ist Grundlage für Scope-Bestimmung und Politikinhalte.",
    isoClause: "4.2",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["S00-CHARTER"],
    targetModuleLink: { module: "platform", route: "/programmes" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Stakeholder-Workshop (2 h) durchführen",
        description:
          "Teilnehmer: Sponsoren, Risk Manager, DPO, IT-Leitung. Brainstorming aller relevanten Parteien (intern, extern, regulatorisch, Kunden, Lieferanten).",
        defaultDurationDays: 2,
      },
      {
        title: "Erwartungen und Anforderungen je Stakeholder dokumentieren",
        description:
          "Pro Stakeholder: Was erwarten sie vom ISMS? Welche Compliance-Anforderungen treffen uns durch sie (z.B. Kundenverträge, Aufsichtsbehörden)?",
        defaultDurationDays: 5,
      },
      {
        title: "Power/Interest-Matrix erstellen",
        description:
          "Klassifikation in 4 Quadranten: Manage Closely / Keep Satisfied / Keep Informed / Monitor. Treiber für Engagement-Strategie.",
        defaultDurationDays: 2,
      },
      {
        title: "Engagement-Strategie pro Schlüssel-Stakeholder festlegen",
        description:
          "Kommunikationskadenz, Format (Steering, Newsletter, Bilateral) und verantwortlicher Sprecher.",
        defaultDurationDays: 3,
      },
      {
        title: "Stakeholder-Register im Modul Platform hinterlegen",
        description:
          "Register als versioniertes Dokument (CSV/XLSX) im Documents-Modul; Update-Kadenz quartalsweise.",
        deliverableType: "register",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "Y1-M1-02",
    phaseCode: "plan",
    sequence: 2,
    name: "Externer + Interner Kontext",
    description:
      "ISO 27001 §4.1 fordert eine dokumentierte Kontextanalyse. Externe Faktoren: Markt, Regulatorik (NIS2, DORA, GDPR, BSI-Grundschutz), Lieferketten-Risiken, geopolitische Lage. Interne Faktoren: Strategie, Werte, Governance, Reife der IT, Personalverfügbarkeit, Architektur, Kultur.",
    isoClause: "4.1",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["S00-CHARTER"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "PESTEL-Analyse für externen Kontext durchführen",
        description:
          "Politisch / Wirtschaftlich / Sozial / Technologisch / Environmental / Legal — pro Dimension Treiber + IS-Implikationen.",
        defaultDurationDays: 3,
      },
      {
        title: "Regulatorischen Anwendbarkeits-Check abschließen",
        description:
          "Welche Regularien treffen uns? NIS2 (essential/important?), DORA (Finanzdienstleister?), AI Act (KI-Anwendungen?), GDPR-Spezifika, branchenspezifisch.",
        defaultDurationDays: 4,
      },
      {
        title: "Interne SWOT mit Fokus IS durchführen",
        description:
          "Stärken/Schwächen IT- und IS-Reife, Chancen/Risiken aus Strategie und Markt.",
        defaultDurationDays: 3,
      },
      {
        title: "Kontext-Dokument verabschieden",
        description:
          "Konsolidiertes Dokument vom Sponsor abnehmen lassen, im Documents-Modul versionieren.",
        deliverableType: "policy",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "Y1-M1-04",
    phaseCode: "plan",
    sequence: 3,
    name: "Geltungsbereich-Workshop & Scope-Statement",
    description:
      "Der Scope ist die wichtigste strategische Entscheidung im Programm: Welche Standorte, Geschäftsprozesse, IT-Systeme, Mitarbeiter, Tochtergesellschaften und Cloud-Dienste sind eingeschlossen? Ein zu enger Scope frustriert Auditoren und Kunden, ein zu weiter Scope sprengt Budget. Gates §4.3.",
    isoClause: "4.3",
    defaultOwnerRole: "admin",
    defaultDurationDays: 7,
    prerequisiteStepCodes: ["Y1-M1-01", "Y1-M1-02"],
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "Scope-Optionen ausarbeiten (3 Varianten)",
        description:
          "Variante A (Minimal-Scope), B (Realistic), C (Maximal). Pro Variante: einbezogene Entitäten, geschätzte Aufwände, Audit-Kosten.",
        defaultDurationDays: 3,
      },
      {
        title: "Scope-Workshop mit GL durchführen (Entscheidung)",
        description:
          "GL wählt Variante. Begründung dokumentieren. Output: einseitiges Scope-Statement mit Aufzählung aller einbezogenen Entitäten/Standorte/Systeme.",
        defaultDurationDays: 1,
      },
      {
        title: "Scope-Statement im SoA-Vorlauf hinterlegen",
        description:
          "Verknüpfung zu späterem SoA herstellen. Excludes (was bewusst nicht im Scope ist) explizit benennen.",
        deliverableType: "policy",
        defaultDurationDays: 2,
      },
      {
        title: "GL-Freigabe Scope einholen",
        description:
          "Schriftliche Freigabe (Mail oder Steering-Protokoll) als Evidence anhängen.",
        deliverableType: "evidence",
        defaultDurationDays: 1,
      },
    ],
  },
  {
    code: "Y1-M1-05",
    phaseCode: "plan",
    sequence: 4,
    name: "NIS2 / DORA-Anwendbarkeitsprüfung",
    description:
      "Prüft formal, ob das Unternehmen unter die NIS2-Richtlinie (essential/important entity) und/oder DORA (finanzsektorspezifisch) fällt. Ergebnis prägt Pflichten beim Incident Reporting (24h/72h), bei Lieferketten-Audits, bei Sanktionsrisiken.",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 7,
    prerequisiteStepCodes: ["Y1-M1-04"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "NIS2-Sektor-Klassifikation prüfen (Anhang I/II)",
        description:
          "Anhang I = essential entities (höhere Schwellen), Anhang II = important. Anhand Branche + Mitarbeiterzahl + Umsatz einordnen.",
        defaultDurationDays: 2,
      },
      {
        title: "DORA-Anwendbarkeit bewerten",
        description:
          "Trifft DORA zu (Banken, Versicherer, Finanzdienstleister, ICT-Drittparteien)? Wenn ja: zusätzliche Pflichten bei TLPT, ICT-Risk-Framework, Drittparteien.",
        defaultDurationDays: 1,
      },
      {
        title: "Pflichten-Mapping erstellen",
        description:
          "Konsolidierte Liste der Compliance-Pflichten aus NIS2/DORA mit Fristen und Verantwortlichen.",
        deliverableType: "register",
        defaultDurationDays: 3,
      },
      {
        title: "Eintragung bei zuständiger Behörde prüfen",
        description:
          "Wenn NIS2 anwendbar: BSI-Meldung als KRITIS oder NIS2 essential/important entity prüfen und ggf. einreichen.",
        defaultDurationDays: 1,
      },
    ],
  },
  {
    code: "Y1-M2-01",
    phaseCode: "plan",
    sequence: 5,
    name: "IS-Politik (Klausel 5.2)",
    description:
      "Die IS-Politik ist das normgeprägte Top-Level-Dokument. Maximal 2-3 Seiten, vom CEO unterzeichnet, an alle Mitarbeiter kommuniziert. Inhalte: Ziele (Vertraulichkeit/Integrität/Verfügbarkeit), Verpflichtung zur kontinuierlichen Verbesserung, Verbindlichkeit, Sanktionen bei Verstoß.",
    isoClause: "5.2",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["Y1-M1-04"],
    targetModuleLink: { module: "documents", route: "/policies" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "Politik-Entwurf v0.9 schreiben",
        description:
          "Norm-Pflichtinhalte: Verpflichtung zur Erfüllung, kontinuierlicher Verbesserung, Festlegung übergeordneter Ziele. Klar verständlich, kein technischer Jargon.",
        defaultDurationDays: 4,
      },
      {
        title: "Review durch Sponsoren + Legal",
        description:
          "Konsistenz mit Charter und Compliance-Anforderungen prüfen.",
        defaultDurationDays: 3,
      },
      {
        title: "Freigabe + Unterschrift CEO",
        description:
          "PDF mit Unterschrift erzeugen, Versionsdatum festlegen.",
        deliverableType: "policy",
        defaultDurationDays: 2,
      },
      {
        title: "Kommunikation an alle Mitarbeiter",
        description:
          "Mail vom CEO + Intranet-Veröffentlichung + Onboarding-Prozess aktualisieren. Log nachweisen.",
        defaultDurationDays: 3,
      },
      {
        title: "Bestätigungspflicht in HR-Prozess verankern",
        description:
          "Alle Mitarbeiter bestätigen Kenntnisnahme über Awareness-Tool. Fortschrittsbalken im Programme Cockpit pflegen.",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "Y1-M2-03",
    phaseCode: "plan",
    sequence: 6,
    name: "RACI / Rollen-Modell",
    description:
      "ISO 27001 §5.3 verlangt klare Verantwortlichkeiten. Jeder Annex-A-Kontroll-Bereich braucht einen Owner (R/A) und definierte Mitwirkende (C/I). Gleichzeitig wichtigste Brücke zum Three-Lines-of-Defense-Modell.",
    isoClause: "5.3",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["Y1-M1-04"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Rollen-Inventar erstellen",
        description:
          "Alle ISMS-relevanten Rollen mit kurzer Aufgabenbeschreibung — CISO, ISMS-Manager, Risk Manager, Control Owner, DPO, Auditor, Asset Owner.",
        defaultDurationDays: 3,
      },
      {
        title: "RACI-Matrix für Annex-A-Bereiche füllen",
        description:
          "Pro Annex-A-Bereich (5 Org/Personen/Physisch/Technologisch) Verantwortliche zuordnen.",
        deliverableType: "register",
        defaultDurationDays: 5,
      },
      {
        title: "Three-Lines-Mapping prüfen",
        description:
          "Jede Rolle einer LoD zuordnen (1st/2nd/3rd). Konflikt: Kontrolle und Audit in Personalunion ist nicht zulässig.",
        defaultDurationDays: 2,
      },
      {
        title: "Rollen formal nominieren",
        description:
          "Schriftliche Nominierung pro Schlüsselrolle durch GL/Linienvorgesetzte. Stellvertreter benennen.",
        deliverableType: "evidence",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "Y1-M2-04",
    phaseCode: "plan",
    sequence: 7,
    name: "Risiko-Methodik nach ISO 27005",
    description:
      "Definition wie Risiken identifiziert, analysiert, bewertet und behandelt werden. Kernfragen: Welche Skala (qualitativ/quantitativ/FAIR)? Welche Schwellen für High/Medium/Low? Welche Akzeptanz-Authority hat welche Schwelle? Output ist die ISMS-Risiko-Methodik als verbindliches Dokument.",
    isoClause: "6.1.2",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["Y1-M2-01"],
    targetModuleLink: { module: "erm", route: "/risks" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "Skalen festlegen (Likelihood, Impact)",
        description:
          "Mindestens 4-stufige Skalen mit klar definierten Anker-Beispielen für jede Stufe (z.B. 'Impact 4 = Existenzbedrohend').",
        defaultDurationDays: 3,
      },
      {
        title: "Risiko-Matrix kalibrieren",
        description:
          "Heatmap definieren: welche L×I-Kombinationen sind High/Medium/Low. Mit Sponsor abstimmen — beeinflusst Ressourceneinsatz direkt.",
        defaultDurationDays: 2,
      },
      {
        title: "Akzeptanz-Authority Matrix definieren",
        description:
          "Wer darf welches Risiko akzeptieren? Z.B. Low → Risk Manager, Medium → CISO, High → CEO + Board.",
        defaultDurationDays: 2,
      },
      {
        title: "Methodik-Dokument verabschieden",
        description:
          "v1.0 vom Sponsor freigeben lassen. In Catalogs/Methodologies hinterlegen.",
        deliverableType: "methodology",
        defaultDurationDays: 4,
      },
      {
        title: "Risk Manager + CISO trainieren",
        description:
          "Walkthrough der Methodik mit Anwendungsbeispielen. Erst danach starten Risk-Workshops.",
        defaultDurationDays: 3,
      },
    ],
  },
  {
    code: "Y1-M3-01",
    phaseCode: "plan",
    sequence: 8,
    name: "Asset-Erfassung Phase 1 (kritische A-/B-Assets)",
    description:
      "Voraussetzung für Risiko-Identifikation. Erfasst werden zunächst nur die geschäftskritischen Assets (Tier A/B): Kernsysteme, Crown-Jewels, Kundendaten-Stores, Auth-Systeme. Lange-Tail kommt später. Pro Asset: Owner, Schutzbedarf (CIA), Standort, Vendor, Abhängigkeiten.",
    isoClause: "A.5.9",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["Y1-M1-04"],
    targetModuleLink: { module: "isms", route: "/assets" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Tier-A/B-Kandidaten aus Geschäftsprozessen ableiten",
        description:
          "Geschäftsprozess-Inventar nutzen, kritische Prozesse priorisieren, dahinter liegende Assets identifizieren.",
        defaultDurationDays: 5,
      },
      {
        title: "Asset-Erfassungs-Workshops je Bereich",
        description:
          "IT-Infrastruktur, Application Owner, HR, Finance, Operations — Workshop pro Bereich für Asset-Inventarisierung.",
        defaultDurationDays: 8,
      },
      {
        title: "Schutzbedarf je Asset bewerten (BSI-Methodik)",
        description:
          "C-I-A jeweils Stufen normal/hoch/sehr hoch. Begründung durch Schadensszenario.",
        defaultDurationDays: 5,
      },
      {
        title: "Asset-Register im ISMS-Modul anlegen",
        description:
          "Tabellarisches Inventar mit allen Pflichtfeldern. Jährliches Review im Kalender setzen.",
        deliverableType: "register",
        defaultDurationDays: 3,
      },
    ],
  },
  {
    code: "Y1-M3-02",
    phaseCode: "plan",
    sequence: 9,
    name: "Risiko-Identifikation Workshops",
    description:
      "Pro Asset/Asset-Gruppe ein Workshop: Welche Bedrohungen sind relevant (BSI G0.x, ISO 27005 Threats, MITRE ATT&CK)? Welche Schwachstellen sind bekannt? Welche Kombination führt zu welchem Schaden? Output: roher Risikokatalog vor Bewertung.",
    isoClause: "6.1.2",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["Y1-M2-04", "Y1-M3-01"],
    targetModuleLink: { module: "isms", route: "/isms/risks" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Bedrohungskatalog auswählen",
        description:
          "Empfehlung: ISO 27005:2022 (31 Bedrohungen) + BSI-Elementargefährdungen (47). Mappings sind im Catalogs-Modul vorhanden.",
        defaultDurationDays: 2,
      },
      {
        title: "Schwachstellen-Quellen anbinden",
        description:
          "Vuln-Scans auswerten, CVE-Reports, Pen-Test-Befunde, Incident-Historie.",
        defaultDurationDays: 4,
      },
      {
        title: "Workshop-Reihe pro Asset-Gruppe (5–8 Termine)",
        description:
          "Je 2 h, mit Asset Owner + Risk Manager. Threat × Vulnerability × Asset → Risiko-Szenario.",
        defaultDurationDays: 12,
      },
      {
        title: "Roh-Risiko-Inventar im ISMS-Modul anlegen",
        description:
          "Mindestens 30–80 Risiken erwartet. Doppelzählungen entfernen, Granularität abstimmen.",
        deliverableType: "register",
        defaultDurationDays: 3,
      },
    ],
  },
  {
    code: "Y1-M3-03",
    phaseCode: "plan",
    sequence: 10,
    name: "Risiko-Analyse + Bewertung",
    description:
      "Jedes Risiko bekommt Likelihood- und Impact-Werte gemäß Methodik. Brutto- vs. Netto-Bewertung (vor/nach existierenden Maßnahmen). Top-Risiken werden priorisiert für Treatment-Plan. Output: priorisiertes Risiko-Register.",
    isoClause: "6.1.2",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["Y1-M3-02"],
    targetModuleLink: { module: "isms", route: "/isms/risks" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Brutto-Bewertung je Risiko (Likelihood × Impact)",
        description:
          "Nach Methodik. Begründung im Risiko-Eintrag dokumentieren — Auditoren werden danach fragen.",
        defaultDurationDays: 6,
      },
      {
        title: "Existierende Kontrollen pro Risiko erfassen",
        description:
          "Welche Maßnahmen existieren bereits? Aus Asset-Inventar oder bestehender SoA ableiten.",
        defaultDurationDays: 3,
      },
      {
        title: "Netto-Bewertung berechnen",
        description:
          "Brutto reduziert um Wirksamkeit existierender Kontrollen. Heatmap aktualisieren.",
        defaultDurationDays: 3,
      },
      {
        title: "Top-10 priorisieren + Sponsor-Review",
        description:
          "Sortierung nach Netto-Risiko. Top-10 mit Sponsor besprechen — diese werden im RTP zuerst behandelt.",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "Y1-M3-05",
    phaseCode: "plan",
    sequence: 11,
    name: "SoA-Entwurf (Annex A)",
    description:
      "Statement of Applicability: Pro Annex-A-Kontrolle (93 Stück) entscheiden — anwendbar/nicht anwendbar/teilweise + Begründung. Bezug zu Risiken herstellen. SoA ist eines der zentralsten Audit-Dokumente.",
    isoClause: "6.1.3 d",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["Y1-M3-03"],
    targetModuleLink: { module: "isms", route: "/isms/soa" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "Initial-Liste der 93 Annex-A-Kontrollen aktivieren",
        description:
          "ISO/IEC 27002:2022 Katalog im SoA-Modul aktivieren. Jede Kontrolle mit Default 'tba'.",
        defaultDurationDays: 1,
      },
      {
        title: "Pro Kontrolle Anwendbarkeit + Begründung dokumentieren",
        description:
          "Anwendbar = Maßnahmen geplant/umgesetzt; Nicht anwendbar = Begründung (kein Asset relevant). Halb-anwendbar zulässig wenn substantiiert.",
        defaultDurationDays: 8,
      },
      {
        title: "Risk → Control-Verknüpfung herstellen",
        description:
          "Pro anwendbarer Kontrolle: welche Risiken adressiert sie? Bidirektionales Mapping. Pflicht für Auditor-Nachweis.",
        defaultDurationDays: 3,
      },
      {
        title: "SoA v0.9 für Sponsor-Review",
        description:
          "Sponsor + CISO begutachten Vollständigkeit + Plausibilität. v1.0 bei DO-Phase.",
        deliverableType: "policy",
        defaultDurationDays: 2,
      },
    ],
  },

  // ── Do ──
  {
    code: "Y1-M4-01",
    phaseCode: "do",
    sequence: 12,
    name: "Risk-Treatment-Plan",
    description:
      "Pro Top-Risiko Strategie wählen (Mitigate/Transfer/Avoid/Accept) und konkrete Maßnahmen mit Owner + Frist + Budget hinterlegen. RTP ist die Brücke zwischen Risiko und Umsetzungsarbeit.",
    isoClause: "6.1.3",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["Y1-M3-05"],
    targetModuleLink: { module: "erm", route: "/risks" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Treatment-Strategie pro Top-Risiko festlegen",
        description:
          "Mitigate (häufigster Fall) / Transfer (Versicherung, Vertrag) / Avoid (Geschäft einstellen) / Accept (formal akzeptiert).",
        defaultDurationDays: 3,
      },
      {
        title: "Maßnahmen-Set je Risiko ausplanen",
        description:
          "Konkrete Maßnahmen mit Aufwand-Schätzung, Owner, Frist, Budgetposition.",
        defaultDurationDays: 5,
      },
      {
        title: "RTP-Dokument konsolidieren",
        description:
          "Tabellarische Form: Risiko-ID, Strategie, Maßnahmen, Owner, Frist, erwartete Restrisiko-Bewertung.",
        deliverableType: "register",
        defaultDurationDays: 4,
      },
      {
        title: "Sponsor-Freigabe + Budgetierung",
        description:
          "RTP an Steering vorstellen. Budget für Maßnahmen freigeben lassen.",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "Y1-M4-03",
    phaseCode: "do",
    sequence: 13,
    name: "Restrisiko-Akzeptanz Top-Risiken",
    description:
      "Pro Top-Risiko explizite Akzeptanz-Entscheidung dokumentieren — auch dann, wenn Mitigations laufen, ist das Restrisiko bis zur Wirksamkeit zu akzeptieren oder eskalieren.",
    isoClause: "6.1.3 f",
    defaultOwnerRole: "admin",
    defaultDurationDays: 7,
    prerequisiteStepCodes: ["Y1-M4-01"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Akzeptanz-Authority-Mapping anwenden",
        description:
          "Pro Risiko: Welche Authority muss akzeptieren? Methodik bestimmt Schwelle.",
        defaultDurationDays: 1,
      },
      {
        title: "Akzeptanzformulare ausfüllen + unterzeichnen",
        description:
          "Pro Risiko ein formales Dokument mit Begründung, Restrisiko-Bewertung, Akzeptanz-Datum, Wiedervorlage.",
        deliverableType: "evidence",
        defaultDurationDays: 4,
      },
      {
        title: "Akzeptanzen im Risk-Register verlinken",
        description:
          "Modul Risk Acceptance befüllen — Auditor erwartet diese Verbindung.",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "Y1-M5-01",
    phaseCode: "do",
    sequence: 14,
    name: "Maßnahmen Welle 1 (Patch / MFA / Backup / Hardening)",
    description:
      "Höchstpriorisierte technische Quick-Wins: vollständiger Patch-Stand, MFA für alle Privileged Accounts + remote, Backup-Strategie + Restore-Test, Server-Hardening. Diese Maßnahmen reduzieren Top-Risiken überproportional.",
    isoClause: "A.8",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 60,
    prerequisiteStepCodes: ["Y1-M4-01"],
    targetModuleLink: { module: "ics", route: "/controls" },
    requiredEvidenceCount: 2,
    subtasks: [
      {
        title: "Patch-Management formalisieren",
        description:
          "SLA für kritische Patches (≤ 7 Tage), Standard-Patches (≤ 30 Tage). Reporting-Dashboard.",
        defaultDurationDays: 14,
        deliverableType: "control",
      },
      {
        title: "MFA-Rollout für privileged accounts",
        description:
          "Admin-Accounts, externe Zugriffe, Cloud-Konsolen. Pflicht für 100% — temporär TOTP, langfristig FIDO2.",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
      {
        title: "Backup + Restore-Test produktiv",
        description:
          "Restore eines kritischen Systems aus Backup einmalig erfolgreich durchführen + Protokoll. 3-2-1-Strategie nachweisen.",
        defaultDurationDays: 14,
        deliverableType: "evidence",
      },
      {
        title: "Hardening-Baselines für 3 Top-OS-Klassen anwenden",
        description:
          "CIS Benchmarks Level 1 für Windows, Linux, Cloud (AWS/Azure). Compliance-Reports erzeugen.",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
      {
        title: "Maßnahmen-Status in Controls-Modul pflegen",
        description:
          "Pro Maßnahme: Status, Test-Ergebnis, Evidenz. Wöchentliches Reporting an Steering.",
        defaultDurationDays: 7,
      },
    ],
  },
  {
    code: "Y1-M5-03",
    phaseCode: "do",
    sequence: 15,
    name: "Awareness-Programm Start",
    description:
      "ISO 27001 §7.3 fordert dokumentierte Awareness-Aktivitäten. Mindestens: Onboarding-Modul + Jahres-Refresher + Phishing-Simulation. Output: Schulungsplattform aktiv, ≥ 80 % Quote in Welle 1.",
    isoClause: "7.3",
    defaultOwnerRole: "admin",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["Y1-M2-01"],
    targetModuleLink: { module: "academy", route: "/academy" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Awareness-Curriculum festlegen",
        description:
          "Module: IS-Politik, Phishing, Passwort, Mobile, Reporting Suspicious. ~15-20 min pro Modul.",
        defaultDurationDays: 7,
      },
      {
        title: "Plattform aufsetzen + Inhalte hochladen",
        description:
          "Academy-Modul nutzen. SCO-Pakete oder Eigenproduktion. Quiz mit Min-Score.",
        defaultDurationDays: 10,
      },
      {
        title: "Pflichtkommunikation an alle Mitarbeiter",
        description:
          "CEO-Mail mit Frist (4 Wochen). Erinnerungen automatisiert. Reporting an Linienvorgesetzte bei Säumigen.",
        defaultDurationDays: 3,
      },
      {
        title: "Phishing-Simulation Welle 1",
        description:
          "Externer Anbieter oder Bordmittel. Klick-Rate messen, Zielwert < 15 %.",
        defaultDurationDays: 5,
        deliverableType: "evidence",
      },
      {
        title: "Erfüllungsquote ≥ 80 % erreichen",
        description:
          "Reporting an Steering. Säumige eskalieren.",
        defaultDurationDays: 5,
      },
    ],
  },
  {
    code: "Y1-M7-02",
    phaseCode: "do",
    sequence: 16,
    name: "Continuous Control Monitoring aktivieren",
    description:
      "ISO 27001 §9.1 fordert kontinuierliche Wirksamkeitsprüfung. Mindestens für 10 Top-Kontrollen automatische / regelmäßige Tests einrichten. Output: Dashboard mit Effectiveness-Scores.",
    isoClause: "9.1",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["Y1-M5-01"],
    targetModuleLink: { module: "ics", route: "/control-testing" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Top-10-Kontrollen für CCM auswählen",
        description:
          "Hochfrequente, automatisierbare Kontrollen mit hohem Risikobezug.",
        defaultDurationDays: 2,
      },
      {
        title: "Test-Skripte / -Verfahren definieren",
        description:
          "Pro Kontrolle: Test-Frequenz, Datenquellen, Schwellwerte für Pass/Fail.",
        defaultDurationDays: 5,
      },
      {
        title: "Tests aktivieren + erste Welle laufen lassen",
        description:
          "Automatisiert (Skripte) oder manuell (Checklisten). Ergebnisse im Control-Testing-Modul.",
        defaultDurationDays: 5,
      },
      {
        title: "Dashboard für CISO + Sponsor",
        description:
          "Effectiveness-Trend pro Kontrolle, Failed Tests mit Eskalation.",
        defaultDurationDays: 2,
      },
    ],
  },

  // ── Check ──
  {
    code: "Y1-M8-01",
    phaseCode: "check",
    sequence: 17,
    name: "Pen-Test extern",
    description:
      "Externer Pen-Test mit Fokus auf Crown-Jewels. Findings fließen ins Vuln-Management. Voraussetzung für glaubwürdige interne Audits.",
    isoClause: "A.8.8",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["Y1-M5-01"],
    targetModuleLink: { module: "isms", route: "/isms/vulnerabilities" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Scope + Rules of Engagement festlegen",
        description:
          "Welche Systeme, welche Methoden (Black/Gray/White-Box), Notfallkontakt, Zeitfenster.",
        defaultDurationDays: 3,
      },
      {
        title: "Vendor auswählen + beauftragen",
        description:
          "BSI-zertifizierter Pen-Tester bevorzugt. Vertrag inkl. NDA, Haftung.",
        defaultDurationDays: 5,
      },
      {
        title: "Pen-Test-Durchführung",
        description:
          "Aktive Testphase. Tägliche Stand-ups bei kritischen Findings.",
        defaultDurationDays: 5,
      },
      {
        title: "Findings ins Vuln-Modul importieren + Treatment",
        description:
          "Pro Critical/High Finding: Owner, Frist, Maßnahme. Verknüpfung mit Risiko-Register.",
        deliverableType: "evidence",
        defaultDurationDays: 1,
      },
    ],
  },
  {
    code: "Y1-M9-03",
    phaseCode: "check",
    sequence: 18,
    name: "Internes Audit Welle 1 (50 % Scope)",
    description:
      "ISO 27001 §9.2 fordert interne Audits. Welle 1 deckt ~50 % des Scopes ab — Hauptprozesse + Top-Annex-A-Kontrollen. Output: Audit-Bericht mit NCs, Observations, OFI.",
    isoClause: "9.2",
    defaultOwnerRole: "auditor",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["Y1-M5-01", "Y1-M5-03"],
    targetModuleLink: { module: "audit", route: "/audit" },
    requiredEvidenceCount: 2,
    subtasks: [
      {
        title: "Audit-Plan Welle 1 erstellen",
        description:
          "Audit-Universum-Auswahl (50 % Scope), Auditor-Allokation, Termine, Checklisten.",
        defaultDurationDays: 3,
      },
      {
        title: "Auditoren briefen + Unabhängigkeit prüfen",
        description:
          "3rd Line oder externe Hilfe. Keine Personalunion mit auditierten Bereichen.",
        defaultDurationDays: 2,
      },
      {
        title: "Audit-Durchführung (Interviews + Stichproben)",
        description:
          "Pro Auditgegenstand: Interview, Dokumente, Beleg-Stichprobe. Audit-Logbuch führen.",
        defaultDurationDays: 10,
      },
      {
        title: "Audit-Bericht mit NCs/OFIs erstellen",
        description:
          "Kategorisierung Major/Minor NC + Observations + Opportunities. Versendung an Auditees.",
        deliverableType: "evidence",
        defaultDurationDays: 5,
      },
      {
        title: "NC-Treatment-Termine vereinbaren",
        description:
          "Pro NC einen Verantwortlichen + Frist. NC-Modul befüllen.",
        defaultDurationDays: 1,
      },
    ],
  },
  {
    code: "Y1-M10-01",
    phaseCode: "check",
    sequence: 19,
    name: "Internes Audit Welle 2 (vollständiger Scope)",
    description:
      "Welle 2 deckt restliche 50 % ab. Damit ist der gesamte Scope vor Stage-1 einmal intern auditiert. Voraussetzung für Zertifizierungs-Reife.",
    isoClause: "9.2",
    defaultOwnerRole: "auditor",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["Y1-M9-03"],
    targetModuleLink: { module: "audit", route: "/audit" },
    requiredEvidenceCount: 2,
    isMilestone: true,
    subtasks: [
      {
        title: "Audit-Plan Welle 2 erstellen",
        description:
          "Verbleibender Scope (50 %), Lessons Learned aus Welle 1 einarbeiten.",
        defaultDurationDays: 3,
      },
      {
        title: "Audit-Durchführung restlicher Scope",
        description:
          "Bei Findings aus Welle 1 prüfen ob systemisch.",
        defaultDurationDays: 12,
      },
      {
        title: "Konsolidierter Audit-Bericht Y1",
        description:
          "Welle 1 + 2 zusammenführen. Bewertung: ISMS reif für Stage-1?",
        deliverableType: "evidence",
        defaultDurationDays: 4,
      },
      {
        title: "Bericht an Sponsor + Steering",
        description:
          "Steering-Termin: Beschluss zur Stage-1-Anmeldung oder Verschiebung.",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "Y1-M10-03",
    phaseCode: "check",
    sequence: 20,
    name: "NC-Schließung Welle 1 (Major NCs Vorrang)",
    description:
      "Major NCs MÜSSEN vor Stage-1 geschlossen sein. Minor NCs können mit Plan offen bleiben. ISO 27001 §10.1 fordert formale Korrekturmaßnahmen mit Root-Cause-Analyse.",
    isoClause: "10.1",
    defaultOwnerRole: "auditor",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["Y1-M10-01"],
    targetModuleLink: {
      module: "isms",
      route: "/isms/nonconformities",
    },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Major NCs root-cause analysieren",
        description:
          "5-Why oder Ishikawa. Symptom vs. Ursache trennen. NC-Modul nutzen.",
        defaultDurationDays: 5,
      },
      {
        title: "Korrekturmaßnahmen pro Major NC umsetzen",
        description:
          "Pro NC: Maßnahme, Owner, Frist. Wirksamkeit nachweisen (kein Re-Auftreten).",
        defaultDurationDays: 18,
        deliverableType: "control",
      },
      {
        title: "NC-Closure-Review",
        description:
          "Auditor (3rd Line) bestätigt: NC effektiv geschlossen, Wirksamkeit belegt.",
        defaultDurationDays: 5,
      },
      {
        title: "NC-Status im Cockpit aktualisieren",
        description:
          "Alle Major NCs geschlossen, Minor NCs mit Plan dokumentiert.",
        deliverableType: "evidence",
        defaultDurationDays: 2,
      },
    ],
  },

  // ── Act ──
  {
    code: "Y1-M11-02",
    phaseCode: "act",
    sequence: 21,
    name: "Management-Review",
    description:
      "ISO 27001 §9.3: Verpflichtendes formales Treffen mit Top-Management. Pflichtinhalte: Status NCs, Audit-Ergebnisse, Wirksamkeit Kontrollen, Risiko-Lage, Ressourcen-Bedarf, Verbesserungen. Output ist Protokoll mit Beschlüssen.",
    isoClause: "9.3",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["Y1-M10-01"],
    targetModuleLink: { module: "isms", route: "/isms/reviews" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "Inputs vorbereiten (alle 9.3 b-Inputs)",
        description:
          "Audit-Reports, NC-Status, Wirksamkeit, Risiko-Lage, Stakeholder-Feedback, Verbesserungschancen.",
        defaultDurationDays: 5,
      },
      {
        title: "Management-Review-Termin durchführen",
        description:
          "GL + CISO + ISMS-Manager. ~2 Stunden. Vorlage strukturiert nach 9.3 Inputs/Outputs.",
        defaultDurationDays: 1,
      },
      {
        title: "Beschlüsse + Outputs protokollieren",
        description:
          "9.3 c) Outputs: Verbesserungen, Änderungen, Ressourcen, Beschlüsse. Owner + Frist je Beschluss.",
        deliverableType: "evidence",
        defaultDurationDays: 4,
      },
      {
        title: "Beschlüsse im Programme Cockpit als Steps anlegen",
        description:
          "Falls Verbesserungen folgen: neue Steps oder Y2-Roadmap aktualisieren.",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "Y1-M11-03",
    phaseCode: "act",
    sequence: 22,
    name: "Stage-1-Audit (extern, Dokumenten-Prüfung)",
    description:
      "Stage 1 prüft Dokumentenlage und Audit-Bereitschaft. Auditor sieht: SoA, IS-Politik, Risiko-Methodik, Risiko-Register, RTP, interne Audits, Management-Review. Findings = Knowingness vor Stage 2.",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["Y1-M11-02"],
    targetModuleLink: { module: "audit", route: "/audit" },
    requiredEvidenceCount: 3,
    isMilestone: true,
    subtasks: [
      {
        title: "Akkreditierte Zertifizierungsstelle auswählen",
        description:
          "DAkkS-akkreditiert (z.B. TÜV, DEKRA, DQS, BSI). Angebot einholen, Stage-1-Termin fixieren.",
        defaultDurationDays: 5,
      },
      {
        title: "Dokumenten-Paket bereitstellen",
        description:
          "Alle Pflichtdokumente in geordnetem Index. Vorab-Review durch Audit-Team.",
        defaultDurationDays: 4,
      },
      {
        title: "Stage-1-Audit durchführen lassen",
        description:
          "1-2 Tage onsite oder remote. Audit-Plan vom Auditor, Vor-Ort-Begehung, Interviews.",
        defaultDurationDays: 2,
      },
      {
        title: "Stage-1-Findings adressieren",
        description:
          "Pro Finding Plan + Frist. Müssen vor Stage 2 abgearbeitet sein.",
        deliverableType: "evidence",
        defaultDurationDays: 3,
      },
    ],
  },
  {
    code: "Y1-M12-01",
    phaseCode: "act",
    sequence: 23,
    name: "Stage-2-Audit + Zertifikat-Ausstellung",
    description:
      "Stage 2 ist die Wirksamkeitsprüfung — Auditor verifiziert vor Ort, dass das ISMS wie dokumentiert gelebt wird. Erfolgreich → Zertifikat (3 Jahre Gültigkeit, jährliche Surveillance-Audits).",
    defaultOwnerRole: "admin",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["Y1-M11-03"],
    targetModuleLink: { module: "audit", route: "/audit" },
    requiredEvidenceCount: 3,
    isMilestone: true,
    subtasks: [
      {
        title: "Stage-2-Termin fixieren",
        description:
          "Optimal 4-6 Wochen nach Stage 1. Auditor-Plan abstimmen.",
        defaultDurationDays: 2,
      },
      {
        title: "Auditees vorbereiten",
        description:
          "Alle interviewten Mitarbeiter wissen Rolle + erwartete Antworten. Probelauf optional.",
        defaultDurationDays: 5,
      },
      {
        title: "Stage-2-Audit durchführen",
        description:
          "3-5 Tage onsite. Auditor sieht Belege, Logs, Interviews mit allen Levels.",
        defaultDurationDays: 5,
      },
      {
        title: "Findings adressieren (Major innerhalb 90 Tagen)",
        description:
          "Major NCs verhindern Zertifikat → unmittelbar schließen. Minor NCs binnen 90 Tagen.",
        defaultDurationDays: 6,
      },
      {
        title: "Zertifikat erhalten + öffentliche Kommunikation",
        description:
          "Zertifikat-PDF im Documents-Modul. Webseite + LinkedIn-Posting durch Marketing.",
        deliverableType: "evidence",
        defaultDurationDays: 3,
      },
    ],
  },
];

// ──────────────────────────────────────────────────────────────
// ISO 27001:2022 Template
// ──────────────────────────────────────────────────────────────

const ISO_27001_TEMPLATE: SeedTemplate = {
  code: "iso27001-2022",
  msType: "isms",
  name: "ISO/IEC 27001:2022 — ISMS-Einführung",
  description:
    "Geführter Einführungsprozess für ein Information Security Management System nach ISO/IEC 27001:2022 mit Risiko-Methodik nach ISO/IEC 27005:2022.",
  version: "1.1",
  frameworkCodes: ["ISO27001:2022", "ISO27005:2022"],
  estimatedDurationDays: 365,
  phases: [
    {
      code: "setup",
      sequence: 0,
      name: "Programm-Setup",
      pdcaPhase: "plan",
      defaultDurationDays: 14,
      description: "GL-Beschluss, Charter, PMO, Tooling-Setup.",
    },
    {
      code: "plan",
      sequence: 1,
      name: "PLAN — Kontext, Politik, Risiko-Methodik",
      pdcaPhase: "plan",
      defaultDurationDays: 90,
      isGate: true,
      gateCriteria: [
        { check: "scope_signed", description: "Geltungsbereich GL-genehmigt" },
        {
          check: "policy_published",
          description: "IS-Politik v1.0 veröffentlicht",
        },
        { check: "soa_v0_9", description: "SoA-Entwurf v0.9 vorliegend" },
      ],
    },
    {
      code: "do",
      sequence: 2,
      name: "DO — Maßnahmen-Umsetzung",
      pdcaPhase: "do",
      defaultDurationDays: 90,
      isGate: true,
      gateCriteria: [
        { check: "rtp_60pct", description: "RTP umgesetzt ≥ 60 %" },
        {
          check: "awareness_round_1",
          description: "Awareness-Erstrunde abgeschlossen",
        },
      ],
    },
    {
      code: "check",
      sequence: 3,
      name: "CHECK — Audits + Wirksamkeit",
      pdcaPhase: "check",
      defaultDurationDays: 90,
      isGate: true,
      gateCriteria: [
        {
          check: "internal_audit_full_scope",
          description: "Internes Audit über vollständigen Scope",
        },
      ],
    },
    {
      code: "act",
      sequence: 4,
      name: "ACT — Management-Review + Zertifizierung",
      pdcaPhase: "act",
      defaultDurationDays: 90,
      isGate: true,
      gateCriteria: [
        {
          check: "stage2_passed",
          description: "Stage-2-Audit bestanden, Zertifikat ausgestellt",
        },
      ],
    },
  ],
  steps: ISO_27001_STEPS,
};

// ──────────────────────────────────────────────────────────────
// ISO 22301:2019 — granulare Schritte mit Subtasks
// ──────────────────────────────────────────────────────────────

const ISO_22301_STEPS: SeedStep[] = [
  {
    code: "BCM-S00",
    phaseCode: "setup",
    sequence: 0,
    name: "GL-Commitment + BCM-Manager-Benennung",
    description:
      "BCMS braucht ein deutliches GL-Mandat — Krisenkosten + Resilience-Investitionen sind nicht intuitiv. Ohne Sponsor scheitert das BCMS spätestens bei der ersten Übungsfreigabe oder Budget-Diskussion. Output: Charter, benannter BCM-Manager mit klarem Mandat, Budget Y1.",
    isoClause: "5.1",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    requiredEvidenceCount: 1,
    isMilestone: true,
    targetModuleLink: { module: "documents", route: "/documents" },
    subtasks: [
      {
        title: "BCM-Business-Case + Treiber für GL aufbereiten",
        description:
          "NIS2-Pflicht (Resilience), Kunden-Audit-Anforderungen, ICS- bzw. Cyber-Versicherungs-Anforderungen, Vorfälle der letzten 24 Monate quantifizieren. Visualisiere RTO-Lücken bei kritischen Prozessen.",
        defaultOwnerRole: "risk_manager",
        defaultDurationDays: 5,
        deliverableType: "presentation",
      },
      {
        title: "BCM-Charter unterzeichnen lassen",
        description:
          "Inhalte: Begründung, Scope-Hochlevel, BCM-Manager benennen, Budget Y1, Eskalationspfad zur GL bei Aktivierungs-Entscheidungen (BCP-Auslöser).",
        defaultOwnerRole: "admin",
        defaultDurationDays: 5,
        deliverableType: "policy",
      },
      {
        title: "BCM-Manager + Stellvertreter formell ernennen",
        description:
          "Schriftliche Nominierung mit Rolle, Berichtsweg, Vollmacht für Krisenfall (Eskalation, Budget-Zugriff, externe Kommunikation).",
        defaultOwnerRole: "admin",
        defaultDurationDays: 4,
        deliverableType: "evidence",
      },
    ],
  },
  {
    code: "BCM-P01",
    phaseCode: "plan",
    sequence: 1,
    name: "BCMS-Scope + Stakeholder",
    description:
      "ISO 22301 §4.2/4.3: Welche Standorte, Geschäftsbereiche, Tochtergesellschaften sind im BCMS-Scope? Welche internen + externen Parteien müssen im Krisenfall berücksichtigt werden (Behörden, Kunden, Versicherer)? Output: Scope-Statement + Stakeholder-Register.",
    isoClause: "4.2 / 4.3",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["BCM-S00"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Scope-Optionen ausarbeiten + GL-Entscheidung",
        description:
          "Variante A (HQ + IT-Kerne) / B (HQ + Werke + IT) / C (alle Entitäten). Pro Variante: Aufwand, Audit-Kosten, BC-Risiko-Reduktion.",
        defaultDurationDays: 5,
      },
      {
        title: "Stakeholder-Workshop (BC-Perspektive)",
        description:
          "Identifiziere Krisen-Stakeholder: Kunden mit SLA-Pflichten, Behörden (BSI, KRITIS-Meldepflichten), Versicherer, Wirtschaftsprüfer, Belegschaft. Pro Gruppe Erwartungen + Kommunikations-Kanal.",
        defaultDurationDays: 3,
      },
      {
        title: "Scope-Statement schreiben + GL freigeben",
        description:
          "Einseitiges Dokument: Standorte, Geschäftsprozesse (kategorisch), explizite Excludes mit Begründung. Sponsor-Unterschrift.",
        deliverableType: "policy",
        defaultDurationDays: 4,
      },
      {
        title: "Stakeholder-Register im BCMS hinterlegen",
        description:
          "Versionierte Liste mit Erwartungen, Kontakten, Eskalationsweg. Halbjährliche Review.",
        deliverableType: "register",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "BCM-P02",
    phaseCode: "plan",
    sequence: 2,
    name: "BCMS-Politik",
    description:
      "Top-Level-Dokument von der GL unterzeichnet. Maximal 2 Seiten. Pflichtinhalte (§5.2): Verpflichtung zur Resilienz, Verpflichtung zur kontinuierlichen Verbesserung, Bezug zur Geschäftsstrategie, Definition übergeordneter Ziele.",
    isoClause: "5.2",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["BCM-P01"],
    targetModuleLink: { module: "documents", route: "/policies" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "Politik-Entwurf v0.9 schreiben",
        description:
          "Pflicht-Inhalte: Resilienz-Bekenntnis, kontinuierliche Verbesserung, Verbindlichkeit für alle Mitarbeiter, Verweis auf Krisenstab-Vollmacht.",
        defaultDurationDays: 4,
      },
      {
        title: "Sponsoren- + Legal-Review",
        description:
          "Konsistenz mit Charter, anderen Politiken (IS, DPMS), regulatorischen Anforderungen (NIS2-Resilienz).",
        defaultDurationDays: 3,
      },
      {
        title: "GL-Unterschrift + Veröffentlichung",
        description:
          "Signiertes PDF im Documents-Modul, Intranet-Veröffentlichung, Pflicht-Bestätigung in HR-System.",
        deliverableType: "policy",
        defaultDurationDays: 5,
      },
      {
        title: "Kommunikation an alle Mitarbeiter",
        description:
          "CEO-Mail mit Politik-Link + Kerninhalten. Awareness-Modul-Ergänzung.",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "BCM-P03",
    phaseCode: "plan",
    sequence: 3,
    name: "Rollen, Verantwortungen, Krisenstab-Charter",
    description:
      "§5.3 verlangt klare Rollen + Verantwortungen. Spezifikum BCMS: Krisenstab (Crisis Management Team) mit Vollmacht für Aktivierungs-Entscheidungen. Pro Rolle Stellvertreter — Krisen treffen oft die nicht-erreichbaren Personen.",
    isoClause: "5.3",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["BCM-P02"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "BCMS-Rollen-Inventar erstellen",
        description:
          "BCM-Manager, BCM-Koordinator je Standort, Krisenstab-Vorsitz + Mitglieder, Sprecher (Comms), Logistik-Lead, IT-Recovery-Lead. Plus Stellvertreter.",
        defaultDurationDays: 3,
      },
      {
        title: "Krisenstab-Charter schreiben",
        description:
          "Aktivierungs-Kriterien (was zählt als Krise), Entscheidungsbefugnisse, Eskalation zur GL, Quorum, Backup-Standort des Krisenstab-Treffens.",
        deliverableType: "policy",
        defaultDurationDays: 5,
      },
      {
        title: "RACI-Matrix für 22301-Klauseln + BCPs",
        description:
          "Pro BCMS-Anforderung: R/A/C/I. Pro BCP: Owner, Aktivierer, ausführende Rollen.",
        deliverableType: "register",
        defaultDurationDays: 4,
      },
      {
        title: "Schriftliche Nominierungen einholen",
        description:
          "Pro Schlüsselrolle: schriftliche Bestätigung Verfügbarkeit + Bereitschaft zur 24/7-Erreichbarkeit im Krisenfall.",
        deliverableType: "evidence",
        defaultDurationDays: 3,
      },
    ],
  },
  {
    code: "BCM-B01",
    phaseCode: "bia",
    sequence: 4,
    name: "Prozess-Inventar (kritische Geschäftsprozesse)",
    description:
      "Voraussetzung für BIA: vollständiges Inventar aller wesentlichen Geschäftsprozesse. Pro Prozess Owner, betreffende Standorte, Schnittstellen, abhängige IT-Systeme, vor- und nachgelagerte Lieferanten.",
    isoClause: "8.2.2",
    defaultOwnerRole: "process_owner",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["BCM-P02"],
    targetModuleLink: { module: "bpm", route: "/processes" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Prozess-Landkarte aus BPM-Modul + Workshops konsolidieren",
        description:
          "Vorhandene BPMN-Prozessmodelle nutzen, lückenhafte Bereiche per Workshop ergänzen. Ziel: vollständiger Set wesentlicher Geschäftsprozesse.",
        defaultDurationDays: 7,
      },
      {
        title: "Pro Prozess Owner + Stellvertreter benennen",
        description:
          "Klare Zuteilung — Process Owner ist später Hauptansprechpartner für BIA-Workshop und BCP-Erstellung.",
        defaultDurationDays: 4,
      },
      {
        title: "IT-System-Abhängigkeiten erfassen",
        description:
          "Pro Prozess: welche Apps, welche Datenbanken, welche Schnittstellen sind kritisch. Mapping zum Asset-Inventar.",
        defaultDurationDays: 7,
        deliverableType: "register",
      },
      {
        title: "Lieferanten-Abhängigkeiten erfassen",
        description:
          "Welche externen Dienstleister sind für die Prozesse erforderlich (Cloud-Anbieter, Logistik, Outsourcing)? Verbindung zum TPRM-Register.",
        defaultDurationDays: 3,
      },
    ],
  },
  {
    code: "BCM-B02",
    phaseCode: "bia",
    sequence: 5,
    name: "BIA-Workshops",
    description:
      "Business Impact Analysis: pro Prozess Schadens-Eskalation über Zeit ermitteln. Welcher finanzielle, regulatorische, reputative, operative Schaden entsteht nach 1h/4h/1d/3d/1w/4w Ausfall? Output: BIA-Report mit Schaden-Heatmap je Prozess.",
    isoClause: "8.2.2",
    defaultOwnerRole: "process_owner",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["BCM-B01"],
    targetModuleLink: { module: "bcms", route: "/bcms/bia" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "BIA-Methodik festlegen",
        description:
          "Schadens-Skalen pro Dimension (Finanz €, Regulatorisch, Reputation, Operations). Zeit-Achse (1h, 4h, 1d, 3d, 1w, 4w). Quantitativ wo möglich.",
        defaultDurationDays: 5,
      },
      {
        title: "Process Owners + Stellvertreter trainieren",
        description:
          "1-2h Briefing zur Methodik. Beispiel-Workshop. Erst danach echte BIA-Workshops.",
        defaultDurationDays: 3,
      },
      {
        title: "BIA-Workshops je Prozess (1-2h pro Prozess)",
        description:
          "Process Owner + ergänzend: Finanz-Vertreter, Legal-Vertreter, IT. Schadens-Eskalation pro Zeit-Stufe quantifizieren + dokumentieren.",
        defaultDurationDays: 14,
      },
      {
        title: "BIA-Konsolidierung + Sponsor-Review",
        description:
          "Heatmap erstellen: Prozesse × Zeit × Schaden. Top-Kritische-Prozesse identifizieren. Steering-Vorlage.",
        deliverableType: "evidence",
        defaultDurationDays: 7,
      },
    ],
  },
  {
    code: "BCM-B03",
    phaseCode: "bia",
    sequence: 6,
    name: "RTO/RPO/MBCO-Festlegung",
    description:
      "Aus BIA ableiten: Recovery Time Objective (max. tolerierbare Wiederherstellungszeit), Recovery Point Objective (max. tolerierbarer Datenverlust), Minimum Business Continuity Objective (welcher Mindestbetrieb muss aufrechterhalten werden). Diese drei Werte treiben die gesamte Strategie + Budget.",
    isoClause: "8.2.2 c",
    defaultOwnerRole: "process_owner",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["BCM-B02"],
    targetModuleLink: { module: "bcms", route: "/bcms/bia" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "RTO-Workshop pro Prozess",
        description:
          "Aus BIA-Heatmap RTO ableiten. Realismus-Check: kann das mit aktueller IT-Infrastruktur überhaupt gehalten werden?",
        defaultDurationDays: 4,
      },
      {
        title: "RPO-Workshop pro Prozess",
        description:
          "Wieviel Datenverlust ist tolerierbar? Treibt Backup-Frequenz + Replikations-Strategie. Pro Datenkategorie unterschiedlich.",
        defaultDurationDays: 4,
      },
      {
        title: "MBCO definieren",
        description:
          "Welche Mindest-Service-Level sind kritisch? Z.B. 'Notfall-Hotline 24/7' auch bei totalem IT-Ausfall.",
        defaultDurationDays: 3,
      },
      {
        title: "GL-Genehmigung der RTO/RPO/MBCO-Werte",
        description:
          "Diese Werte steuern Budget. Steering muss bestätigen, dass die Werte angemessen + leistbar sind.",
        deliverableType: "policy",
        defaultDurationDays: 3,
      },
    ],
  },
  {
    code: "BCM-B04",
    phaseCode: "bia",
    sequence: 7,
    name: "BC-Risikobeurteilung",
    description:
      "§8.2.3 Bedrohungs- und Schwachstellen-Analyse für die kritischen Prozesse: was kann schief gehen? Strom-Ausfall, IT-Outage, Cyber-Angriff, Pandemie, Personal-Engpass, Lieferanten-Ausfall, Standort-Unverfügbarkeit. Pro Szenario Wahrscheinlichkeit + erwarteter Impact.",
    isoClause: "8.2.3",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["BCM-B02"],
    targetModuleLink: { module: "bcms", route: "/bcms/erm-sync" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Szenario-Katalog auswählen + ergänzen",
        description:
          "Standardszenarien (BSI-Notfallszenarien, branchen-typische). Plus org-spezifische (z.B. Zoll-Streik, OT-Kompromittierung). Mind. 8-12 Szenarien.",
        defaultDurationDays: 4,
      },
      {
        title: "Pro Szenario Wahrscheinlichkeit + Impact bewerten",
        description:
          "Methodik aus ERM/ISMS nutzen wo vorhanden. Konsistenz mit Risiko-Methodik der Org.",
        defaultDurationDays: 7,
      },
      {
        title: "Top-Szenarien priorisieren",
        description:
          "Nach Risk-Score sortieren. Top-5 werden in Strategie + Übungs-Plan adressiert.",
        defaultDurationDays: 2,
      },
      {
        title: "Synchronisation mit ERM-Risiko-Register",
        description:
          "Top-BC-Szenarien als ERM-Risiken eintragen (Cross-Modul-Verlinkung).",
        defaultDurationDays: 1,
      },
    ],
  },
  {
    code: "BCM-D01",
    phaseCode: "do",
    sequence: 8,
    name: "Resilience-Strategien je kritischem Prozess",
    description:
      "§8.3 Pro kritischem Prozess: welche Strategie hält RTO/RPO ein? Optionen: Redundanz (Geo-redundant, Hot-Standby), Outsourcing (Backup-Provider), manuelle Notlösung (Papier-Workaround), Verzicht (akzeptieren bis Recovery). Strategie definiert Investition + Kosten.",
    isoClause: "8.3",
    defaultOwnerRole: "process_owner",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["BCM-B03"],
    targetModuleLink: { module: "bcms", route: "/bcms/strategies" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Strategie-Optionen je kritischem Prozess ausarbeiten",
        description:
          "Pro Top-Prozess 2-3 Strategie-Varianten mit Aufwand + Restrisiko. Sponsor-Entscheidung.",
        defaultDurationDays: 14,
      },
      {
        title: "Resource-Anforderungen quantifizieren",
        description:
          "Personal, IT-Infrastruktur, Standorte, Drittparteien — pro Strategie. Budget-Einplanung.",
        defaultDurationDays: 7,
      },
      {
        title: "Strategien dokumentieren + freigeben",
        description:
          "Pro Prozess: gewählte Strategie + Begründung + GL-Freigabe. In Strategies-Modul hinterlegen.",
        deliverableType: "register",
        defaultDurationDays: 5,
      },
      {
        title: "Beschaffungs-/Implementierungs-Planung",
        description:
          "Wo neue Tools/Infrastruktur erforderlich: Beschaffungsplan, Vendor-Selection, Implementierungs-Timeline.",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "BCM-D02",
    phaseCode: "do",
    sequence: 9,
    name: "Business Continuity Plans (BCPs)",
    description:
      "§8.4 Pro Strategie ein konkreter, ausführbarer BCP. Inhalt: Auslöser, Aktivierungs-Schwellen, schritt-für-schritt-Anweisungen, benötigte Ressourcen, Eskalations-Pfad, Wiederherstellungs-Schritte. BCPs sind die Arbeits-Anweisungen im Krisenfall — müssen ohne CEO-Anruf ausführbar sein.",
    isoClause: "8.4",
    defaultOwnerRole: "process_owner",
    defaultDurationDays: 60,
    prerequisiteStepCodes: ["BCM-D01"],
    targetModuleLink: { module: "bcms", route: "/bcms/plans" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "BCP-Vorlage standardisieren",
        description:
          "Einheitliches Template: Header (Trigger, Owner, Aktivierungs-Authority), Aktivierungs-Schritte, Recovery-Schritte, Rollen, Kontakte, Anhang (Tools/Skripte).",
        defaultDurationDays: 7,
      },
      {
        title: "BCPs pro kritischem Prozess schreiben",
        description:
          "Process Owner mit Unterstützung BCM-Manager. Jeder Schritt klar + ausführbar. Stress-Testing der Verständlichkeit.",
        defaultDurationDays: 30,
        deliverableType: "policy",
      },
      {
        title: "Cross-Review aller BCPs",
        description:
          "Konsistenz, Gaps, Konflikte zwischen BCPs (z.B. zwei BCPs verlangen denselben Standby-Server) identifizieren.",
        defaultDurationDays: 10,
      },
      {
        title: "BCM-Manager + Sponsor-Freigabe",
        description:
          "Formelle Approval. BCPs versionieren + im BCMS-Modul hinterlegen.",
        deliverableType: "evidence",
        defaultDurationDays: 7,
      },
    ],
  },
  {
    code: "BCM-D03",
    phaseCode: "do",
    sequence: 10,
    name: "Krisen-Kontaktbäume + Krisenstab-Aktivierungs-Verfahren",
    description:
      "§8.4.2 Wer ruft wen wann an? Im Krisenfall verlierst du Stunden, wenn die Erreichbarkeit nicht vorgeklärt ist. Output: Kontaktbaum mit primären + Backup-Nummern, Aktivierungs-Verfahren mit Eskalationsstufen, Out-of-Band-Kommunikationskanäle.",
    isoClause: "8.4.2",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["BCM-D02"],
    targetModuleLink: { module: "bcms", route: "/bcms/crisis" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Kontaktbaum-Hierarchie definieren",
        description:
          "Pro Stufe Anrufer + Anzurufende. Backup-Nummern (privat). Out-of-Band (Signal, Telefon — nicht Firmen-Mail).",
        defaultDurationDays: 4,
        deliverableType: "register",
      },
      {
        title: "Krisenstab-Aktivierungs-Verfahren dokumentieren",
        description:
          "Welche Schwellen lösen welche Stufe aus (Yellow/Orange/Red Alert)? Wer hat Aktivierungs-Authority? Wie schnell muss der Krisenstab tagen?",
        defaultDurationDays: 4,
      },
      {
        title: "Notfall-Kommunikations-Tools beschaffen",
        description:
          "Mass-Alerting-Tool (z.B. Everbridge, FACT24), Out-of-Band-Konferenz-Lösung. Tests beim Onboarding.",
        defaultDurationDays: 5,
      },
      {
        title: "Quartalsweiser Kontakt-Test",
        description:
          "Zugehörigkeit + Erreichbarkeit testen. Datenpflege ist Dauer-Aufgabe.",
        defaultDurationDays: 1,
      },
    ],
  },
  {
    code: "BCM-D04",
    phaseCode: "do",
    sequence: 11,
    name: "BCP-Schulung Schlüsselrollen",
    description:
      "§7.2 Schlüsselrollen müssen BCPs nicht nur lesen, sondern verinnerlichen. Schulung mit praktischen Übungen. Im Krisenfall liest niemand 30-Seiten-PDFs — Wissen muss präsent sein.",
    isoClause: "7.2",
    defaultOwnerRole: "admin",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["BCM-D02"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Schulungs-Curriculum erstellen",
        description:
          "Pro Rolle was muss der Mensch wissen? BCM-Grundlagen + spezifische BCP-Schritte. ~2-4h pro Schulung.",
        defaultDurationDays: 7,
      },
      {
        title: "Schulungen für alle Krisenstab-Mitglieder",
        description:
          "Inkl. Stellvertreter. Teilnahme dokumentieren. Q&A-Phase.",
        deliverableType: "evidence",
        defaultDurationDays: 14,
      },
      {
        title: "Quick-Reference-Cards für Krisensituationen erstellen",
        description:
          "1-Seiten-Zusammenfassung pro BCP. Laminiert + an festen Plätzen + auf Smartphones.",
        defaultDurationDays: 5,
      },
      {
        title: "Awareness für gesamte Belegschaft",
        description:
          "Was tun bei Brand, Cyber-Vorfall, IT-Ausfall? Kurze Module im Awareness-Tool.",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "BCM-C01",
    phaseCode: "check",
    sequence: 12,
    name: "Tabletop-Übung Welle 1 (≥ 2 Pläne)",
    description:
      "§8.5 Erste Validierung der BCPs am Tisch — kein operativer Druck, Fokus auf Konzept-Schwächen. Mindestens 2 BCPs durchspielen. Output: Lessons Learned + BCP-Korrekturen.",
    isoClause: "8.5",
    defaultOwnerRole: "process_owner",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["BCM-D02"],
    targetModuleLink: { module: "bcms", route: "/bcms/exercises" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Szenarien für Tabletop auswählen",
        description:
          "Aus BC-Risiko-Beurteilung Top-Szenarien auswählen. Realistisch genug, um Diskussion auszulösen.",
        defaultDurationDays: 3,
      },
      {
        title: "Tabletop-Übung durchführen (3-4h)",
        description:
          "Krisenstab + relevante Process Owner + Beobachter. Moderator führt durch Eskalations-Stufen. Pro Stufe Diskussion: was würden wir tun?",
        defaultDurationDays: 1,
      },
      {
        title: "Lessons-Learned-Bericht erstellen",
        description:
          "Was funktionierte gut, was nicht. Konkrete Verbesserungs-Vorschläge mit Owner + Frist.",
        deliverableType: "evidence",
        defaultDurationDays: 5,
      },
      {
        title: "BCP-Updates basierend auf Lessons Learned",
        description:
          "Identifizierte Lücken in den BCPs schließen. Versionierung dokumentieren.",
        defaultDurationDays: 5,
      },
    ],
  },
  {
    code: "BCM-C02",
    phaseCode: "check",
    sequence: 13,
    name: "Funktionsübung (mind. 1 BCP, real)",
    description:
      "§8.5 Realer Test: BCP wird tatsächlich ausgeführt. Failover des IT-Systems, Aktivierung der Notfall-Hotline, Restore aus Backup. Output: belastbarer Nachweis dass die Strategie unter Realbedingungen funktioniert.",
    isoClause: "8.5",
    defaultOwnerRole: "process_owner",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["BCM-C01"],
    targetModuleLink: { module: "bcms", route: "/bcms/exercises" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "Übungs-Szenario + Scope definieren",
        description:
          "Welcher BCP wird real getestet? Welche Komponenten sind in scope (z.B. nur IT-Failover, nicht Comms)? Risiken minimieren.",
        defaultDurationDays: 5,
      },
      {
        title: "Vorbereitung + Sicherheits-Setup",
        description:
          "Rollback-Plan, Off-Hours-Termin wo möglich, Stakeholder informieren, Notfall-Stop-Mechanismus definieren.",
        defaultDurationDays: 7,
      },
      {
        title: "Funktionsübung durchführen + dokumentieren",
        description:
          "Echter Test. Zeit-Stempel pro Schritt. Beobachter halten Schwierigkeiten fest. RTO + RPO messen.",
        deliverableType: "evidence",
        defaultDurationDays: 1,
      },
      {
        title: "Funktionstest-Bericht + Korrekturen",
        description:
          "Wurde RTO/RPO eingehalten? Was musste improvisiert werden? Korrekturen + Frist + Owner.",
        deliverableType: "evidence",
        defaultDurationDays: 7,
      },
    ],
  },
  {
    code: "BCM-C03",
    phaseCode: "check",
    sequence: 14,
    name: "Internes Audit BCMS",
    description:
      "§9.2 Internes Audit der BCMS-Konformität: Politik vorhanden + gelebt, BIA + Strategien dokumentiert, BCPs aktuell, Übungen durchgeführt. Voraussetzung für Stage-1/2-Audit.",
    isoClause: "9.2",
    defaultOwnerRole: "auditor",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["BCM-C02"],
    targetModuleLink: { module: "audit", route: "/audit" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Audit-Plan + Checklisten erstellen",
        description:
          "Pro 22301-Klausel Audit-Frage. Stichproben-Logik für BCPs. Dokumenten-Inventar als Vorbereitung.",
        defaultDurationDays: 4,
      },
      {
        title: "Auditoren briefen + Unabhängigkeit prüfen",
        description:
          "3rd Line oder externe Hilfe — keine Personalunion mit BCM-Manager.",
        defaultDurationDays: 2,
      },
      {
        title: "Audit-Durchführung",
        description:
          "Interviews mit Krisenstab, Process Owners, Sponsor. Beleg-Stichproben (BCP-Aktualität, Übungs-Reports, Schulungs-Nachweise).",
        defaultDurationDays: 10,
      },
      {
        title: "Audit-Bericht + NC-Treatment-Plan",
        description:
          "NCs kategorisieren (Major/Minor) + Owner + Frist. NC-Modul befüllen.",
        deliverableType: "evidence",
        defaultDurationDays: 5,
      },
    ],
  },
  {
    code: "BCM-A01",
    phaseCode: "act",
    sequence: 15,
    name: "Management-Review BCMS",
    description:
      "§9.3 Verpflichtendes Management-Review nach 22301-Inputs: Audit-Ergebnisse, BIA-Updates, Übungs-Erkenntnisse, Risiko-Lage, Ressourcen-Bedarf, Verbesserungen. Output: Beschlüsse + Ressourcen-Allocation.",
    isoClause: "9.3",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["BCM-C03"],
    targetModuleLink: { module: "isms", route: "/isms/reviews" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "Inputs zusammenstellen",
        description:
          "Audit-Bericht, NC-Status, Übungs-Reports, BIA-Updates, BC-Risiko-Lage, Stakeholder-Feedback. ~30 Folien max.",
        defaultDurationDays: 5,
      },
      {
        title: "Management-Review-Termin (2h)",
        description:
          "GL + BCM-Manager + IT-Leitung + Sponsor. Strukturiert nach 9.3 Inputs/Outputs.",
        defaultDurationDays: 1,
      },
      {
        title: "Beschlüsse + Outputs protokollieren",
        description:
          "9.3 c) Outputs: Verbesserungen, Änderungen, Ressourcen, Beschlüsse. Owner + Frist je Beschluss.",
        deliverableType: "evidence",
        defaultDurationDays: 4,
      },
      {
        title: "Beschlüsse als neue Steps im Programme Cockpit",
        description:
          "Verbesserungen werden zu Y2-Roadmap-Items. Tracking sicherstellen.",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "BCM-A02",
    phaseCode: "act",
    sequence: 16,
    name: "Stage-1 + Stage-2 Audit (BCMS-Zertifizierung)",
    description:
      "Externe Zertifizierungs-Audits. Stage 1: Dokumenten-Prüfung + Audit-Bereitschaft. Stage 2: Wirksamkeits-Prüfung vor Ort. Erfolgreich → ISO 22301-Zertifikat (3 Jahre, jährliche Surveillance).",
    defaultOwnerRole: "admin",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["BCM-A01"],
    targetModuleLink: { module: "audit", route: "/audit" },
    requiredEvidenceCount: 3,
    isMilestone: true,
    subtasks: [
      {
        title: "Akkreditierte Zertifizierungsstelle auswählen",
        description:
          "DAkkS-akkreditiert (TÜV, DEKRA, DQS, BSI). Angebot, Stage-1-Termin fixieren.",
        defaultDurationDays: 7,
      },
      {
        title: "Dokumenten-Paket + Stage-1 durchlaufen",
        description:
          "Pflicht-Dokumente bereitstellen (Politik, Scope, BIA, Strategien, BCPs, Übungs-Reports, Audit-Reports, Management-Review). Stage 1 onsite/remote.",
        defaultDurationDays: 7,
      },
      {
        title: "Stage-1-Findings adressieren",
        description:
          "Pro Finding Plan + Frist. Müssen vor Stage 2 abgearbeitet sein.",
        deliverableType: "evidence",
        defaultDurationDays: 7,
      },
      {
        title: "Stage-2-Audit durchführen lassen",
        description:
          "3-5 Tage onsite. Auditor sieht Wirksamkeit vor Ort, Interviews quer durch Org.",
        defaultDurationDays: 5,
      },
      {
        title: "Zertifikat erhalten + Kommunikation",
        description:
          "Zertifikat-PDF im Documents-Modul. Kunden-Kommunikation, ggf. Pressemitteilung.",
        deliverableType: "evidence",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "BCM-A03",
    phaseCode: "act",
    sequence: 17,
    name: "Lessons Learned + Y2-Übungs-Plan",
    description:
      "§10.1 Kontinuierliche Verbesserung: Auswertung des ersten Zyklus, Y2-Roadmap mit Übungs-Plan (mind. 2 Tabletops + 1 Funktion + 1 Notfall-Stresstest pro Jahr empfohlen).",
    isoClause: "10.1",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["BCM-A02"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Lessons-Learned-Workshop mit Krisenstab",
        description:
          "Was lief im Y1-BCMS-Aufbau gut, was schlecht? Methodik + Tooling + Kommunikation.",
        defaultDurationDays: 3,
      },
      {
        title: "Y2-Übungs-Plan erstellen",
        description:
          "Termine, Szenarien, Scope. Mind. quartalsweise Tabletops + jährliche Funktionsübung.",
        deliverableType: "policy",
        defaultDurationDays: 5,
      },
      {
        title: "Y2-Roadmap mit Verbesserungen",
        description:
          "Strategie-Verfeinerungen, Investitionen, BCP-Erweiterungen, Personal-Aufbau.",
        defaultDurationDays: 4,
      },
      {
        title: "Y2-Budget bei Sponsor einreichen",
        description:
          "Quantifiziertes Budget für Folge-Jahr basierend auf Y2-Roadmap.",
        defaultDurationDays: 2,
      },
    ],
  },
];

const ISO_22301_TEMPLATE: SeedTemplate = {
  code: "iso22301-2019",
  msType: "bcms",
  name: "ISO 22301:2019 — BCMS-Einführung",
  description:
    "Geführter Einführungsprozess für ein Business Continuity Management System nach ISO 22301:2019.",
  version: "1.1",
  frameworkCodes: ["ISO22301:2019"],
  estimatedDurationDays: 300,
  phases: [
    {
      code: "setup",
      sequence: 0,
      name: "Programm-Setup",
      pdcaPhase: "plan",
      defaultDurationDays: 14,
    },
    {
      code: "plan",
      sequence: 1,
      name: "PLAN — Kontext + BCMS-Politik",
      pdcaPhase: "plan",
      defaultDurationDays: 60,
    },
    {
      code: "bia",
      sequence: 2,
      name: "BIA + Risiko",
      pdcaPhase: "plan",
      defaultDurationDays: 60,
    },
    {
      code: "do",
      sequence: 3,
      name: "DO — Strategien + Pläne",
      pdcaPhase: "do",
      defaultDurationDays: 90,
    },
    {
      code: "check",
      sequence: 4,
      name: "CHECK — Übungen + Audit",
      pdcaPhase: "check",
      defaultDurationDays: 60,
    },
    {
      code: "act",
      sequence: 5,
      name: "ACT — Review + Zertifizierung",
      pdcaPhase: "act",
      defaultDurationDays: 30,
    },
  ],
  steps: ISO_22301_STEPS,
};

// ──────────────────────────────────────────────────────────────
// GDPR (DPMS) — granulare Schritte mit Subtasks
// ──────────────────────────────────────────────────────────────

const GDPR_STEPS: SeedStep[] = [
  {
    code: "DP-S00",
    phaseCode: "setup",
    sequence: 0,
    name: "DPO benennen + Charter",
    description:
      "GDPR Art. 37: Pflicht zur DPO-Benennung wenn Kerntätigkeit in regelmäßiger systematischer Beobachtung oder Verarbeitung sensibler Daten besteht. Auch ohne Pflicht ist ein benannter Datenschutz-Verantwortlicher essentiell. Output: schriftliche DPO-Benennung + Charter mit Mandat, Unabhängigkeit, Ressourcen-Zusage.",
    isoClause: "GDPR Art. 37",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    requiredEvidenceCount: 1,
    isMilestone: true,
    targetModuleLink: { module: "documents", route: "/documents" },
    subtasks: [
      {
        title: "DPO-Pflicht prüfen + dokumentieren",
        description:
          "Art. 37 Abs. 1 abklopfen: öffentliche Stelle, Kern-Beobachtung, sensible Daten. Bei Pflicht: Begründung im Pflichten-Register. Bei Freiwilligkeit: Beschluss dokumentieren.",
        defaultOwnerRole: "admin",
        defaultDurationDays: 3,
      },
      {
        title: "DPO ernennen (intern oder extern)",
        description:
          "Schriftliche Benennung, Stellvertretung, Unabhängigkeits-Garantie, Direkt-Reporting an oberste Leitung. Kontaktdaten an Aufsichtsbehörde melden.",
        defaultOwnerRole: "admin",
        defaultDurationDays: 7,
        deliverableType: "evidence",
      },
      {
        title: "DPO-Charter schreiben",
        description:
          "Mandat, Aufgaben (Art. 39), Ressourcen-Zusage (Budget, Werkzeuge, Schulungs-Zeit), Eskalation an GL bei Konflikten.",
        defaultOwnerRole: "admin",
        defaultDurationDays: 4,
        deliverableType: "policy",
      },
    ],
  },
  {
    code: "DP-P01",
    phaseCode: "plan",
    sequence: 1,
    name: "Datenschutz-Politik + Privacy-Notice",
    description:
      "Zwei zentrale Dokumente: (1) interne Datenschutz-Politik mit Verbindlichkeit für alle Mitarbeiter, (2) externe Privacy-Notice (Art. 13/14) für betroffene Personen. Privacy-Notice ist auf der Website zentral verlinkt + bei jedem Datenerhebungs-Punkt verfügbar.",
    isoClause: "GDPR Art. 13/14",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["DP-S00"],
    targetModuleLink: { module: "documents", route: "/policies" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Interne Datenschutz-Politik schreiben",
        description:
          "Geltungsbereich, Grundsätze (Art. 5), Verantwortlichkeiten, Sanktionen bei Verstoß. Verbindlich für alle Mitarbeiter + Auftragsverarbeiter.",
        defaultDurationDays: 5,
        deliverableType: "policy",
      },
      {
        title: "Privacy-Notice (Art. 13) für Web/Apps schreiben",
        description:
          "Pflicht-Inhalte: Verantwortlicher, Zwecke, Rechtsgrundlagen, Empfänger, Speicherdauer, Betroffenenrechte, Beschwerderecht. Klare Sprache.",
        defaultDurationDays: 4,
        deliverableType: "policy",
      },
      {
        title: "Spezielle Privacy-Notices (Art. 14) für indirekt erhobene Daten",
        description:
          "z.B. Bewerber-Daten von Personalvermittlern, Kunden-Daten von Distributor. Pro Quelle eigene Notice.",
        defaultDurationDays: 3,
      },
      {
        title: "Veröffentlichung + Verlinkung",
        description:
          "Privacy-Notice an allen Datenerhebungs-Punkten verlinken (Web, Apps, Verträge, HR-Forms). Versionierung dokumentieren.",
        deliverableType: "evidence",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "DP-P02",
    phaseCode: "plan",
    sequence: 2,
    name: "Verantwortlichkeiten + RACI",
    description:
      "Datenschutz ist nicht nur DPO. Pro Geschäftsbereich braucht es Datenschutz-Koordinatoren. Pro Verarbeitungsvorgang einen 'Process Owner Datenschutz'. RACI klärt wer entscheidet, wer ausführt, wer informiert.",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["DP-S00"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Rollen-Inventar erstellen",
        description:
          "DPO, Datenschutz-Koordinator je Bereich, Process Owner pro Verarbeitung, IT-Datenschutz-Liaison, Legal-Liaison.",
        defaultDurationDays: 3,
      },
      {
        title: "RACI-Matrix für GDPR-Pflichten",
        description:
          "Pro GDPR-Anforderung (Art. 30 RoPA, Art. 33 Breach-Notification, Art. 35 DPIA, etc.) Rollen-Zuteilung.",
        deliverableType: "register",
        defaultDurationDays: 5,
      },
      {
        title: "Datenschutz-Koordinatoren je Bereich nominieren",
        description:
          "Schriftliche Bestätigung. Pro Geschäftsbereich min. 1 Person. Schulung + Eskalation an DPO.",
        deliverableType: "evidence",
        defaultDurationDays: 4,
      },
      {
        title: "Initial-Schulung der Koordinatoren",
        description:
          "2-3h Briefing: GDPR-Grundlagen, Pflichten, Eskalations-Prozesse, Tooling.",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "DP-D01",
    phaseCode: "do",
    sequence: 3,
    name: "RoPA Erst-Erfassung",
    description:
      "GDPR Art. 30: Verzeichnis aller Verarbeitungstätigkeiten. Pro Verarbeitung: Zweck, Datenkategorien, Betroffene, Empfänger, Drittland-Transfer, Speicherdauer, TOMs, Rechtsgrundlage. Output: vollständiges RoPA als zentraler GDPR-Anker.",
    isoClause: "GDPR Art. 30",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 60,
    prerequisiteStepCodes: ["DP-P01"],
    targetModuleLink: { module: "dpms", route: "/data-privacy/ropa" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "RoPA-Template + Methodik festlegen",
        description:
          "Pflicht-Felder pro Art. 30 + zusätzliche interne Felder (Risiko-Bewertung, Owner). Tooling: GRC-Modul oder Excel-Template.",
        defaultDurationDays: 7,
      },
      {
        title: "Erfassungs-Workshops je Bereich",
        description:
          "HR, Marketing, Vertrieb, IT, Finanzen, R&D, Customer Service. Pro Bereich Workshop mit Datenschutz-Koordinator. Identifikation aller Verarbeitungen.",
        defaultDurationDays: 30,
      },
      {
        title: "RoPA-Konsolidierung",
        description:
          "Zusammenführung der Bereichs-Listen. Doppelnennungen entfernen, Granularität harmonisieren.",
        deliverableType: "register",
        defaultDurationDays: 14,
      },
      {
        title: "DPO-Review + Vollständigkeits-Check",
        description:
          "Pro Verarbeitung Plausibilität prüfen. Kreuz-Check mit Vendor-Liste (TPRM), Asset-Inventar, Anwendungs-Liste.",
        defaultDurationDays: 7,
      },
      {
        title: "Halbjährliche Review-Frequenz festlegen",
        description:
          "RoPA ist Living Document. Reminder-Cadence + Process Owner-Bestätigungs-Workflow.",
        deliverableType: "policy",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "DP-D02",
    phaseCode: "do",
    sequence: 4,
    name: "Rechtsgrundlagen-Bewertung",
    description:
      "GDPR Art. 6: Pro Verarbeitungsvorgang muss EINE der 6 Rechtsgrundlagen vorliegen (Einwilligung, Vertrag, gesetzliche Pflicht, lebenswichtige Interessen, öffentliche Aufgabe, berechtigtes Interesse). Bei berechtigtem Interesse + sensiblen Daten zusätzlich Art. 9. Output: Rechtsgrundlagen-Mapping in RoPA.",
    isoClause: "GDPR Art. 6",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["DP-D01"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Pro RoPA-Eintrag Art. 6 Lit. zuordnen",
        description:
          "Mit Begründung. 'Berechtigtes Interesse' nur mit dokumentierter Interessenabwägung.",
        defaultDurationDays: 7,
      },
      {
        title: "Sensible Daten (Art. 9) separat prüfen",
        description:
          "Gesundheit, Gewerkschaft, Religion, biometrisch — strengere Anforderungen. Art. 9 Abs. 2 Lit. zuordnen.",
        defaultDurationDays: 4,
      },
      {
        title: "Interessenabwägungen dokumentieren",
        description:
          "Wo Rechtsgrundlage 'berechtigtes Interesse': schriftliche Abwägung des Verantwortlichen-Interesses gegen Betroffenen-Interesse + Schutzmaßnahmen.",
        deliverableType: "evidence",
        defaultDurationDays: 3,
      },
    ],
  },
  {
    code: "DP-D03",
    phaseCode: "do",
    sequence: 5,
    name: "DPIA für Hochrisiko-Verarbeitungen",
    description:
      "GDPR Art. 35: Datenschutz-Folgenabschätzung wenn Verarbeitung wahrscheinlich hohes Risiko für Betroffene birgt. Pflicht-Liste der Aufsichtsbehörden zusätzlich. Output: DPIA pro relevanter Verarbeitung mit Risiko-Bewertung + TOMs.",
    isoClause: "GDPR Art. 35",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["DP-D01"],
    targetModuleLink: { module: "dpms", route: "/data-privacy/dpia" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "DPIA-Pflicht-Trigger pro RoPA-Eintrag prüfen",
        description:
          "Art. 35 Abs. 3 + nationaler Pflicht-Listen (z.B. DSK-Liste). Triage-Tool im DPMS-Modul nutzen.",
        defaultDurationDays: 7,
      },
      {
        title: "DPIAs für identifizierte Hochrisiko-Verarbeitungen schreiben",
        description:
          "Pflicht-Inhalte (Art. 35 Abs. 7): systematische Beschreibung, Notwendigkeits-/Verhältnismäßigkeits-Bewertung, Risiken, geplante Maßnahmen.",
        defaultDurationDays: 14,
        deliverableType: "evidence",
      },
      {
        title: "Konsultation Aufsichtsbehörde (wenn Restrisiko hoch)",
        description:
          "Art. 36: bei verbleibendem hohen Risiko vorab Aufsichtsbehörde konsultieren. Antwort-Frist 8 Wochen.",
        defaultDurationDays: 7,
      },
      {
        title: "DPIA-Wiedervorlage-Cadence definieren",
        description:
          "Bei Änderung der Verarbeitung oder mind. alle 3 Jahre Re-Assessment. Im Kalender hinterlegen.",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "DP-D04",
    phaseCode: "do",
    sequence: 6,
    name: "TOMs (Art. 32)",
    description:
      "Technische und organisatorische Maßnahmen zur Sicherheit der Verarbeitung. Risikoangemessen — pro Verarbeitung individuell. Klassische Kategorien: Pseudonymisierung, Verschlüsselung, Verfügbarkeit, Wiederherstellung, regelmäßiges Testen.",
    isoClause: "GDPR Art. 32",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["DP-D03"],
    targetModuleLink: { module: "ics", route: "/controls" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "TOMs-Katalog aus Best-Practice ableiten",
        description:
          "DSK-TOMs-Katalog, BSI-Grundschutz, ISO 27002 als Quelle. Pro Risiko-Stufe Mindest-TOMs.",
        defaultDurationDays: 7,
      },
      {
        title: "Pro RoPA-Eintrag TOMs zuordnen",
        description:
          "Risikoangemessene Auswahl. Bei sensiblen Daten zusätzlich Art. 9-spezifische TOMs.",
        defaultDurationDays: 14,
      },
      {
        title: "Bestehende Controls aus ICS-Modul mappen",
        description:
          "TOMs sind oft schon als Controls implementiert. Cross-Reference herstellen, Lücken identifizieren.",
        defaultDurationDays: 7,
      },
      {
        title: "Lücken-Plan + Implementierung",
        description:
          "Pro identifizierter Lücke: Owner + Frist + Budget. Tracking via Treatment-Plan.",
        deliverableType: "control",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "DP-D05",
    phaseCode: "do",
    sequence: 7,
    name: "Auftragsverarbeiter-Verträge (AVV)",
    description:
      "GDPR Art. 28: pro Auftragsverarbeiter ein schriftlicher Vertrag mit Pflicht-Inhalten. Identifikation aller Auftragsverarbeiter (häufig unterschätzt — jede SaaS, jeder Cloud-Anbieter). Drittland-Transfer extra prüfen (SCC, BCR, Adequacy).",
    isoClause: "GDPR Art. 28",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["DP-D01"],
    targetModuleLink: { module: "tprm", route: "/contracts" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Auftragsverarbeiter-Identifikation",
        description:
          "Aus RoPA + Vendor-Liste alle ableiten die personenbezogene Daten verarbeiten. SaaS, Cloud, Outsourcing, Freelancer.",
        defaultDurationDays: 7,
        deliverableType: "register",
      },
      {
        title: "AVV-Status pro Anbieter prüfen",
        description:
          "Liegt AVV vor? Aktuell? Pflicht-Inhalte (Art. 28 Abs. 3) abgedeckt? Status-Spalte in Vendor-Register.",
        defaultDurationDays: 7,
      },
      {
        title: "AVV-Standard-Template erstellen + verwenden",
        description:
          "Eigenes Template oder DSK-Muster anpassen. Bei neuen Verträgen automatisch beilegen.",
        defaultDurationDays: 5,
      },
      {
        title: "Drittland-Transfer-Prüfung (Art. 44+)",
        description:
          "Pro Anbieter mit Standort außerhalb EWR: SCC, BCR, Angemessenheits-Beschluss. TIA bei US-Anbietern. Schrems-II-Compliance.",
        defaultDurationDays: 7,
      },
      {
        title: "Lücken-Schließung mit Anbietern",
        description:
          "Wo AVV fehlt oder veraltet: Anbieter kontaktieren, Vertrag nachholen, ggf. Wechsel.",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "DP-D06",
    phaseCode: "do",
    sequence: 8,
    name: "DSR-Workflow (Betroffenenrechte)",
    description:
      "GDPR Art. 12-22: Auskunft, Berichtigung, Löschung, Einschränkung, Übertragbarkeit, Widerspruch. 1-Monats-Frist (Art. 12 Abs. 3, verlängerbar um 2 Monate bei Komplexität). Operativer Workflow + Tooling sind kritisch — handgemachte Bearbeitung skaliert nicht.",
    isoClause: "GDPR Art. 12-22",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["DP-D01"],
    targetModuleLink: { module: "dpms", route: "/data-privacy/dsr" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "DSR-Eingangs-Kanäle definieren",
        description:
          "Mail-Adresse, Web-Formular, Telefon-Hotline. Auf Privacy-Notice + Website prominent.",
        defaultDurationDays: 4,
      },
      {
        title: "DSR-Workflow im DPMS-Modul aufsetzen",
        description:
          "Pro Anfrage-Typ ein Workflow: Identifikation prüfen, Daten zusammensuchen, Antwort verfassen, Frist überwachen.",
        defaultDurationDays: 7,
        deliverableType: "control",
      },
      {
        title: "Identitäts-Prüfungs-Verfahren",
        description:
          "Wie wird sichergestellt, dass der Anfragende auch der Betroffene ist? Risiko-basiert: bei Auskunft ggf. ID-Vorlage, bei Löschung strenger.",
        defaultDurationDays: 4,
      },
      {
        title: "DSR-Bearbeiter-Schulung",
        description:
          "DPO + Bereichs-Koordinatoren in Workflow + häufigen Fallen schulen. Praxis-Beispiele.",
        defaultDurationDays: 4,
      },
      {
        title: "30-Tage-SLA-Monitor aktivieren",
        description:
          "Cron-Reminder bei T-7 + T-2 + T+0. Eskalation bei Überschreitung. Behörden-Beschwerde-Risiko.",
        deliverableType: "control",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "DP-D07",
    phaseCode: "do",
    sequence: 9,
    name: "Datenschutz-Vorfalls-Workflow (72h-Meldung)",
    description:
      "GDPR Art. 33: Meldung an Aufsichtsbehörde innerhalb 72 Stunden nach Kenntnisnahme. Art. 34: Benachrichtigung Betroffener bei hohem Risiko. Workflow muss innerhalb dieses extrem engen Zeitfensters funktionieren — Vorbereitung ist alles.",
    isoClause: "GDPR Art. 33/34",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["DP-D01"],
    targetModuleLink: { module: "dpms", route: "/data-privacy/breaches" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "Breach-Definition + Erkennungs-Pfade definieren",
        description:
          "Was ist ein 'data breach' i.S.v. Art. 4 Nr. 12? Wie kommen Vorfälle zur DPO? Schnittstelle zum Incident-Response-Prozess.",
        defaultDurationDays: 4,
        deliverableType: "policy",
      },
      {
        title: "72h-Triage-Workflow im DPMS-Modul",
        description:
          "Sofort-Bewertung Risiko für Betroffene, Daten-Kategorien, Anzahl Betroffene. Entscheidung: melden ja/nein.",
        defaultDurationDays: 5,
        deliverableType: "control",
      },
      {
        title: "Behörden-Meldetemplates",
        description:
          "Vorgefertigte Meldetexte pro Aufsichtsbehörde (LDA, BfDI, Art. 56-Lead-DPA). Spart kostbare Stunden im Krisenfall.",
        defaultDurationDays: 4,
      },
      {
        title: "Betroffenen-Benachrichtigungs-Templates (Art. 34)",
        description:
          "Bei hohem Risiko: klare verständliche Sprache, Maßnahmen-Empfehlungen für Betroffene, Kontakt für Rückfragen.",
        defaultDurationDays: 4,
      },
      {
        title: "Tabletop-Übung Breach-Workflow",
        description:
          "Realistisches Szenario durchspielen: Kann das Team wirklich in 72h melden? Lücken identifizieren + schließen.",
        deliverableType: "evidence",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "DP-C01",
    phaseCode: "check",
    sequence: 10,
    name: "Internes Audit Datenschutz",
    description:
      "Audit der DPMS-Konformität durch unabhängige Funktion (3rd Line oder externe Hilfe). Stichproben-Audits in RoPA, DPIA, AVVs, DSR-Bearbeitung, Breach-Bereitschaft. Output: Audit-Bericht mit NCs.",
    defaultOwnerRole: "auditor",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["DP-D04", "DP-D06", "DP-D07"],
    targetModuleLink: { module: "audit", route: "/audit" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Audit-Plan + Checklisten erstellen",
        description:
          "Pro GDPR-Kapitel Audit-Frage. Stichproben-Methodik (5-10% der RoPA-Einträge tiefe Prüfung).",
        defaultDurationDays: 4,
      },
      {
        title: "Auditor-Briefing + Unabhängigkeit prüfen",
        description:
          "Keine Personalunion mit DPO oder Datenschutz-Koordinatoren.",
        defaultDurationDays: 2,
      },
      {
        title: "Audit-Durchführung",
        description:
          "Interviews, Dokumenten-Stichproben, Beobachtung von DSR-Bearbeitung, Test der Breach-Eskalation.",
        defaultDurationDays: 10,
      },
      {
        title: "Audit-Bericht + NC-Treatment",
        description:
          "Findings-Kategorisierung. NC-Modul befüllen, Owner + Frist je NC.",
        deliverableType: "evidence",
        defaultDurationDays: 5,
      },
    ],
  },
  {
    code: "DP-C02",
    phaseCode: "check",
    sequence: 11,
    name: "DSR-Antwort-Frist-Test (1-Monats-Test)",
    description:
      "Praxis-Test des DSR-Workflows mit fingiertem Antrag. Misst die End-to-End-Zeit von Eingang bis Antwort. 1-Monats-Frist (Art. 12 Abs. 3) muss eingehalten werden.",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["DP-D06"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Test-Antrag fingieren",
        description:
          "Mitarbeiter stellt anonymisiert einen Auskunfts-Antrag. Workflow läuft normal an.",
        defaultDurationDays: 1,
      },
      {
        title: "Workflow durchlaufen + Zeit messen",
        description:
          "Pro Schritt Zeit-Stempel. Identifikations-Prüfung, Daten-Zusammenstellung, Antwort.",
        defaultDurationDays: 28,
      },
      {
        title: "Test-Bericht + Lücken-Identifikation",
        description:
          "Wenn knapp an SLA: Engpässe identifizieren. Ggf. Workflow optimieren.",
        deliverableType: "evidence",
        defaultDurationDays: 3,
      },
    ],
  },
  {
    code: "DP-A01",
    phaseCode: "act",
    sequence: 12,
    name: "Management-Review DPMS",
    description:
      "Jährliches Management-Review zur DPMS-Wirksamkeit. Inputs: Audit-Ergebnisse, DSR-Statistik, Breach-Statistik, Aufsichtsbehörden-Korrespondenz, Verbesserungs-Vorschläge. Output: Beschlüsse + Ressourcen für Y2.",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["DP-C01"],
    targetModuleLink: { module: "isms", route: "/isms/reviews" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "Inputs zusammenstellen",
        description:
          "Audit-Bericht, DSR-Statistik (Anzahl, Durchlaufzeit, SLA-Quote), Breach-Statistik, neue Regulatorik (z.B. Aufsichtsbehörden-Leitlinien).",
        defaultDurationDays: 5,
      },
      {
        title: "Management-Review-Termin (90 min)",
        description:
          "GL + DPO + Datenschutz-Koordinatoren-Vorsitz. Strukturiert nach 9.3 oder dpo-spezifischer Vorlage.",
        defaultDurationDays: 1,
      },
      {
        title: "Beschlüsse protokollieren + tracken",
        description:
          "Verbesserungs-Beschlüsse mit Owner + Frist. Tracking via Programme Cockpit Steps.",
        deliverableType: "evidence",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "DP-A02",
    phaseCode: "act",
    sequence: 13,
    name: "Privacy-by-Design-Integration in BPMN-Prozesse",
    description:
      "GDPR Art. 25: Datenschutz durch Technikgestaltung + datenschutzfreundliche Voreinstellungen. Bei jedem neuen Geschäftsprozess oder System Datenschutz-Aspekte von Anfang an mitdenken. Tooling: Privacy-Checkpoints in BPMN-Workflows + im SDLC.",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["DP-A01"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Privacy-by-Design-Checkliste erstellen",
        description:
          "Standard-Fragen für jeden neuen Prozess: Welche Daten? Minimal? Pseudonymisierbar? Speicherdauer? Rechtsgrundlage? Etc.",
        deliverableType: "policy",
        defaultDurationDays: 7,
      },
      {
        title: "BPMN-Prozesse um Privacy-Checkpoints erweitern",
        description:
          "Im BPM-Modul Standard-Aktivität 'DPO-Review' bei jeder Verarbeitungs-Erstellung. Im SDLC analog.",
        defaultDurationDays: 14,
      },
      {
        title: "Privacy-Engineering-Schulung für Entwickler/Architekten",
        description:
          "Konkrete Techniken: Anonymisierung, Pseudonymisierung, k-Anonymität, Differential Privacy. Praktische Beispiele.",
        defaultDurationDays: 7,
      },
      {
        title: "DPMS-Y2-Roadmap erstellen",
        description:
          "Aus Management-Review-Beschlüssen + neuen Regulatorik-Anforderungen (Data Act, AI Act, etc.).",
        defaultDurationDays: 2,
      },
    ],
  },
];

const GDPR_TEMPLATE: SeedTemplate = {
  code: "gdpr-2016-679",
  msType: "dpms",
  name: "EU 2016/679 (DSGVO) — DPMS-Einführung",
  description:
    "Geführter Einführungsprozess für ein Datenschutz-Managementsystem nach DSGVO mit RoPA, DPIA, DSR-Workflow und Breach-Management.",
  version: "1.1",
  frameworkCodes: ["EU2016/679", "ISO27701:2019"],
  estimatedDurationDays: 240,
  phases: [
    {
      code: "setup",
      sequence: 0,
      name: "Programm-Setup",
      pdcaPhase: "plan",
      defaultDurationDays: 14,
    },
    {
      code: "plan",
      sequence: 1,
      name: "PLAN — DPO + Politik",
      pdcaPhase: "plan",
      defaultDurationDays: 30,
    },
    {
      code: "do",
      sequence: 2,
      name: "DO — RoPA + DPIA + Workflows",
      pdcaPhase: "do",
      defaultDurationDays: 120,
    },
    {
      code: "check",
      sequence: 3,
      name: "CHECK — Audit + Tests",
      pdcaPhase: "check",
      defaultDurationDays: 60,
    },
    {
      code: "act",
      sequence: 4,
      name: "ACT — Review + Continuous",
      pdcaPhase: "act",
      defaultDurationDays: 30,
    },
  ],
  steps: GDPR_STEPS,
};

// ──────────────────────────────────────────────────────────────
// ISO 42001:2023 (AIMS) — granulare Schritte mit Subtasks
// ──────────────────────────────────────────────────────────────

const ISO_42001_STEPS: SeedStep[] = [
  {
    code: "AI-S00",
    phaseCode: "setup",
    sequence: 0,
    name: "GL-Commitment + AI-Beauftragter",
    description:
      "AI-Governance ist neue Rolle in den meisten Orgs. Ohne klares Mandat + benannten AI-Beauftragten verwässert Verantwortung zwischen IT, DPO, Legal und Fachbereichen. Outputs: Charter, AI-Beauftragter mit Mandat, Initial-Budget, GL-Sponsor-Bekenntnis zu ethischer KI-Nutzung.",
    isoClause: "ISO 42001 §5.1",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    requiredEvidenceCount: 1,
    isMilestone: true,
    targetModuleLink: { module: "documents", route: "/documents" },
    subtasks: [
      {
        title: "AI-Business-Case + Treiber für GL aufbereiten",
        description:
          "EU AI Act-Pflicht (anwendbar 2026), Wettbewerbsdruck (Customer-Anforderungen, Investor-Erwartungen), Risiko-Reduktion (Bias, Compliance, IP-Verletzung).",
        defaultOwnerRole: "risk_manager",
        defaultDurationDays: 5,
        deliverableType: "presentation",
      },
      {
        title: "AI-Charter unterzeichnen lassen",
        description:
          "Ethische Grundsätze, Geltungsbereich (Eigenentwicklung + Drittanbieter-AI), AI-Beauftragter benennen, Budget Y1, Eskalationspfad bei Risiko-/Ethik-Konflikten.",
        defaultOwnerRole: "admin",
        defaultDurationDays: 5,
        deliverableType: "policy",
      },
      {
        title: "AI-Beauftragter + AI-Komitee benennen",
        description:
          "Beauftragter mit klarem Mandat, Komitee aus IT, Legal, DPO, Fachvertretung, Ethik-Expert (intern/extern). Quartalsweise Sitzungen.",
        defaultOwnerRole: "admin",
        defaultDurationDays: 4,
        deliverableType: "evidence",
      },
    ],
  },
  {
    code: "AI-P01",
    phaseCode: "plan",
    sequence: 1,
    name: "AI-Politik + ethische Grundsätze",
    description:
      "ISO 42001 §5.2: AI-Politik mit Bezug zu Geschäftsstrategie + ethischen Werten. Inhalte: Verbote (welche AI-Anwendungen sind tabu — z.B. Social Scoring von Mitarbeitern), Mindest-Anforderungen (z.B. menschliche Aufsicht bei HR-Entscheidungen), Transparenz-Verpflichtung gegenüber Stakeholdern.",
    isoClause: "ISO 42001 §5.2",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["AI-S00"],
    targetModuleLink: { module: "documents", route: "/policies" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Ethische Grundsätze definieren",
        description:
          "OECD AI Principles, EU Ethics Guidelines for Trustworthy AI als Basis. Org-spezifisch ergänzen (z.B. branchenspezifische Werte).",
        defaultDurationDays: 5,
      },
      {
        title: "AI-Politik schreiben",
        description:
          "Pflicht-Inhalte: Geltungsbereich, Verbote (analog AI Act Art. 5), Mindest-Anforderungen, Transparenz-Pflichten, Verantwortlichkeiten, Sanktionen.",
        deliverableType: "policy",
        defaultDurationDays: 5,
      },
      {
        title: "Stakeholder-Konsultation",
        description:
          "Mitarbeiter-Vertretung (Betriebsrat) bei AI-Anwendungen die Beschäftigte betreffen. Kunden-Repräsentation bei kundenwirksamen AI-Systemen.",
        defaultDurationDays: 3,
      },
      {
        title: "GL-Unterschrift + interne Veröffentlichung",
        description:
          "Verbindlich für alle Mitarbeiter + Auftragnehmer. Awareness-Modul-Ergänzung.",
        deliverableType: "evidence",
        defaultDurationDays: 1,
      },
    ],
  },
  {
    code: "AI-P02",
    phaseCode: "plan",
    sequence: 2,
    name: "AI-System-Inventar (Erst-Erfassung)",
    description:
      "EU AI Act Art. 49: Pflicht zur Registrierung von Hochrisiko-AI in EU-Datenbank — voraussetzt vollständiges Inventar. Pro AI-System: Zweck, Anbieter (intern/extern), Klassifikations-Kategorie, Datenkategorien, betroffene Personengruppen, Lifecycle-Status. Output: AI-System-Inventar als zentraler AIMS-Anker.",
    isoClause: "EU AI Act Art. 49",
    defaultOwnerRole: "admin",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["AI-S00"],
    targetModuleLink: { module: "ai-act", route: "/ai-act/systems" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "AI-Definition + Erfassungs-Methodik festlegen",
        description:
          "Was zählt als 'AI-System' i.S.v. AI Act Art. 3? Entscheidungs-Hilfen für Fachbereiche (z.B. AutoML in BI-Tool? Generative AI im Marketing?).",
        defaultDurationDays: 5,
        deliverableType: "policy",
      },
      {
        title: "Erfassungs-Kampagne in allen Bereichen",
        description:
          "Workshops mit IT, Marketing, Vertrieb, HR, R&D, Customer-Service. Eigenentwicklung + SaaS + AI-Funktionen in Standard-Software (z.B. Office 365 Copilot, Salesforce Einstein).",
        defaultDurationDays: 14,
      },
      {
        title: "AI-System-Datenblätter pro System",
        description:
          "Pflicht-Felder: Zweck, Anbieter, AI-Typ (LLM, klassisches ML, Regelbasiert), Datenkategorien, Output-Typ (Klassifikation/Generation/Empfehlung), Stakeholder.",
        deliverableType: "register",
        defaultDurationDays: 7,
      },
      {
        title: "Konsolidierung + Vollständigkeits-Check",
        description:
          "Cross-Check mit Vendor-Liste, IT-Asset-Inventar, Anwendungs-Liste. Halbjährliche Review-Cadence festlegen.",
        defaultDurationDays: 3,
      },
    ],
  },
  {
    code: "AI-P03",
    phaseCode: "plan",
    sequence: 3,
    name: "Risiko-Klassifikation (verboten / hoch / begrenzt / minimal)",
    description:
      "EU AI Act Art. 5-6: Klassifikation nach Risiko-Kategorien. Verbotene Praktiken (Art. 5) sofort identifizieren + abstellen. Hochrisiko-AI (Annex III) löst umfangreiche Pflichten aus. Klassifikation prägt alle nachfolgenden Anforderungen.",
    isoClause: "EU AI Act Art. 5-6",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["AI-P02"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Verbotene Praktiken (Art. 5) prüfen",
        description:
          "Social Scoring, Echtzeit-Biometrie öffentlich, Manipulation, Schwachstellen-Ausnutzung. Bei Treffer: sofortige Beendigung + Eskalation.",
        defaultDurationDays: 5,
      },
      {
        title: "Hochrisiko-Klassifikation (Art. 6 + Annex III)",
        description:
          "Annex III-Anwendungsbereiche: Bildung, Beschäftigung, Strafverfolgung, Migration, Justiz, Demokratie. Plus Art. 6 Abs. 1 (Sicherheits-Komponenten von Produkten unter EU-Harmonisierung).",
        defaultDurationDays: 7,
      },
      {
        title: "Begrenztes-Risiko-Klassifikation (Transparenz-Pflichten Art. 50)",
        description:
          "Chatbots, Emotionserkennungs-Systeme, biometrische Kategorisierung. Pflicht: Nutzer informieren dass AI im Spiel ist.",
        defaultDurationDays: 4,
      },
      {
        title: "Klassifikations-Tabelle + Sponsor-Freigabe",
        description:
          "Pro AI-System: Klassifikation + Begründung + abgeleitete Pflichten. GL-Freigabe.",
        deliverableType: "register",
        defaultDurationDays: 5,
      },
    ],
  },
  {
    code: "AI-D01",
    phaseCode: "do",
    sequence: 4,
    name: "Quality-Management-System (Annex IX)",
    description:
      "EU AI Act Art. 17: Anbieter von Hochrisiko-AI müssen QMS implementieren. Annex IX listet Pflicht-Inhalte: Compliance-Strategie, Design + Validierungs-Verfahren, Datenmanagement, Risikomanagement-System, Post-Market-Monitoring, Incident-Reporting. Auch Deployer profitieren von QMS-Struktur.",
    isoClause: "EU AI Act Art. 17",
    defaultOwnerRole: "admin",
    defaultDurationDays: 60,
    prerequisiteStepCodes: ["AI-P02"],
    targetModuleLink: { module: "ai-act", route: "/ai-act/qms" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "QMS-Scope festlegen (Anbieter vs. Deployer)",
        description:
          "Anbieter müssen vollständiges QMS. Deployer können auf Anbieter-QMS verweisen + ergänzendes Deployment-QMS.",
        defaultDurationDays: 5,
      },
      {
        title: "QMS-Verfahren für die 13 Annex-IX-Bereiche schreiben",
        description:
          "Pro Bereich (Compliance-Strategie, Design, Test, Daten, Risiko, ...) ein dokumentiertes Verfahren. Vorlage: ISO 9001 anpassen.",
        defaultDurationDays: 30,
        deliverableType: "policy",
      },
      {
        title: "QMS-Tooling integrieren",
        description:
          "Document Control, Version Control, Audit-Trail, Reporting-Dashboard im AI-Act-Modul.",
        defaultDurationDays: 14,
      },
      {
        title: "QMS-Schulung für Schlüssel-Rollen",
        description:
          "AI-Beauftragter, Entwickler, Tester, Operations. Praxis-Beispiele.",
        defaultDurationDays: 7,
      },
      {
        title: "QMS-Initial-Audit",
        description:
          "Selbst-Audit des QMS auf Annex-IX-Vollständigkeit. Lücken-Plan.",
        deliverableType: "evidence",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "AI-D02",
    phaseCode: "do",
    sequence: 5,
    name: "Risiko-Management Hochrisiko-AI (Annex IV)",
    description:
      "EU AI Act Art. 9: Risiko-Management-System für Hochrisiko-AI. Iterativer Prozess: Identifizieren bekannter + vorhersehbarer Risiken, Schätzung Restrisiko nach Mitigationen, Test, Trade-off-Bewertung. Pro AI-System ein Risiko-Management-Plan.",
    isoClause: "EU AI Act Art. 9",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["AI-P03"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Risiko-Identifikations-Kategorien festlegen",
        description:
          "Bias/Diskriminierung, Datenschutz-Verletzung, falsche Vorhersagen, Manipulations-Anfälligkeit, Cybersecurity, Misuse, gesellschaftliche Auswirkungen.",
        defaultDurationDays: 5,
      },
      {
        title: "Pro Hochrisiko-AI Risiko-Workshop",
        description:
          "Mit Entwicklern, Domain-Experten, Ethik-Vertretung, betroffenen Stakeholdern. STRIDE-ähnliche Methodik für AI-Risiken.",
        defaultDurationDays: 14,
      },
      {
        title: "Mitigations-Maßnahmen je Risiko",
        description:
          "Z.B. Bias-Mitigation durch ausgewogene Trainingsdaten, Fallback-Logik, Human-in-the-Loop, Output-Filter.",
        deliverableType: "control",
        defaultDurationDays: 7,
      },
      {
        title: "Restrisiko-Bewertung + Akzeptanz",
        description:
          "Wenn Restrisiko nach Mitigations zu hoch: System nicht deployen oder Scope anpassen. Sonst formale Akzeptanz durch GL.",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "AI-D03",
    phaseCode: "do",
    sequence: 6,
    name: "Daten-Governance + Trainingsdaten-Doku",
    description:
      "EU AI Act Art. 10: Trainings-/Validierungs-/Test-Datensätze müssen relevant, repräsentativ, fehlerfrei, vollständig sein. Bei Bias-Risiko zusätzlich Diversity-Anforderungen. Pflicht: Datenherkunft, Annotierungs-Verfahren, Verarbeitungsschritte dokumentieren.",
    isoClause: "EU AI Act Art. 10",
    defaultOwnerRole: "admin",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["AI-D02"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Daten-Governance-Standards für AI festlegen",
        description:
          "Pro Datensatz-Typ: Qualitäts-Anforderungen, Annotierungs-Standards, Bias-Checks, Versionierungs-Anforderungen.",
        defaultDurationDays: 7,
        deliverableType: "policy",
      },
      {
        title: "Pro Hochrisiko-AI Datenkarte (Datasheet)",
        description:
          "Pflicht-Felder: Quelle, Größe, Annotation, Bias-Bewertung, Limitationen, Lifecycle. Standardisiertes Template (z.B. Datasheets for Datasets).",
        deliverableType: "register",
        defaultDurationDays: 14,
      },
      {
        title: "Personenbezogene Trainingsdaten DPMS-konform",
        description:
          "Wenn Personendaten in Training: GDPR-Rechtsgrundlage, Pseudonymisierung wenn möglich, DPIA wenn Hochrisiko.",
        defaultDurationDays: 7,
      },
      {
        title: "Bias-Testing implementieren",
        description:
          "Pro Hochrisiko-AI Bias-Tests gegen geschützte Attribute. Tooling: Aequitas, Fairlearn, IBM AIF360. Reports versionieren.",
        deliverableType: "evidence",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "AI-D04",
    phaseCode: "do",
    sequence: 7,
    name: "Technical Documentation (Annex IV)",
    description:
      "EU AI Act Art. 11 + Annex IV: technische Dokumentation pro Hochrisiko-AI. Pflicht-Inhalte: System-Beschreibung, Design + Entwicklung, Datenmanagement, Risiko-Management, Performance-Metriken, Verifikations-Verfahren, Logging. Vorlage für Behörden + Notified Body.",
    isoClause: "EU AI Act Art. 11",
    defaultOwnerRole: "admin",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["AI-D02"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Technical Documentation Template aufsetzen",
        description:
          "Annex-IV-Struktur als Template. Versions-Kontrolle. Pro System eigene Instanz.",
        defaultDurationDays: 5,
        deliverableType: "policy",
      },
      {
        title: "Pro Hochrisiko-AI Technical Documentation schreiben",
        description:
          "Multi-Function-Effort: Entwickler, Architekten, Risiko-Manager, Datenschutz. Living Document — wird mit System mitversioniert.",
        defaultDurationDays: 14,
        deliverableType: "evidence",
      },
      {
        title: "Review + Freigabe",
        description:
          "AI-Beauftragter + Sponsor reviewen Vollständigkeit + Verständlichkeit (Behörden müssen es nachvollziehen können).",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "AI-D05",
    phaseCode: "do",
    sequence: 8,
    name: "Human-Oversight-Design + Logging",
    description:
      "EU AI Act Art. 12-14: Hochrisiko-AI muss menschliche Aufsicht ermöglichen. Pflicht: Logging aller signifikanten Events, klare Information an Aufsichtspersonen, Eingriffs-Möglichkeit (Override, Stop). Pro System Oversight-Konzept dokumentieren.",
    isoClause: "EU AI Act Art. 12-14",
    defaultOwnerRole: "admin",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["AI-D02"],
    targetModuleLink: { module: "ai-act", route: "/ai-act/oversight-logs" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Logging-Anforderungen pro System festlegen",
        description:
          "Art. 12: was, wann, wer, Resultat. Mindest-Aufbewahrung (typisch ≥ 6 Monate). Manipulation-Schutz.",
        defaultDurationDays: 7,
      },
      {
        title: "Logging implementieren",
        description:
          "Pro System: Audit-Trail in unveränderbarem Speicher. Integration in zentrales Logging (SIEM).",
        defaultDurationDays: 14,
        deliverableType: "control",
      },
      {
        title: "Oversight-Konzept pro System",
        description:
          "Wer überwacht? Wann? Wie greift er ein? Welche Indikatoren signalisieren Eingriff-Bedarf? Schulung der Oversight-Personen.",
        defaultDurationDays: 7,
        deliverableType: "policy",
      },
      {
        title: "Oversight-Personen schulen",
        description:
          "Konzeptuelle Grundlagen, System-spezifische Bedienung, Eskalations-Wege. Mindestens jährliche Auffrischung.",
        defaultDurationDays: 2,
      },
    ],
  },
  {
    code: "AI-D06",
    phaseCode: "do",
    sequence: 9,
    name: "Conformity-Assessment + CE-Kennzeichnung",
    description:
      "EU AI Act Art. 43: Conformity-Assessment-Verfahren je nach AI-System-Typ. Bestimmte Hochrisiko-AI: interne Kontrolle (Annex VI) oder Notified-Body-Beteiligung (Annex VII). Output: EU-Konformitätserklärung + CE-Kennzeichnung. Voraussetzung für Inverkehrbringen in EU.",
    isoClause: "EU AI Act Art. 43",
    defaultOwnerRole: "admin",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["AI-D04", "AI-D05"],
    targetModuleLink: {
      module: "ai-act",
      route: "/ai-act/conformity-assessments",
    },
    requiredEvidenceCount: 2,
    isMilestone: true,
    subtasks: [
      {
        title: "Conformity-Pfad pro System wählen",
        description:
          "Annex VI (interne Kontrolle, für Annex-III-Systeme außer Biometrie) oder Annex VII (Notified Body). Begründung dokumentieren.",
        defaultDurationDays: 4,
      },
      {
        title: "Pre-Market-Vollständigkeits-Check",
        description:
          "Alle Pflicht-Artefakte vorhanden? Technical Doc, Risiko-Mgmt, QMS, Test-Reports, Bias-Reports, Logging-Nachweise.",
        defaultDurationDays: 7,
      },
      {
        title: "Notified-Body-Beauftragung (wenn anwendbar)",
        description:
          "Auswahl + Beauftragung + Audit-Termin. Bei biometrischen Systemen Pflicht.",
        defaultDurationDays: 7,
      },
      {
        title: "EU-Konformitätserklärung erstellen + signieren",
        description:
          "Annex V-Format. Verantwortlicher unterzeichnet. Aufbewahrung 10 Jahre.",
        deliverableType: "evidence",
        defaultDurationDays: 4,
      },
      {
        title: "EU-Datenbank-Registrierung (Art. 49)",
        description:
          "Pflicht für Annex-III-Systeme. EU-AI-Database (sobald operativ) Eintrag.",
        defaultDurationDays: 4,
      },
      {
        title: "CE-Kennzeichnung anbringen",
        description:
          "Auf Produkt + Dokumentation. Wenn anwendbar: Notified-Body-Nummer beifügen.",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "AI-C01",
    phaseCode: "check",
    sequence: 10,
    name: "FRIA für Hochrisiko-Deployments",
    description:
      "EU AI Act Art. 27: Fundamental Rights Impact Assessment für Deployer von Hochrisiko-AI in spezifischen Kontexten (öffentliche Einrichtungen, private mit Auswirkung auf wesentliche Dienstleistungen). FRIA bewertet Auswirkung auf Grundrechte vor Deployment.",
    isoClause: "EU AI Act Art. 27",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["AI-D06"],
    targetModuleLink: { module: "ai-act", route: "/ai-act/frias" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "FRIA-Pflicht-Trigger prüfen",
        description:
          "Art. 27 Abs. 1: öffentliche Einrichtung oder private mit Bewertung von Bonität, Lebens-/Krankenversicherungs-Risiken. Pro System einzeln prüfen.",
        defaultDurationDays: 5,
      },
      {
        title: "FRIA pro System schreiben",
        description:
          "Pflicht-Inhalte (Art. 27 Abs. 1): Verwendungszweck, Personenkategorien, Schadens-Risiken, menschliche Aufsicht, Maßnahmen zur Risiko-Mitigation.",
        deliverableType: "evidence",
        defaultDurationDays: 14,
      },
      {
        title: "Aufsichtsbehörden-Notification (wenn Pflicht)",
        description:
          "Art. 27 Abs. 3: zusätzlich zur FRIA Notification an Markt-Überwachungs-Behörde.",
        defaultDurationDays: 7,
      },
      {
        title: "FRIA-Wiedervorlage-Cadence",
        description:
          "Bei wesentlicher Änderung oder regelmäßig (z.B. jährlich) Re-Assessment.",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "AI-C02",
    phaseCode: "check",
    sequence: 11,
    name: "Internes Audit AIMS",
    description:
      "Audit der AIMS-Konformität. Stichproben in AI-System-Inventar, Risiko-Klassifikation, Technical Documentation, Risiko-Management, Logging, Oversight. Output: Audit-Bericht mit NCs für Y2-Verbesserung.",
    defaultOwnerRole: "auditor",
    defaultDurationDays: 21,
    prerequisiteStepCodes: ["AI-D06"],
    targetModuleLink: { module: "audit", route: "/audit" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Audit-Plan + Checklisten",
        description:
          "Pro ISO-42001-Klausel + EU AI Act-Artikel Audit-Frage. Stichproben-Logik (5-10% AI-Systeme tiefe Prüfung).",
        defaultDurationDays: 4,
      },
      {
        title: "Auditor-Briefing + Unabhängigkeit",
        description:
          "3rd Line oder externe Hilfe. Keine Personalunion mit AI-Beauftragtem.",
        defaultDurationDays: 2,
      },
      {
        title: "Audit-Durchführung",
        description:
          "Interviews, Dokumenten-Stichproben, Test der Logging-Vollständigkeit, Validierung der Klassifikation, Beobachtung von Oversight-Aktionen.",
        defaultDurationDays: 10,
      },
      {
        title: "Audit-Bericht + NC-Treatment",
        description:
          "Findings-Kategorisierung + NC-Modul-Eintrag. Owner + Frist je NC.",
        deliverableType: "evidence",
        defaultDurationDays: 5,
      },
    ],
  },
  {
    code: "AI-C03",
    phaseCode: "check",
    sequence: 12,
    name: "Penetrations-Test ML-Modelle (Adversarial Robustness)",
    description:
      "Spezifische AI-Sicherheits-Tests: Adversarial Examples (manipulierte Inputs), Model-Inversion, Membership-Inference, Model-Stealing, Prompt-Injection (LLM). Tools: ART (IBM Adversarial Robustness Toolbox), Counterfit, garak (LLM).",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["AI-D06"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "Test-Scope + Methodik festlegen",
        description:
          "Welche Modelle (Hochrisiko first), welche Angriffe (typisch: Adversarial Examples + Prompt Injection bei LLMs).",
        defaultDurationDays: 3,
      },
      {
        title: "Pen-Test durchführen",
        description:
          "Mit spezialisiertem Tester (intern oder extern). Schritte: Recon, Angriff, Auswertung, Report.",
        defaultDurationDays: 7,
      },
      {
        title: "Findings ins Vuln-Modul + Treatment",
        description:
          "Pro Finding Owner + Frist. Mitigations: Adversarial Training, Input-Sanitization, Rate-Limiting, Output-Filter.",
        defaultDurationDays: 4,
        deliverableType: "evidence",
      },
    ],
  },
  {
    code: "AI-A01",
    phaseCode: "act",
    sequence: 13,
    name: "Management-Review AIMS",
    description:
      "Jährliches Management-Review der AIMS-Wirksamkeit. Inputs: Audit-Ergebnisse, AI-Inventar-Updates, Incidents, Pen-Test-Reports, neue Regulatorik (AI Act-Konkretisierungen, Verhaltenskodizes). Output: Y2-Beschlüsse + Ressourcen.",
    isoClause: "ISO 42001 §9.3",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["AI-C02"],
    targetModuleLink: { module: "isms", route: "/isms/reviews" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    subtasks: [
      {
        title: "Inputs zusammenstellen",
        description:
          "Audit-Bericht, NC-Status, AI-Inventar-Veränderungen, Risiko-Lage, Stakeholder-Feedback, Incidents, neue Regulatorik.",
        defaultDurationDays: 5,
      },
      {
        title: "Management-Review-Termin (90 min)",
        description:
          "GL + AI-Beauftragter + AI-Komitee + Sponsor. Strukturiert nach 9.3 Inputs/Outputs.",
        defaultDurationDays: 1,
      },
      {
        title: "Beschlüsse protokollieren + tracken",
        description:
          "Verbesserungen, Investitionen, Personal-Aufbau, Anpassungen Politik. Owner + Frist je Beschluss.",
        deliverableType: "evidence",
        defaultDurationDays: 4,
      },
      {
        title: "Y2-Roadmap aus Beschlüssen ableiten",
        description:
          "Folge-Steps im Programme Cockpit anlegen. Budget-Bedarf quantifizieren.",
        defaultDurationDays: 4,
      },
    ],
  },
  {
    code: "AI-A02",
    phaseCode: "act",
    sequence: 14,
    name: "Post-Market-Monitoring-Plan",
    description:
      "EU AI Act Art. 72: Anbieter müssen Hochrisiko-AI nach Inverkehrbringen aktiv überwachen. Sammlung + Analyse von Performance-Daten, Vorfällen, User-Feedback. Pro System ein PMM-Plan + tatsächliches Monitoring.",
    isoClause: "EU AI Act Art. 72",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["AI-A01"],
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "PMM-Methodik + Template",
        description:
          "Was wird wie überwacht? Performance-Drift, Bias-Verschiebung, User-Beschwerden, Incident-Statistik. Reporting-Cadence.",
        defaultDurationDays: 7,
        deliverableType: "policy",
      },
      {
        title: "PMM-Plan pro Hochrisiko-AI",
        description:
          "Plan mit Metriken, Schwellen, Verantwortlichen, Eskalations-Wegen.",
        deliverableType: "policy",
        defaultDurationDays: 5,
      },
      {
        title: "PMM-Implementierung + Operationalisierung",
        description:
          "Monitoring-Tooling aufsetzen, Alerts konfigurieren, Reporting-Dashboard für AI-Beauftragten.",
        defaultDurationDays: 2,
        deliverableType: "control",
      },
    ],
  },
  {
    code: "AI-A03",
    phaseCode: "act",
    sequence: 15,
    name: "Incident-Reporting an Marktüberwachungsbehörde",
    description:
      "EU AI Act Art. 73: Anbieter müssen schwerwiegende Vorfälle binnen 15 Tagen (3 Tage bei Tod oder ernsthafter Schädigung wesentlicher Infrastruktur) an Marktüberwachungsbehörde melden. Workflow + Templates müssen vorbereitet sein.",
    isoClause: "EU AI Act Art. 73",
    defaultOwnerRole: "admin",
    defaultDurationDays: 14,
    prerequisiteStepCodes: ["AI-A02"],
    targetModuleLink: { module: "ai-act", route: "/ai-act/incidents" },
    requiredEvidenceCount: 1,
    subtasks: [
      {
        title: "AI-Incident-Definition + Schwellen festlegen",
        description:
          "Art. 3 Nr. 49: 'serious incident'. Eigene Triage-Tabelle: was ist meldepflichtig, was nur intern.",
        defaultDurationDays: 4,
        deliverableType: "policy",
      },
      {
        title: "Incident-Workflow im AI-Act-Modul",
        description:
          "Erfassung, Triage, Investigation, Meldung, Korrekturmaßnahmen, Lessons Learned. SLA-Monitor (3d/15d).",
        defaultDurationDays: 7,
        deliverableType: "control",
      },
      {
        title: "Behörden-Meldetemplates",
        description:
          "Vorgefertigt pro Behörde. Spart kostbare Stunden bei Vorfall.",
        defaultDurationDays: 2,
      },
      {
        title: "Tabletop-Übung Incident-Workflow",
        description:
          "Realistisches Szenario durchspielen: kann das Team in 15d melden? Lücken schließen.",
        deliverableType: "evidence",
        defaultDurationDays: 1,
      },
    ],
  },
];

const ISO_42001_TEMPLATE: SeedTemplate = {
  code: "iso42001-2023",
  msType: "aims",
  name: "ISO/IEC 42001:2023 — AIMS-Einführung",
  description:
    "Geführter Einführungsprozess für ein AI Management System nach ISO/IEC 42001:2023 mit EU-AI-Act-Mapping.",
  version: "1.1",
  frameworkCodes: ["ISO42001:2023", "EUAIAct"],
  estimatedDurationDays: 270,
  phases: [
    {
      code: "setup",
      sequence: 0,
      name: "Programm-Setup",
      pdcaPhase: "plan",
      defaultDurationDays: 14,
    },
    {
      code: "plan",
      sequence: 1,
      name: "PLAN — Politik + Klassifikation",
      pdcaPhase: "plan",
      defaultDurationDays: 60,
    },
    {
      code: "do",
      sequence: 2,
      name: "DO — Inventar + Conformity",
      pdcaPhase: "do",
      defaultDurationDays: 120,
    },
    {
      code: "check",
      sequence: 3,
      name: "CHECK — Oversight + Audit",
      pdcaPhase: "check",
      defaultDurationDays: 60,
    },
    {
      code: "act",
      sequence: 4,
      name: "ACT — Review + Post-Market",
      pdcaPhase: "act",
      defaultDurationDays: 30,
    },
  ],
  steps: ISO_42001_STEPS,
};

// ──────────────────────────────────────────────────────────────
// All templates
// ──────────────────────────────────────────────────────────────

export const PROGRAMME_TEMPLATE_SEEDS: SeedTemplate[] = [
  ISO_27001_TEMPLATE,
  ISO_22301_TEMPLATE,
  GDPR_TEMPLATE,
  ISO_42001_TEMPLATE,
  // CIS Controls v8 — IG1, IG2, IG3 (additiv)
  ...(CIS_TEMPLATES as unknown as SeedTemplate[]),
];

// ──────────────────────────────────────────────────────────────
// Seeding-Funktion
// ──────────────────────────────────────────────────────────────

export interface ProgrammeSeedResult {
  templatesSeeded: number;
  phasesSeeded: number;
  stepsSeeded: number;
  subtasksSeeded: number;
}

export async function seedProgrammeTemplates(): Promise<ProgrammeSeedResult> {
  let templatesSeeded = 0;
  let phasesSeeded = 0;
  let stepsSeeded = 0;
  let subtasksSeeded = 0;

  for (const seed of PROGRAMME_TEMPLATE_SEEDS) {
    const existing = await db
      .select({ id: programmeTemplate.id })
      .from(programmeTemplate)
      .where(
        and(
          eq(programmeTemplate.code, seed.code),
          eq(programmeTemplate.version, seed.version),
        ),
      )
      .limit(1);
    if (existing.length > 0) continue;

    const [template] = await db
      .insert(programmeTemplate)
      .values({
        code: seed.code,
        msType: seed.msType,
        name: seed.name,
        description: seed.description,
        version: seed.version,
        frameworkCodes: seed.frameworkCodes,
        estimatedDurationDays: seed.estimatedDurationDays,
        publishedAt: new Date(),
        isActive: true,
      })
      .returning();
    templatesSeeded++;

    const phaseCodeToId = new Map<string, string>();
    for (const phase of seed.phases) {
      const [phaseRow] = await db
        .insert(programmeTemplatePhase)
        .values({
          templateId: template.id,
          code: phase.code,
          sequence: phase.sequence,
          name: phase.name,
          description: phase.description ?? null,
          pdcaPhase: phase.pdcaPhase,
          defaultDurationDays: phase.defaultDurationDays,
          isGate: phase.isGate ?? false,
          gateCriteria: phase.gateCriteria ?? [],
        })
        .returning();
      phaseCodeToId.set(phase.code, phaseRow.id);
      phasesSeeded++;
    }

    for (const step of seed.steps) {
      const phaseId = phaseCodeToId.get(step.phaseCode);
      if (!phaseId) {
        throw new Error(
          `Seed-Konsistenzfehler: Phase ${step.phaseCode} nicht in Template ${seed.code}`,
        );
      }
      const [stepRow] = await db
        .insert(programmeTemplateStep)
        .values({
          templateId: template.id,
          phaseId,
          code: step.code,
          sequence: step.sequence,
          name: step.name,
          description: step.description ?? null,
          isoClause: step.isoClause ?? null,
          defaultOwnerRole: step.defaultOwnerRole ?? null,
          defaultDurationDays: step.defaultDurationDays,
          prerequisiteStepCodes: step.prerequisiteStepCodes ?? [],
          targetModuleLink: step.targetModuleLink ?? {},
          requiredEvidenceCount: step.requiredEvidenceCount ?? 0,
          isMandatory: step.isMandatory ?? true,
          isMilestone: step.isMilestone ?? false,
        })
        .returning();
      stepsSeeded++;

      if (step.subtasks && step.subtasks.length > 0) {
        const subtaskRows = step.subtasks.map((sub, index) => ({
          templateStepId: stepRow.id,
          sequence: index + 1,
          title: sub.title,
          description: sub.description ?? null,
          defaultOwnerRole: sub.defaultOwnerRole ?? null,
          defaultDurationDays: sub.defaultDurationDays ?? 1,
          deliverableType: sub.deliverableType ?? null,
          isMandatory: sub.isMandatory ?? true,
        }));
        await db.insert(programmeTemplateSubtask).values(subtaskRows);
        subtasksSeeded += subtaskRows.length;
      }
    }
  }

  return { templatesSeeded, phasesSeeded, stepsSeeded, subtasksSeeded };
}
