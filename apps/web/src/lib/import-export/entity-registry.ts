// Sprint 19: Entity Definition Registry
// Generic import/export engine — entity types registered via config, NOT hardcoded logic.
// Adding a new entity type = adding one config entry.

import type { EntityDefinition } from "@grc/shared";

// ──────────────────────────────────────────────────────────────
// Risk
// ──────────────────────────────────────────────────────────────

const riskDefinition: EntityDefinition = {
  key: "risk",
  tableName: "risk",
  requiredFields: [
    {
      name: "title",
      type: "string",
      aliases: ["Titel", "Title", "Risiko-Titel", "Risk Title", "Name"],
      required: true,
    },
    {
      name: "risk_category",
      type: "enum",
      aliases: ["Kategorie", "Category", "Risikokategorie", "Risk Category"],
      enumValues: [
        "strategic",
        "operational",
        "financial",
        "compliance",
        "cyber",
        "reputational",
        "esg",
      ],
      required: true,
    },
    {
      name: "risk_source",
      type: "enum",
      aliases: ["Quelle", "Source", "Risikoquelle", "Risk Source"],
      enumValues: ["isms", "erm", "bcm", "project", "process"],
      required: true,
    },
  ],
  optionalFields: [
    {
      name: "description",
      type: "string",
      aliases: ["Beschreibung", "Description"],
    },
    {
      name: "department",
      type: "string",
      aliases: ["Abteilung", "Department"],
    },
    {
      name: "inherent_likelihood",
      type: "integer",
      aliases: [
        "Eintrittswahrscheinlichkeit",
        "Likelihood",
        "Inherent Likelihood",
      ],
      min: 1,
      max: 5,
    },
    {
      name: "inherent_impact",
      type: "integer",
      aliases: ["Auswirkung", "Impact", "Inherent Impact"],
      min: 1,
      max: 5,
    },
    {
      name: "owner_email",
      type: "fk",
      aliases: [
        "Verantwortlicher",
        "Owner",
        "Risk Owner",
        "Owner Email",
        "Verantwortlicher Email",
      ],
    },
    {
      name: "review_date",
      type: "date",
      aliases: ["Pruefdatum", "Review Date"],
    },
  ],
  fkResolutionRules: [
    {
      field: "owner_email",
      lookupTable: "user",
      lookupField: "email",
      matchType: "exact",
    },
  ],
  uniqueKey: ["title", "org_id"],
  templateHeaders: [
    "Titel",
    "Kategorie",
    "Quelle",
    "Beschreibung",
    "Abteilung",
    "Eintrittswahrscheinlichkeit",
    "Auswirkung",
    "Verantwortlicher Email",
    "Pruefdatum",
  ],
  templateExampleRows: [
    [
      "Ransomware-Angriff auf Kernsysteme",
      "cyber",
      "isms",
      "Verschluesselung kritischer Systeme durch Schadsoftware",
      "IT-Sicherheit",
      4,
      5,
      "max.mustermann@example.com",
      "2026-06-30",
    ],
    [
      "Datenverlust Cloud-Speicher",
      "cyber",
      "erm",
      "Unbeabsichtigter Verlust von Daten in Cloud-Speicher",
      "IT-Betrieb",
      3,
      4,
      "anna.schmidt@example.com",
      "2026-09-15",
    ],
    [
      "Lieferantenausfall kritisch",
      "operational",
      "erm",
      "Kritischer Lieferant kann nicht mehr liefern",
      "Einkauf",
      2,
      4,
      "",
      "2026-12-01",
    ],
  ],
  exportColumns: [
    { key: "title", header: "Titel" },
    { key: "riskCategory", header: "Kategorie" },
    { key: "riskSource", header: "Quelle" },
    { key: "status", header: "Status" },
    { key: "description", header: "Beschreibung" },
    { key: "department", header: "Abteilung" },
    { key: "inherentLikelihood", header: "Eintrittswahrscheinlichkeit" },
    { key: "inherentImpact", header: "Auswirkung" },
    { key: "riskScoreInherent", header: "Inhaerent Score" },
    { key: "residualLikelihood", header: "Residuale Wahrscheinlichkeit" },
    { key: "residualImpact", header: "Residuale Auswirkung" },
    { key: "riskScoreResidual", header: "Residualer Score" },
    { key: "treatmentStrategy", header: "Behandlungsstrategie" },
    { key: "createdAt", header: "Erstellt am" },
  ],
};

// ──────────────────────────────────────────────────────────────
// Control
// ──────────────────────────────────────────────────────────────

const controlDefinition: EntityDefinition = {
  key: "control",
  tableName: "control",
  requiredFields: [
    {
      name: "title",
      type: "string",
      aliases: ["Titel", "Title", "Kontrolle", "Control Name"],
      required: true,
    },
    {
      name: "control_type",
      type: "enum",
      aliases: ["Typ", "Type", "Kontrolltyp", "Control Type"],
      enumValues: ["preventive", "detective", "corrective"],
      required: true,
    },
  ],
  optionalFields: [
    {
      name: "description",
      type: "string",
      aliases: ["Beschreibung", "Description"],
    },
    {
      name: "frequency",
      type: "enum",
      aliases: ["Frequenz", "Frequency", "Haeufigkeit"],
      enumValues: [
        "event_driven",
        "continuous",
        "daily",
        "weekly",
        "monthly",
        "quarterly",
        "annually",
        "ad_hoc",
      ],
    },
    {
      name: "automation_level",
      type: "enum",
      aliases: [
        "Automatisierungsgrad",
        "Automation Level",
        "Automation",
      ],
      enumValues: ["manual", "semi_automated", "fully_automated"],
    },
    {
      name: "department",
      type: "string",
      aliases: ["Abteilung", "Department"],
    },
    {
      name: "owner_email",
      type: "fk",
      aliases: [
        "Verantwortlicher",
        "Owner",
        "Control Owner",
        "Owner Email",
      ],
    },
  ],
  fkResolutionRules: [
    {
      field: "owner_email",
      lookupTable: "user",
      lookupField: "email",
      matchType: "exact",
    },
  ],
  uniqueKey: ["title", "org_id"],
  templateHeaders: [
    "Titel",
    "Typ",
    "Beschreibung",
    "Frequenz",
    "Automatisierungsgrad",
    "Abteilung",
    "Verantwortlicher Email",
  ],
  templateExampleRows: [
    [
      "Zugangskontrolle Serverraum",
      "preventive",
      "Physische Zutrittskontrolle zum Rechenzentrum",
      "continuous",
      "fully_automated",
      "IT-Sicherheit",
      "max.mustermann@example.com",
    ],
    [
      "Monatliche Kontenabstimmung",
      "detective",
      "Abstimmung aller Bankkonten mit Buchhaltung",
      "monthly",
      "manual",
      "Finanzen",
      "anna.schmidt@example.com",
    ],
    [
      "Backup-Wiederherstellungstest",
      "corrective",
      "Quartalsweiser Test der Backup-Wiederherstellung",
      "quarterly",
      "semi_automated",
      "IT-Betrieb",
      "",
    ],
  ],
  exportColumns: [
    { key: "title", header: "Titel" },
    { key: "controlType", header: "Typ" },
    { key: "status", header: "Status" },
    { key: "description", header: "Beschreibung" },
    { key: "frequency", header: "Frequenz" },
    { key: "automationLevel", header: "Automatisierungsgrad" },
    { key: "department", header: "Abteilung" },
    { key: "createdAt", header: "Erstellt am" },
  ],
};

// ──────────────────────────────────────────────────────────────
// Asset
// ──────────────────────────────────────────────────────────────

const assetDefinition: EntityDefinition = {
  key: "asset",
  tableName: "asset",
  requiredFields: [
    {
      name: "name",
      type: "string",
      aliases: ["Name", "Asset Name", "Bezeichnung"],
      required: true,
    },
  ],
  optionalFields: [
    {
      name: "description",
      type: "string",
      aliases: ["Beschreibung", "Description"],
    },
    {
      name: "asset_tier",
      type: "enum",
      aliases: ["Ebene", "Tier", "Asset Tier"],
      enumValues: ["business_structure", "primary_asset", "supporting_asset"],
    },
    {
      name: "code_group",
      type: "string",
      aliases: ["Codegruppe", "Code Group"],
    },
    {
      name: "contact_person",
      type: "string",
      aliases: ["Ansprechpartner", "Contact Person", "Contact"],
    },
  ],
  fkResolutionRules: [],
  uniqueKey: ["name", "org_id"],
  templateHeaders: [
    "Name",
    "Beschreibung",
    "Ebene",
    "Codegruppe",
    "Ansprechpartner",
  ],
  templateExampleRows: [
    [
      "ERP-System SAP",
      "Zentrales Enterprise Resource Planning System",
      "primary_asset",
      "IT-APP",
      "max.mustermann@example.com",
    ],
    [
      "Datenbankserver DB-01",
      "Primaerer Datenbankserver im RZ-Nord",
      "supporting_asset",
      "IT-INFRA",
      "anna.schmidt@example.com",
    ],
    [
      "Kundenportal",
      "Webbasiertes Self-Service-Portal fuer Kunden",
      "primary_asset",
      "IT-APP",
      "",
    ],
  ],
  exportColumns: [
    { key: "name", header: "Name" },
    { key: "description", header: "Beschreibung" },
    { key: "assetTier", header: "Ebene" },
    { key: "codeGroup", header: "Codegruppe" },
    { key: "contactPerson", header: "Ansprechpartner" },
    { key: "createdAt", header: "Erstellt am" },
  ],
};

// ──────────────────────────────────────────────────────────────
// Vendor
// ──────────────────────────────────────────────────────────────

const vendorDefinition: EntityDefinition = {
  key: "vendor",
  tableName: "vendor",
  requiredFields: [
    {
      name: "name",
      type: "string",
      aliases: ["Name", "Vendor Name", "Lieferant", "Lieferantenname"],
      required: true,
    },
  ],
  optionalFields: [
    {
      name: "legal_name",
      type: "string",
      aliases: ["Firmenname", "Legal Name"],
    },
    {
      name: "description",
      type: "string",
      aliases: ["Beschreibung", "Description"],
    },
    {
      name: "category",
      type: "enum",
      aliases: ["Kategorie", "Category", "Lieferantenkategorie"],
      enumValues: [
        "it_services",
        "cloud_provider",
        "consulting",
        "facility",
        "logistics",
        "raw_materials",
        "financial",
        "hr_services",
        "other",
      ],
    },
    {
      name: "tier",
      type: "enum",
      aliases: ["Stufe", "Tier", "Kritikalitaet"],
      enumValues: ["critical", "important", "standard", "low_risk"],
    },
    {
      name: "country",
      type: "string",
      aliases: ["Land", "Country"],
    },
    {
      name: "website",
      type: "string",
      aliases: ["Website", "Webseite", "URL"],
    },
    {
      name: "tax_id",
      type: "string",
      aliases: ["Steuernummer", "Tax ID", "USt-ID"],
    },
  ],
  fkResolutionRules: [],
  uniqueKey: ["name", "org_id"],
  templateHeaders: [
    "Name",
    "Firmenname",
    "Beschreibung",
    "Kategorie",
    "Stufe",
    "Land",
    "Website",
    "Steuernummer",
  ],
  templateExampleRows: [
    [
      "Nordlicht IT Services GmbH",
      "Nordlicht IT Services GmbH",
      "Managed IT Services Provider",
      "it_services",
      "critical",
      "Deutschland",
      "https://www.example-nordlicht.de",
      "DE123456789",
    ],
    [
      "Alpenvision Consulting AG",
      "Alpenvision Consulting AG",
      "Strategieberatung und Transformation",
      "consulting",
      "important",
      "Schweiz",
      "https://www.example-alpenvision.ch",
      "CHE-123.456.789",
    ],
    [
      "Ostsee Logistik KG",
      "Ostsee Logistik KG",
      "Lagerhaltung und Transportlogistik",
      "logistics",
      "standard",
      "Deutschland",
      "",
      "",
    ],
  ],
  exportColumns: [
    { key: "name", header: "Name" },
    { key: "legalName", header: "Firmenname" },
    { key: "category", header: "Kategorie" },
    { key: "tier", header: "Stufe" },
    { key: "status", header: "Status" },
    { key: "country", header: "Land" },
    { key: "website", header: "Website" },
    { key: "createdAt", header: "Erstellt am" },
  ],
};

// ──────────────────────────────────────────────────────────────
// Contract
// ──────────────────────────────────────────────────────────────

const contractDefinition: EntityDefinition = {
  key: "contract",
  tableName: "contract",
  requiredFields: [
    {
      name: "title",
      type: "string",
      aliases: ["Titel", "Title", "Vertrag", "Contract Name"],
      required: true,
    },
    {
      name: "contract_type",
      type: "enum",
      aliases: ["Vertragstyp", "Contract Type", "Typ"],
      enumValues: [
        "master_agreement",
        "service_agreement",
        "nda",
        "dpa",
        "sla",
        "license",
        "maintenance",
        "consulting",
        "other",
      ],
      required: true,
    },
  ],
  optionalFields: [
    {
      name: "description",
      type: "string",
      aliases: ["Beschreibung", "Description"],
    },
    {
      name: "vendor_name",
      type: "fk",
      aliases: ["Lieferant", "Vendor", "Vendor Name"],
    },
    {
      name: "start_date",
      type: "date",
      aliases: ["Startdatum", "Start Date", "Beginn"],
    },
    {
      name: "end_date",
      type: "date",
      aliases: ["Enddatum", "End Date", "Ende"],
    },
    {
      name: "value",
      type: "number",
      aliases: ["Wert", "Value", "Vertragswert", "Contract Value"],
    },
  ],
  fkResolutionRules: [
    {
      field: "vendor_name",
      lookupTable: "vendor",
      lookupField: "name",
      matchType: "ilike",
    },
  ],
  uniqueKey: ["title", "org_id"],
  templateHeaders: [
    "Titel",
    "Vertragstyp",
    "Beschreibung",
    "Lieferant",
    "Startdatum",
    "Enddatum",
    "Vertragswert",
  ],
  templateExampleRows: [
    [
      "Cloud-Hosting Rahmenvertrag",
      "master_agreement",
      "Rahmenvertrag fuer Cloud-Infrastructure-Services",
      "Nordlicht IT Services GmbH",
      "2026-01-01",
      "2028-12-31",
      250000,
    ],
    [
      "Datenschutzvereinbarung Beratung",
      "dpa",
      "AVV fuer Beratungsleistungen mit Personenbezug",
      "Alpenvision Consulting AG",
      "2026-03-01",
      "2027-02-28",
      0,
    ],
    [
      "Wartungsvertrag ERP",
      "maintenance",
      "Jaehrlicher Wartungsvertrag fuer ERP-System",
      "",
      "2026-01-01",
      "2026-12-31",
      85000,
    ],
  ],
  exportColumns: [
    { key: "title", header: "Titel" },
    { key: "contractType", header: "Vertragstyp" },
    { key: "status", header: "Status" },
    { key: "description", header: "Beschreibung" },
    { key: "startDate", header: "Startdatum" },
    { key: "endDate", header: "Enddatum" },
    { key: "totalValue", header: "Vertragswert" },
    { key: "createdAt", header: "Erstellt am" },
  ],
};

// ──────────────────────────────────────────────────────────────
// Incident
// ──────────────────────────────────────────────────────────────

const incidentDefinition: EntityDefinition = {
  key: "incident",
  tableName: "incident",
  requiredFields: [
    {
      name: "title",
      type: "string",
      aliases: ["Titel", "Title", "Vorfall", "Incident Name"],
      required: true,
    },
    {
      name: "severity",
      type: "enum",
      aliases: [
        "Schweregrad",
        "Severity",
        "Kritikalitaet",
      ],
      enumValues: ["low", "medium", "high", "critical"],
      required: true,
    },
  ],
  optionalFields: [
    {
      name: "description",
      type: "string",
      aliases: ["Beschreibung", "Description"],
    },
    {
      name: "detected_at",
      type: "date",
      aliases: ["Erkannt am", "Detected At", "Detection Date"],
    },
    {
      name: "reporter_email",
      type: "fk",
      aliases: ["Melder", "Reporter", "Reporter Email"],
    },
  ],
  fkResolutionRules: [
    {
      field: "reporter_email",
      lookupTable: "user",
      lookupField: "email",
      matchType: "exact",
    },
  ],
  uniqueKey: ["title", "org_id"],
  templateHeaders: [
    "Titel",
    "Schweregrad",
    "Beschreibung",
    "Erkannt am",
    "Melder Email",
  ],
  templateExampleRows: [
    [
      "Phishing-Angriff auf Finanzabteilung",
      "high",
      "Gezielte Phishing-Kampagne gegen Mitarbeiter der Finanzabteilung",
      "2026-03-15",
      "max.mustermann@example.com",
    ],
    [
      "Serverausfall Webportal",
      "medium",
      "Ungeplanter Ausfall des Kundenportals durch Hardware-Defekt",
      "2026-03-20",
      "anna.schmidt@example.com",
    ],
    [
      "Unbefugter Zugriff auf Dateiablage",
      "critical",
      "Unbekannter Zugriff auf vertrauliche Projektdokumentation",
      "2026-03-22",
      "",
    ],
  ],
  exportColumns: [
    { key: "title", header: "Titel" },
    { key: "severity", header: "Schweregrad" },
    { key: "status", header: "Status" },
    { key: "description", header: "Beschreibung" },
    { key: "detectedAt", header: "Erkannt am" },
    { key: "createdAt", header: "Erstellt am" },
  ],
};

// ──────────────────────────────────────────────────────────────
// Process
// ──────────────────────────────────────────────────────────────

const processDefinition: EntityDefinition = {
  key: "process",
  tableName: "process",
  requiredFields: [
    {
      name: "name",
      type: "string",
      aliases: ["Name", "Process Name", "Prozessname"],
      required: true,
    },
  ],
  optionalFields: [
    {
      name: "description",
      type: "string",
      aliases: ["Beschreibung", "Description"],
    },
    {
      name: "department",
      type: "string",
      aliases: ["Abteilung", "Department"],
    },
    {
      name: "level",
      type: "integer",
      aliases: ["Ebene", "Level", "Prozessebene"],
      min: 1,
      max: 10,
    },
    {
      name: "owner_email",
      type: "fk",
      aliases: [
        "Prozessverantwortlicher",
        "Process Owner",
        "Owner Email",
      ],
    },
    {
      name: "is_essential",
      type: "boolean",
      aliases: ["Wesentlich", "Essential", "Is Essential"],
    },
  ],
  fkResolutionRules: [
    {
      field: "owner_email",
      lookupTable: "user",
      lookupField: "email",
      matchType: "exact",
    },
  ],
  uniqueKey: ["name", "org_id"],
  templateHeaders: [
    "Name",
    "Beschreibung",
    "Abteilung",
    "Ebene",
    "Prozessverantwortlicher Email",
    "Wesentlich",
  ],
  templateExampleRows: [
    [
      "Auftragsabwicklung",
      "End-to-End Prozess der Auftragsverarbeitung",
      "Vertrieb",
      1,
      "max.mustermann@example.com",
      true,
    ],
    [
      "Rechnungspruefung",
      "Pruefung und Freigabe eingehender Rechnungen",
      "Finanzen",
      2,
      "anna.schmidt@example.com",
      false,
    ],
    [
      "Onboarding neuer Mitarbeiter",
      "Standardisierter Einstellungsprozess",
      "Personal",
      1,
      "",
      false,
    ],
  ],
  exportColumns: [
    { key: "name", header: "Name" },
    { key: "description", header: "Beschreibung" },
    { key: "department", header: "Abteilung" },
    { key: "level", header: "Ebene" },
    { key: "status", header: "Status" },
    { key: "isEssential", header: "Wesentlich" },
    { key: "createdAt", header: "Erstellt am" },
  ],
};

// ──────────────────────────────────────────────────────────────
// RoPA Entry
// ──────────────────────────────────────────────────────────────

const ropaEntryDefinition: EntityDefinition = {
  key: "ropa_entry",
  tableName: "ropa_entry",
  requiredFields: [
    {
      name: "title",
      type: "string",
      aliases: [
        "Titel",
        "Title",
        "Verarbeitungstaetigkeit",
        "Processing Activity",
      ],
      required: true,
    },
    {
      name: "purpose",
      type: "string",
      aliases: ["Zweck", "Purpose", "Verarbeitungszweck"],
      required: true,
    },
    {
      name: "legal_basis",
      type: "enum",
      aliases: ["Rechtsgrundlage", "Legal Basis"],
      enumValues: [
        "consent",
        "contract",
        "legal_obligation",
        "vital_interest",
        "public_interest",
        "legitimate_interest",
      ],
      required: true,
    },
  ],
  optionalFields: [
    {
      name: "processing_description",
      type: "string",
      aliases: ["Verarbeitungsbeschreibung", "Processing Description"],
    },
    {
      name: "retention_period",
      type: "string",
      aliases: ["Aufbewahrungsfrist", "Retention Period"],
    },
    {
      name: "international_transfer",
      type: "boolean",
      aliases: [
        "Internationaler Transfer",
        "International Transfer",
        "Drittlandtransfer",
      ],
    },
    {
      name: "transfer_country",
      type: "string",
      aliases: ["Transferland", "Transfer Country"],
    },
    {
      name: "responsible_email",
      type: "fk",
      aliases: ["Verantwortlicher Email", "Responsible", "Responsible Email"],
    },
  ],
  fkResolutionRules: [
    {
      field: "responsible_email",
      lookupTable: "user",
      lookupField: "email",
      matchType: "exact",
    },
  ],
  uniqueKey: ["title", "org_id"],
  templateHeaders: [
    "Titel",
    "Zweck",
    "Rechtsgrundlage",
    "Verarbeitungsbeschreibung",
    "Aufbewahrungsfrist",
    "Drittlandtransfer",
    "Transferland",
    "Verantwortlicher Email",
  ],
  templateExampleRows: [
    [
      "Lohnabrechnung",
      "Berechnung und Auszahlung der Gehaelter",
      "contract",
      "Verarbeitung personenbezogener Daten fuer die Gehaltsabrechnung",
      "10 Jahre",
      false,
      "",
      "max.mustermann@example.com",
    ],
    [
      "Newsletter-Versand",
      "Versand von Marketing-Newslettern an Abonnenten",
      "consent",
      "E-Mail-Marketing an eingewilligte Empfaenger",
      "Bis Widerruf",
      true,
      "USA",
      "anna.schmidt@example.com",
    ],
    [
      "Videoüberwachung Eingangsbereich",
      "Sicherheit und Zutrittskontrolle",
      "legitimate_interest",
      "Kameraueberwachung der Eingangsbereiche",
      "72 Stunden",
      false,
      "",
      "",
    ],
  ],
  exportColumns: [
    { key: "title", header: "Titel" },
    { key: "purpose", header: "Zweck" },
    { key: "legalBasis", header: "Rechtsgrundlage" },
    { key: "status", header: "Status" },
    { key: "retentionPeriod", header: "Aufbewahrungsfrist" },
    { key: "internationalTransfer", header: "Drittlandtransfer" },
    { key: "createdAt", header: "Erstellt am" },
  ],
};

// ──────────────────────────────────────────────────────────────
// Registry
// ──────────────────────────────────────────────────────────────

export const ENTITY_REGISTRY: Record<string, EntityDefinition> = {
  risk: riskDefinition,
  control: controlDefinition,
  asset: assetDefinition,
  vendor: vendorDefinition,
  contract: contractDefinition,
  incident: incidentDefinition,
  process: processDefinition,
  ropa_entry: ropaEntryDefinition,
};

export function getEntityDefinition(
  entityType: string,
): EntityDefinition | undefined {
  return ENTITY_REGISTRY[entityType];
}

export function getSupportedEntityTypes(): string[] {
  return Object.keys(ENTITY_REGISTRY);
}
