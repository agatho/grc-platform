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
// ISO 22301:2019 Template (BCMS)
// ──────────────────────────────────────────────────────────────

const ISO_22301_TEMPLATE: SeedTemplate = {
  code: "iso22301-2019",
  msType: "bcms",
  name: "ISO 22301:2019 — BCMS-Einführung",
  description:
    "Geführter Einführungsprozess für ein Business Continuity Management System nach ISO 22301:2019.",
  version: "1.0",
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
  steps: [
    {
      code: "BCM-S00",
      phaseCode: "setup",
      sequence: 0,
      name: "GL-Commitment + BCM-Manager-Benennung",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "BCM-P01",
      phaseCode: "plan",
      sequence: 1,
      name: "BCMS-Scope + Stakeholder",
      isoClause: "4.2 / 4.3",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-S00"],
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-P02",
      phaseCode: "plan",
      sequence: 2,
      name: "BCMS-Politik",
      isoClause: "5.2",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-P01"],
      targetModuleLink: { module: "documents", route: "/policies" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "BCM-P03",
      phaseCode: "plan",
      sequence: 3,
      name: "Rollen, Verantwortungen, Krisenstab-Charter",
      isoClause: "5.3",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-P02"],
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-B01",
      phaseCode: "bia",
      sequence: 4,
      name: "Prozess-Inventar (kritische Geschäftsprozesse)",
      isoClause: "8.2.2",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["BCM-P02"],
      targetModuleLink: { module: "bpm", route: "/processes" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-B02",
      phaseCode: "bia",
      sequence: 5,
      name: "BIA-Workshops",
      isoClause: "8.2.2",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["BCM-B01"],
      targetModuleLink: { module: "bcms", route: "/bcms/bia" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "BCM-B03",
      phaseCode: "bia",
      sequence: 6,
      name: "RTO/RPO/MBCO-Festlegung",
      isoClause: "8.2.2 c",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-B02"],
      targetModuleLink: { module: "bcms", route: "/bcms/bia" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-B04",
      phaseCode: "bia",
      sequence: 7,
      name: "BC-Risikobeurteilung",
      isoClause: "8.2.3",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-B02"],
      targetModuleLink: { module: "bcms", route: "/bcms/erm-sync" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-D01",
      phaseCode: "do",
      sequence: 8,
      name: "Resilience-Strategien je kritischem Prozess",
      isoClause: "8.3",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["BCM-B03"],
      targetModuleLink: { module: "bcms", route: "/bcms/strategies" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-D02",
      phaseCode: "do",
      sequence: 9,
      name: "Business Continuity Plans (BCPs)",
      isoClause: "8.4",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 60,
      prerequisiteStepCodes: ["BCM-D01"],
      targetModuleLink: { module: "bcms", route: "/bcms/plans" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "BCM-D03",
      phaseCode: "do",
      sequence: 10,
      name: "Krisen-Kontaktbäume + Krisenstab-Aktivierungs-Verfahren",
      isoClause: "8.4.2",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-D02"],
      targetModuleLink: { module: "bcms", route: "/bcms/crisis" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-D04",
      phaseCode: "do",
      sequence: 11,
      name: "BCP-Schulung Schlüsselrollen",
      isoClause: "7.2",
      defaultOwnerRole: "admin",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["BCM-D02"],
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-C01",
      phaseCode: "check",
      sequence: 12,
      name: "Tabletop-Übung Welle 1 (≥ 2 Pläne)",
      isoClause: "8.5",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-D02"],
      targetModuleLink: { module: "bcms", route: "/bcms/exercises" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-C02",
      phaseCode: "check",
      sequence: 13,
      name: "Funktionsübung (mind. 1 BCP, real)",
      isoClause: "8.5",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["BCM-C01"],
      targetModuleLink: { module: "bcms", route: "/bcms/exercises" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "BCM-C03",
      phaseCode: "check",
      sequence: 14,
      name: "Internes Audit BCMS",
      isoClause: "9.2",
      defaultOwnerRole: "auditor",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["BCM-C02"],
      targetModuleLink: { module: "audit", route: "/audit" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-A01",
      phaseCode: "act",
      sequence: 15,
      name: "Management-Review BCMS",
      isoClause: "9.3",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-C03"],
      targetModuleLink: { module: "isms", route: "/isms/reviews" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "BCM-A02",
      phaseCode: "act",
      sequence: 16,
      name: "Stage-1 + Stage-2 Audit (BCMS-Zertifizierung)",
      defaultOwnerRole: "admin",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["BCM-A01"],
      targetModuleLink: { module: "audit", route: "/audit" },
      requiredEvidenceCount: 3,
      isMilestone: true,
    },
    {
      code: "BCM-A03",
      phaseCode: "act",
      sequence: 17,
      name: "Lessons Learned + Y2-Übungs-Plan",
      isoClause: "10.1",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-A02"],
      requiredEvidenceCount: 1,
    },
  ],
};

// ──────────────────────────────────────────────────────────────
// GDPR (DPMS) Template
// ──────────────────────────────────────────────────────────────

const GDPR_TEMPLATE: SeedTemplate = {
  code: "gdpr-2016-679",
  msType: "dpms",
  name: "EU 2016/679 (DSGVO) — DPMS-Einführung",
  description:
    "Geführter Einführungsprozess für ein Datenschutz-Managementsystem nach DSGVO mit RoPA, DPIA, DSR-Workflow und Breach-Management.",
  version: "1.0",
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
  steps: [
    {
      code: "DP-S00",
      phaseCode: "setup",
      sequence: 0,
      name: "DPO benennen + Charter",
      isoClause: "GDPR Art. 37",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "DP-P01",
      phaseCode: "plan",
      sequence: 1,
      name: "Datenschutz-Politik + Privacy-Notice",
      isoClause: "GDPR Art. 13/14",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["DP-S00"],
      targetModuleLink: { module: "documents", route: "/policies" },
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-P02",
      phaseCode: "plan",
      sequence: 2,
      name: "Verantwortlichkeiten + RACI",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["DP-S00"],
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-D01",
      phaseCode: "do",
      sequence: 3,
      name: "RoPA Erst-Erfassung",
      isoClause: "GDPR Art. 30",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 60,
      prerequisiteStepCodes: ["DP-P01"],
      targetModuleLink: { module: "dpms", route: "/data-privacy/ropa" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "DP-D02",
      phaseCode: "do",
      sequence: 4,
      name: "Rechtsgrundlagen-Bewertung",
      isoClause: "GDPR Art. 6",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["DP-D01"],
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-D03",
      phaseCode: "do",
      sequence: 5,
      name: "DPIA für Hochrisiko-Verarbeitungen",
      isoClause: "GDPR Art. 35",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["DP-D01"],
      targetModuleLink: { module: "dpms", route: "/data-privacy/dpia" },
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-D04",
      phaseCode: "do",
      sequence: 6,
      name: "TOMs (Art. 32)",
      isoClause: "GDPR Art. 32",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["DP-D03"],
      targetModuleLink: { module: "ics", route: "/controls" },
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-D05",
      phaseCode: "do",
      sequence: 7,
      name: "Auftragsverarbeiter-Verträge (AVV)",
      isoClause: "GDPR Art. 28",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["DP-D01"],
      targetModuleLink: {
        module: "tprm",
        route: "/contracts",
      },
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-D06",
      phaseCode: "do",
      sequence: 8,
      name: "DSR-Workflow (Betroffenenrechte)",
      isoClause: "GDPR Art. 12-22",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["DP-D01"],
      targetModuleLink: { module: "dpms", route: "/data-privacy/dsr" },
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-D07",
      phaseCode: "do",
      sequence: 9,
      name: "Datenschutz-Vorfalls-Workflow (72h-Meldung)",
      isoClause: "GDPR Art. 33/34",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["DP-D01"],
      targetModuleLink: { module: "dpms", route: "/data-privacy/breaches" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "DP-C01",
      phaseCode: "check",
      sequence: 10,
      name: "Internes Audit Datenschutz",
      defaultOwnerRole: "auditor",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["DP-D04", "DP-D06", "DP-D07"],
      targetModuleLink: { module: "audit", route: "/audit" },
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-C02",
      phaseCode: "check",
      sequence: 11,
      name: "DSR-Antwort-Frist-Test (1-Monats-Test)",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["DP-D06"],
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-A01",
      phaseCode: "act",
      sequence: 12,
      name: "Management-Review DPMS",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["DP-C01"],
      targetModuleLink: { module: "isms", route: "/isms/reviews" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "DP-A02",
      phaseCode: "act",
      sequence: 13,
      name: "Privacy-by-Design-Integration in BPMN-Prozesse",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["DP-A01"],
      requiredEvidenceCount: 1,
    },
  ],
};

// ──────────────────────────────────────────────────────────────
// ISO 42001:2023 (AIMS) Template
// ──────────────────────────────────────────────────────────────

const ISO_42001_TEMPLATE: SeedTemplate = {
  code: "iso42001-2023",
  msType: "aims",
  name: "ISO/IEC 42001:2023 — AIMS-Einführung",
  description:
    "Geführter Einführungsprozess für ein AI Management System nach ISO/IEC 42001:2023 mit EU-AI-Act-Mapping.",
  version: "1.0",
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
  steps: [
    {
      code: "AI-S00",
      phaseCode: "setup",
      sequence: 0,
      name: "GL-Commitment + AI-Beauftragter",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "AI-P01",
      phaseCode: "plan",
      sequence: 1,
      name: "AI-Politik + ethische Grundsätze",
      isoClause: "ISO 42001 §5.2",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["AI-S00"],
      targetModuleLink: { module: "documents", route: "/policies" },
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-P02",
      phaseCode: "plan",
      sequence: 2,
      name: "AI-System-Inventar (Erst-Erfassung)",
      isoClause: "EU AI Act Art. 49",
      defaultOwnerRole: "admin",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["AI-S00"],
      targetModuleLink: { module: "ai-act", route: "/ai-act/systems" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "AI-P03",
      phaseCode: "plan",
      sequence: 3,
      name: "Risiko-Klassifikation (verboten / hoch / begrenzt / minimal)",
      isoClause: "EU AI Act Art. 5-6",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["AI-P02"],
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-D01",
      phaseCode: "do",
      sequence: 4,
      name: "Quality-Management-System (Annex IX)",
      isoClause: "EU AI Act Art. 17",
      defaultOwnerRole: "admin",
      defaultDurationDays: 60,
      prerequisiteStepCodes: ["AI-P02"],
      targetModuleLink: { module: "ai-act", route: "/ai-act/qms" },
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-D02",
      phaseCode: "do",
      sequence: 5,
      name: "Risiko-Management Hochrisiko-AI (Annex IV)",
      isoClause: "EU AI Act Art. 9",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["AI-P03"],
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-D03",
      phaseCode: "do",
      sequence: 6,
      name: "Daten-Governance + Trainingsdaten-Doku",
      isoClause: "EU AI Act Art. 10",
      defaultOwnerRole: "admin",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["AI-D02"],
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-D04",
      phaseCode: "do",
      sequence: 7,
      name: "Technical Documentation (Annex IV)",
      isoClause: "EU AI Act Art. 11",
      defaultOwnerRole: "admin",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["AI-D02"],
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-D05",
      phaseCode: "do",
      sequence: 8,
      name: "Human-Oversight-Design + Logging",
      isoClause: "EU AI Act Art. 12-14",
      defaultOwnerRole: "admin",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["AI-D02"],
      targetModuleLink: { module: "ai-act", route: "/ai-act/oversight-logs" },
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-D06",
      phaseCode: "do",
      sequence: 9,
      name: "Conformity-Assessment + CE-Kennzeichnung",
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
    },
    {
      code: "AI-C01",
      phaseCode: "check",
      sequence: 10,
      name: "FRIA für Hochrisiko-Deployments",
      isoClause: "EU AI Act Art. 27",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["AI-D06"],
      targetModuleLink: { module: "ai-act", route: "/ai-act/frias" },
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-C02",
      phaseCode: "check",
      sequence: 11,
      name: "Internes Audit AIMS",
      defaultOwnerRole: "auditor",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["AI-D06"],
      targetModuleLink: { module: "audit", route: "/audit" },
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-C03",
      phaseCode: "check",
      sequence: 12,
      name: "Penetrations-Test ML-Modelle (Adversarial Robustness)",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["AI-D06"],
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-A01",
      phaseCode: "act",
      sequence: 13,
      name: "Management-Review AIMS",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["AI-C02"],
      targetModuleLink: { module: "isms", route: "/isms/reviews" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "AI-A02",
      phaseCode: "act",
      sequence: 14,
      name: "Post-Market-Monitoring-Plan",
      isoClause: "EU AI Act Art. 72",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["AI-A01"],
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-A03",
      phaseCode: "act",
      sequence: 15,
      name: "Incident-Reporting an Marktüberwachungsbehörde",
      isoClause: "EU AI Act Art. 73",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["AI-A02"],
      targetModuleLink: { module: "ai-act", route: "/ai-act/incidents" },
      requiredEvidenceCount: 1,
    },
  ],
};

// ──────────────────────────────────────────────────────────────
// All templates
// ──────────────────────────────────────────────────────────────

export const PROGRAMME_TEMPLATE_SEEDS: SeedTemplate[] = [
  ISO_27001_TEMPLATE,
  ISO_22301_TEMPLATE,
  GDPR_TEMPLATE,
  ISO_42001_TEMPLATE,
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
