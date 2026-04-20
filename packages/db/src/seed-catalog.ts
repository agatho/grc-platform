// Seed: Sprint 4b — Platform Catalog Data (risk + control catalogs)
// Run: npx tsx src/seed-catalog.ts (from packages/db)
// Idempotent: uses ON CONFLICT DO NOTHING / existence checks

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function seed() {
  console.log("Seeding Sprint 4b Catalog & Framework data...");

  // ══════════════════════════════════════════════════════════════
  // A) Cambridge Risk Taxonomy v2.0
  // ══════════════════════════════════════════════════════════════

  // Check idempotency
  const existingRiskCatalog = await db.execute(
    sql`SELECT id FROM risk_catalog WHERE source = 'cambridge_v2' LIMIT 1`,
  );

  let riskCatalogId: string;

  if (existingRiskCatalog.length > 0) {
    riskCatalogId = existingRiskCatalog[0].id as string;
    console.log(
      "  Cambridge v2 risk catalog already exists, skipping catalog insert.",
    );
  } else {
    const inserted = await db.execute(sql`
      INSERT INTO risk_catalog (name, description, version, source, language, entry_count, is_system, is_active)
      VALUES (
        'Cambridge Risk Taxonomy',
        'Umfassende Risikotaxonomie basierend auf dem Cambridge Risk Framework v2.0 mit 5 Risikoklassen, 15 Risikofamilien und 30+ Einzelrisiken',
        '2.0',
        'cambridge_v2',
        'de',
        50,
        true,
        true
      )
      RETURNING id
    `);
    riskCatalogId = inserted[0].id as string;
    console.log("  Created Cambridge v2 risk catalog.");
  }

  // Level 1 — Risk Classes (5)
  await db.execute(sql`
    INSERT INTO risk_catalog_entry (catalog_id, code, title_de, title_en, description_de, description_en, level, risk_category, sort_order)
    VALUES
    (${riskCatalogId}, 'CAM-1', 'Finanzrisiken', 'Financial Risks', 'Risiken aus Markt-, Kredit- und Liquiditaetsbewegungen', 'Risks from market, credit and liquidity movements', 1, 'financial', 100),
    (${riskCatalogId}, 'CAM-2', 'Operationelle Risiken', 'Operational Risks', 'Risiken aus internen Prozessen, Systemen und externen Ereignissen', 'Risks from internal processes, systems and external events', 1, 'operational', 200),
    (${riskCatalogId}, 'CAM-3', 'Strategische Risiken', 'Strategic Risks', 'Risiken aus strategischen Entscheidungen und Marktveraenderungen', 'Risks from strategic decisions and market changes', 1, 'strategic', 300),
    (${riskCatalogId}, 'CAM-4', 'Compliance- und Governance-Risiken', 'Compliance & Governance Risks', 'Risiken aus regulatorischen Anforderungen und Unternehmenssteuerung', 'Risks from regulatory requirements and corporate governance', 1, 'compliance', 400),
    (${riskCatalogId}, 'CAM-5', 'ESG- und Umweltrisiken', 'ESG & Environmental Risks', 'Risiken aus Umwelt-, Sozial- und Governance-Faktoren', 'Risks from environmental, social and governance factors', 1, 'esg', 500)
    ON CONFLICT DO NOTHING
  `);

  // Get Level 1 IDs for parent references
  const level1Entries = await db.execute(sql`
    SELECT id, code FROM risk_catalog_entry WHERE catalog_id = ${riskCatalogId} AND level = 1 ORDER BY sort_order
  `);
  const l1Map = Object.fromEntries(
    level1Entries.map((e: any) => [e.code, e.id]),
  );

  // Level 2 — Risk Families (~15)
  await db.execute(sql`
    INSERT INTO risk_catalog_entry (catalog_id, parent_entry_id, code, title_de, title_en, description_de, description_en, level, risk_category, sort_order)
    VALUES
    -- CAM-1: Financial
    (${riskCatalogId}, ${l1Map["CAM-1"]}, 'CAM-1.1', 'Marktrisiken', 'Market Risks', 'Risiken aus Marktpreisveraenderungen', 'Risks from market price changes', 2, 'financial', 110),
    (${riskCatalogId}, ${l1Map["CAM-1"]}, 'CAM-1.2', 'Kreditrisiken', 'Credit Risks', 'Risiken aus Zahlungsausfaellen von Geschaeftspartnern', 'Risks from counterparty payment defaults', 2, 'financial', 120),
    (${riskCatalogId}, ${l1Map["CAM-1"]}, 'CAM-1.3', 'Liquiditaetsrisiken', 'Liquidity Risks', 'Risiken aus unzureichender Zahlungsfaehigkeit', 'Risks from insufficient payment capacity', 2, 'financial', 130),
    -- CAM-2: Operational
    (${riskCatalogId}, ${l1Map["CAM-2"]}, 'CAM-2.1', 'IT- und Cyberrisiken', 'IT & Cyber Risks', 'Risiken aus IT-Systemausfaellen und Cyberangriffen', 'Risks from IT system failures and cyber attacks', 2, 'cyber', 210),
    (${riskCatalogId}, ${l1Map["CAM-2"]}, 'CAM-2.2', 'Lieferkettenrisiken', 'Supply Chain Risks', 'Risiken aus Stoerungen in der Lieferkette', 'Risks from supply chain disruptions', 2, 'operational', 220),
    (${riskCatalogId}, ${l1Map["CAM-2"]}, 'CAM-2.3', 'Personalrisiken', 'People Risks', 'Risiken aus Personalverfuegbarkeit und -qualifikation', 'Risks from personnel availability and qualification', 2, 'operational', 230),
    -- CAM-3: Strategic
    (${riskCatalogId}, ${l1Map["CAM-3"]}, 'CAM-3.1', 'Wettbewerbsrisiken', 'Competitive Risks', 'Risiken aus Veraenderungen der Wettbewerbslandschaft', 'Risks from changes in competitive landscape', 2, 'strategic', 310),
    (${riskCatalogId}, ${l1Map["CAM-3"]}, 'CAM-3.2', 'Innovationsrisiken', 'Innovation Risks', 'Risiken aus technologischem Wandel und Disruption', 'Risks from technological change and disruption', 2, 'strategic', 320),
    (${riskCatalogId}, ${l1Map["CAM-3"]}, 'CAM-3.3', 'Reputationsrisiken', 'Reputational Risks', 'Risiken aus Schaedigung des Unternehmensrufs', 'Risks from damage to corporate reputation', 2, 'reputational', 330),
    -- CAM-4: Compliance
    (${riskCatalogId}, ${l1Map["CAM-4"]}, 'CAM-4.1', 'Regulatorische Risiken', 'Regulatory Risks', 'Risiken aus Nichteinhaltung gesetzlicher Vorgaben', 'Risks from non-compliance with legal requirements', 2, 'compliance', 410),
    (${riskCatalogId}, ${l1Map["CAM-4"]}, 'CAM-4.2', 'Vertragsrisiken', 'Contractual Risks', 'Risiken aus vertraglichen Verpflichtungen und Streitigkeiten', 'Risks from contractual obligations and disputes', 2, 'compliance', 420),
    (${riskCatalogId}, ${l1Map["CAM-4"]}, 'CAM-4.3', 'Datenschutzrisiken', 'Data Privacy Risks', 'Risiken aus Verletzung des Datenschutzes (DSGVO)', 'Risks from data privacy violations (GDPR)', 2, 'compliance', 430),
    -- CAM-5: ESG
    (${riskCatalogId}, ${l1Map["CAM-5"]}, 'CAM-5.1', 'Klimarisiken', 'Climate Risks', 'Risiken aus Klimawandel und Extremwetterereignissen', 'Risks from climate change and extreme weather events', 2, 'esg', 510),
    (${riskCatalogId}, ${l1Map["CAM-5"]}, 'CAM-5.2', 'Soziale Risiken', 'Social Risks', 'Risiken aus sozialen Faktoren und Arbeitsbedingungen', 'Risks from social factors and working conditions', 2, 'esg', 520),
    (${riskCatalogId}, ${l1Map["CAM-5"]}, 'CAM-5.3', 'Nachhaltigkeits-Governance-Risiken', 'Sustainability Governance Risks', 'Risiken aus unzureichender ESG-Steuerung', 'Risks from inadequate ESG governance', 2, 'esg', 530)
    ON CONFLICT DO NOTHING
  `);

  // Get Level 2 IDs
  const level2Entries = await db.execute(sql`
    SELECT id, code FROM risk_catalog_entry WHERE catalog_id = ${riskCatalogId} AND level = 2 ORDER BY sort_order
  `);
  const l2Map = Object.fromEntries(
    level2Entries.map((e: any) => [e.code, e.id]),
  );

  // Level 3 — Individual Risks (~30)
  await db.execute(sql`
    INSERT INTO risk_catalog_entry (catalog_id, parent_entry_id, code, title_de, title_en, level, risk_category, default_likelihood, default_impact, sort_order)
    VALUES
    -- CAM-1.1: Market Risks
    (${riskCatalogId}, ${l2Map["CAM-1.1"]}, 'CAM-1.1.1', 'Zinsaenderungsrisiko', 'Interest Rate Risk', 3, 'financial', 3, 3, 111),
    (${riskCatalogId}, ${l2Map["CAM-1.1"]}, 'CAM-1.1.2', 'Waehrungsrisiko', 'Foreign Exchange Risk', 3, 'financial', 2, 4, 112),
    -- CAM-1.2: Credit Risks
    (${riskCatalogId}, ${l2Map["CAM-1.2"]}, 'CAM-1.2.1', 'Forderungsausfallrisiko', 'Counterparty Default Risk', 3, 'financial', 2, 4, 121),
    (${riskCatalogId}, ${l2Map["CAM-1.2"]}, 'CAM-1.2.2', 'Konzentrationsrisiko', 'Concentration Risk', 3, 'financial', 2, 5, 122),
    -- CAM-1.3: Liquidity Risks
    (${riskCatalogId}, ${l2Map["CAM-1.3"]}, 'CAM-1.3.1', 'Zahlungsfaehigkeitsrisiko', 'Cash Flow Risk', 3, 'financial', 2, 5, 131),
    (${riskCatalogId}, ${l2Map["CAM-1.3"]}, 'CAM-1.3.2', 'Refinanzierungsrisiko', 'Refinancing Risk', 3, 'financial', 2, 4, 132),
    -- CAM-2.1: IT & Cyber
    (${riskCatalogId}, ${l2Map["CAM-2.1"]}, 'CAM-2.1.1', 'Ransomware-Angriff', 'Ransomware Attack', 3, 'cyber', 4, 5, 211),
    (${riskCatalogId}, ${l2Map["CAM-2.1"]}, 'CAM-2.1.2', 'Datenverlust durch Systemausfall', 'Data Loss from System Failure', 3, 'cyber', 3, 4, 212),
    (${riskCatalogId}, ${l2Map["CAM-2.1"]}, 'CAM-2.1.3', 'Phishing und Social Engineering', 'Phishing and Social Engineering', 3, 'cyber', 4, 3, 213),
    -- CAM-2.2: Supply Chain
    (${riskCatalogId}, ${l2Map["CAM-2.2"]}, 'CAM-2.2.1', 'Lieferantenausfall', 'Supplier Failure', 3, 'operational', 3, 4, 221),
    (${riskCatalogId}, ${l2Map["CAM-2.2"]}, 'CAM-2.2.2', 'Transportunterbrechung', 'Transport Disruption', 3, 'operational', 3, 3, 222),
    -- CAM-2.3: People
    (${riskCatalogId}, ${l2Map["CAM-2.3"]}, 'CAM-2.3.1', 'Fachkraeftemangel', 'Talent Shortage', 3, 'operational', 4, 3, 231),
    (${riskCatalogId}, ${l2Map["CAM-2.3"]}, 'CAM-2.3.2', 'Schluesselkraefteabgang', 'Key Person Dependency', 3, 'operational', 3, 4, 232),
    -- CAM-3.1: Competitive
    (${riskCatalogId}, ${l2Map["CAM-3.1"]}, 'CAM-3.1.1', 'Marktanteilsverlust', 'Market Share Loss', 3, 'strategic', 3, 4, 311),
    (${riskCatalogId}, ${l2Map["CAM-3.1"]}, 'CAM-3.1.2', 'Preisdruck durch Wettbewerb', 'Competitive Pricing Pressure', 3, 'strategic', 3, 3, 312),
    -- CAM-3.2: Innovation
    (${riskCatalogId}, ${l2Map["CAM-3.2"]}, 'CAM-3.2.1', 'Technologische Disruption', 'Technological Disruption', 3, 'strategic', 3, 5, 321),
    (${riskCatalogId}, ${l2Map["CAM-3.2"]}, 'CAM-3.2.2', 'Fehlinvestition F&E', 'R&D Misallocation', 3, 'strategic', 2, 4, 322),
    -- CAM-3.3: Reputation
    (${riskCatalogId}, ${l2Map["CAM-3.3"]}, 'CAM-3.3.1', 'Medienkrise', 'Media Crisis', 3, 'reputational', 2, 5, 331),
    (${riskCatalogId}, ${l2Map["CAM-3.3"]}, 'CAM-3.3.2', 'Kundenvertrauensverlust', 'Loss of Customer Trust', 3, 'reputational', 2, 4, 332),
    -- CAM-4.1: Regulatory
    (${riskCatalogId}, ${l2Map["CAM-4.1"]}, 'CAM-4.1.1', 'NIS2-Nichtkonformitaet', 'NIS2 Non-compliance', 3, 'compliance', 3, 4, 411),
    (${riskCatalogId}, ${l2Map["CAM-4.1"]}, 'CAM-4.1.2', 'Bussgeld wegen Regulierungsverstoss', 'Regulatory Fine', 3, 'compliance', 2, 5, 412),
    -- CAM-4.2: Contractual
    (${riskCatalogId}, ${l2Map["CAM-4.2"]}, 'CAM-4.2.1', 'Vertragsverletzung', 'Breach of Contract', 3, 'compliance', 2, 3, 421),
    (${riskCatalogId}, ${l2Map["CAM-4.2"]}, 'CAM-4.2.2', 'Gerichtliche Auseinandersetzung', 'Litigation', 3, 'compliance', 2, 4, 422),
    -- CAM-4.3: Data Privacy
    (${riskCatalogId}, ${l2Map["CAM-4.3"]}, 'CAM-4.3.1', 'DSGVO-Verstoss', 'GDPR Violation', 3, 'compliance', 3, 5, 431),
    (${riskCatalogId}, ${l2Map["CAM-4.3"]}, 'CAM-4.3.2', 'Unzulaessige Datenverarbeitung', 'Unauthorized Data Processing', 3, 'compliance', 3, 4, 432),
    -- CAM-5.1: Climate
    (${riskCatalogId}, ${l2Map["CAM-5.1"]}, 'CAM-5.1.1', 'Extremwetterereignis', 'Extreme Weather Event', 3, 'esg', 3, 4, 511),
    (${riskCatalogId}, ${l2Map["CAM-5.1"]}, 'CAM-5.1.2', 'CO2-Regulierung', 'Carbon Regulation', 3, 'esg', 4, 3, 512),
    -- CAM-5.2: Social
    (${riskCatalogId}, ${l2Map["CAM-5.2"]}, 'CAM-5.2.1', 'Menschenrechtsverletzung in Lieferkette', 'Human Rights Violation in Supply Chain', 3, 'esg', 2, 5, 521),
    (${riskCatalogId}, ${l2Map["CAM-5.2"]}, 'CAM-5.2.2', 'Arbeitsschutzverstoesse', 'Occupational Safety Violations', 3, 'esg', 3, 3, 522),
    -- CAM-5.3: Sustainability Governance
    (${riskCatalogId}, ${l2Map["CAM-5.3"]}, 'CAM-5.3.1', 'Greenwashing-Vorwurf', 'Greenwashing Allegation', 3, 'esg', 2, 4, 531),
    (${riskCatalogId}, ${l2Map["CAM-5.3"]}, 'CAM-5.3.2', 'CSRD-Berichtspflichtverletzung', 'CSRD Reporting Non-compliance', 3, 'esg', 3, 4, 532)
    ON CONFLICT DO NOTHING
  `);

  // Update entry count
  const riskEntryCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM risk_catalog_entry WHERE catalog_id = ${riskCatalogId}
  `);
  await db.execute(sql`
    UPDATE risk_catalog SET entry_count = ${Number(riskEntryCount[0].cnt)} WHERE id = ${riskCatalogId}
  `);

  console.log(
    `  Cambridge v2 risk catalog: ${riskEntryCount[0].cnt} entries (5 L1, 15 L2, 30 L3)`,
  );

  // ══════════════════════════════════════════════════════════════
  // B) ISO 27002:2022 Control Catalog
  // ══════════════════════════════════════════════════════════════

  const existingControlCatalog = await db.execute(
    sql`SELECT id FROM control_catalog WHERE source = 'iso27002_2022' LIMIT 1`,
  );

  let controlCatalogId: string;

  if (existingControlCatalog.length > 0) {
    controlCatalogId = existingControlCatalog[0].id as string;
    console.log(
      "  ISO 27002:2022 control catalog already exists, skipping catalog insert.",
    );
  } else {
    const inserted = await db.execute(sql`
      INSERT INTO control_catalog (name, description, version, source, language, entry_count, is_system, is_active)
      VALUES (
        'ISO/IEC 27002:2022',
        'Informationssicherheitsmassnahmen gemaess ISO/IEC 27002:2022 mit 4 Themengruppen und 93 Massnahmen',
        '2022',
        'iso27002_2022',
        'de',
        24,
        true,
        true
      )
      RETURNING id
    `);
    controlCatalogId = inserted[0].id as string;
    console.log("  Created ISO 27002:2022 control catalog.");
  }

  // Level 1 — Themes (4)
  await db.execute(sql`
    INSERT INTO control_catalog_entry (catalog_id, code, title_de, title_en, description_de, description_en, level, sort_order)
    VALUES
    (${controlCatalogId}, 'A.5', 'Organisatorische Massnahmen', 'Organizational Controls', 'Massnahmen zur Steuerung der Informationssicherheit auf Organisationsebene', 'Controls for managing information security at organizational level', 1, 100),
    (${controlCatalogId}, 'A.6', 'Personenbezogene Massnahmen', 'People Controls', 'Massnahmen zum Schutz von Informationen durch Personalmassnahmen', 'Controls for protecting information through people measures', 1, 200),
    (${controlCatalogId}, 'A.7', 'Physische Massnahmen', 'Physical Controls', 'Massnahmen zum physischen Schutz von Informationsverarbeitungseinrichtungen', 'Controls for physical protection of information processing facilities', 1, 300),
    (${controlCatalogId}, 'A.8', 'Technologische Massnahmen', 'Technological Controls', 'Massnahmen zum technischen Schutz von Informationssystemen', 'Controls for technical protection of information systems', 1, 400)
    ON CONFLICT DO NOTHING
  `);

  // Get Level 1 IDs
  const ctrlL1 = await db.execute(sql`
    SELECT id, code FROM control_catalog_entry WHERE catalog_id = ${controlCatalogId} AND level = 1 ORDER BY sort_order
  `);
  const cl1Map = Object.fromEntries(ctrlL1.map((e: any) => [e.code, e.id]));

  // Level 2 — Individual Controls (~20)
  await db.execute(sql`
    INSERT INTO control_catalog_entry (catalog_id, parent_entry_id, code, title_de, title_en, description_de, description_en, level, control_type_cat, default_frequency, sort_order)
    VALUES
    -- A.5: Organizational Controls
    (${controlCatalogId}, ${cl1Map["A.5"]}, 'A.5.1', 'Informationssicherheitsrichtlinien', 'Policies for Information Security', 'Richtlinien fuer die Informationssicherheit muessen definiert, genehmigt und kommuniziert werden', 'Policies for information security shall be defined, approved and communicated', 2, 'preventive', 'monthly', 101),
    (${controlCatalogId}, ${cl1Map["A.5"]}, 'A.5.2', 'Rollen und Verantwortlichkeiten', 'Information Security Roles', 'Rollen und Verantwortlichkeiten fuer die Informationssicherheit muessen definiert und zugewiesen werden', 'Information security roles and responsibilities shall be defined and allocated', 2, 'preventive', 'quarterly', 102),
    (${controlCatalogId}, ${cl1Map["A.5"]}, 'A.5.3', 'Aufgabentrennung', 'Segregation of Duties', 'Widerspruechliche Aufgaben und Verantwortlichkeiten muessen getrennt werden', 'Conflicting duties and responsibilities shall be segregated', 2, 'preventive', 'quarterly', 103),
    (${controlCatalogId}, ${cl1Map["A.5"]}, 'A.5.4', 'Verantwortung der Leitung', 'Management Responsibilities', 'Die Leitung muss sicherstellen, dass Informationssicherheitsrichtlinien eingehalten werden', 'Management shall ensure information security policies are followed', 2, 'preventive', 'quarterly', 104),
    (${controlCatalogId}, ${cl1Map["A.5"]}, 'A.5.5', 'Kontakt mit Behoerden', 'Contact with Authorities', 'Kontakte zu relevanten Behoerden muessen gepflegt werden', 'Contact with relevant authorities shall be maintained', 2, 'preventive', 'annually', 105),
    -- A.6: People Controls
    (${controlCatalogId}, ${cl1Map["A.6"]}, 'A.6.1', 'Sicherheitsueberpruefung', 'Screening', 'Hintergrundpruefungen aller Kandidaten vor Einstellung', 'Background checks on all candidates before hiring', 2, 'preventive', 'event_driven', 201),
    (${controlCatalogId}, ${cl1Map["A.6"]}, 'A.6.2', 'Arbeitsvertragsbedingungen', 'Terms and Conditions of Employment', 'Arbeitsvertraege muessen Informationssicherheitspflichten enthalten', 'Employment contracts shall include information security obligations', 2, 'preventive', 'event_driven', 202),
    (${controlCatalogId}, ${cl1Map["A.6"]}, 'A.6.3', 'Sensibilisierung und Schulung', 'Information Security Awareness and Training', 'Regelmaessige Schulungen zur Informationssicherheit', 'Regular information security awareness and training', 2, 'preventive', 'quarterly', 203),
    (${controlCatalogId}, ${cl1Map["A.6"]}, 'A.6.4', 'Disziplinarverfahren', 'Disciplinary Process', 'Formales Disziplinarverfahren bei Sicherheitsverstoessen', 'Formal disciplinary process for security violations', 2, 'corrective', 'event_driven', 204),
    (${controlCatalogId}, ${cl1Map["A.6"]}, 'A.6.5', 'Verantwortlichkeiten bei Beendigung', 'Responsibilities After Termination', 'Sicherheitsverantwortlichkeiten nach Beendigung des Arbeitsverhaeltnisses', 'Security responsibilities after termination of employment', 2, 'preventive', 'event_driven', 205),
    -- A.7: Physical Controls
    (${controlCatalogId}, ${cl1Map["A.7"]}, 'A.7.1', 'Physische Sicherheitsperimeter', 'Physical Security Perimeters', 'Definition und Nutzung von Sicherheitsperimetern zum Schutz von Bereichen', 'Security perimeters shall be defined and used to protect areas', 2, 'preventive', 'monthly', 301),
    (${controlCatalogId}, ${cl1Map["A.7"]}, 'A.7.2', 'Physische Zutrittskontrollen', 'Physical Entry Controls', 'Sichere Bereiche muessen durch angemessene Zugangskontrollen geschuetzt werden', 'Secure areas shall be protected by appropriate entry controls', 2, 'preventive', 'continuous', 302),
    (${controlCatalogId}, ${cl1Map["A.7"]}, 'A.7.3', 'Sicherung von Bueros und Raeumen', 'Securing Offices, Rooms and Facilities', 'Physische Sicherheit fuer Bueros, Raeume und Einrichtungen', 'Physical security for offices, rooms and facilities', 2, 'preventive', 'quarterly', 303),
    (${controlCatalogId}, ${cl1Map["A.7"]}, 'A.7.4', 'Physische Sicherheitsueberwachung', 'Physical Security Monitoring', 'Ueberwachung des physischen Zugangs zu sensiblen Bereichen', 'Monitoring physical access to sensitive areas', 2, 'detective', 'continuous', 304),
    (${controlCatalogId}, ${cl1Map["A.7"]}, 'A.7.5', 'Schutz vor Umweltbedrohungen', 'Protecting Against Environmental Threats', 'Schutz gegen natuerliche Katastrophen und Umweltbedrohungen', 'Protection against natural disasters and environmental threats', 2, 'preventive', 'annually', 305),
    -- A.8: Technological Controls
    (${controlCatalogId}, ${cl1Map["A.8"]}, 'A.8.1', 'Endgeraetesicherheit', 'User Endpoint Devices', 'Informationen auf Endgeraeten muessen geschuetzt werden', 'Information stored on user endpoint devices shall be protected', 2, 'preventive', 'monthly', 401),
    (${controlCatalogId}, ${cl1Map["A.8"]}, 'A.8.2', 'Privilegierte Zugriffsrechte', 'Privileged Access Rights', 'Zuweisung und Nutzung privilegierter Zugriffsrechte einschraenken und steuern', 'Restrict and control allocation and use of privileged access rights', 2, 'preventive', 'quarterly', 402),
    (${controlCatalogId}, ${cl1Map["A.8"]}, 'A.8.3', 'Informationszugangsbeschraenkung', 'Information Access Restriction', 'Zugang zu Informationen und Funktionen muss eingeschraenkt werden', 'Access to information and functions shall be restricted', 2, 'preventive', 'monthly', 403),
    (${controlCatalogId}, ${cl1Map["A.8"]}, 'A.8.4', 'Zugriff auf Quellcode', 'Access to Source Code', 'Lese- und Schreibzugriff auf Quellcode muss angemessen gesteuert werden', 'Read and write access to source code shall be appropriately managed', 2, 'preventive', 'quarterly', 404),
    (${controlCatalogId}, ${cl1Map["A.8"]}, 'A.8.5', 'Sichere Authentifizierung', 'Secure Authentication', 'Sichere Authentifizierungsverfahren muessen implementiert werden', 'Secure authentication technologies and procedures shall be implemented', 2, 'preventive', 'continuous', 405)
    ON CONFLICT DO NOTHING
  `);

  // Update entry count
  const ctrlEntryCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM control_catalog_entry WHERE catalog_id = ${controlCatalogId}
  `);
  await db.execute(sql`
    UPDATE control_catalog SET entry_count = ${Number(ctrlEntryCount[0].cnt)} WHERE id = ${controlCatalogId}
  `);

  console.log(
    `  ISO 27002:2022 control catalog: ${ctrlEntryCount[0].cnt} entries (4 L1, 20 L2)`,
  );

  // ══════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════

  console.log("\nSprint 4b catalog seed complete:");
  console.log("  - 1 risk catalog (Cambridge Taxonomy v2.0): 50 entries");
  console.log("  - 1 control catalog (ISO 27002:2022): 24 entries");

  await client.end();
}

seed().catch((err) => {
  console.error("Catalog seed failed:", err);
  process.exit(1);
});
