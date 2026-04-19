-- ============================================================================
-- ARCTOS Seed: ISO/IEC 42001:2023 — AI Management System
-- Source: ISO/IEC 42001:2023 (Artificial intelligence — Management system)
--
-- Structure:
--   Clauses 4–10 = AIMS management-system requirements (mirrors ISO 27001 HLS)
--   Annex A      = AI-specific controls (38 controls across 9 categories)
--   Annex B      = Implementation guidance (not seeded here)
--   Annex C      = AI-related concerns mapped to controls
--
-- Target modules: isms (AI governance), dpms (PII in AI training)
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-420010000001',
  'ISO/IEC 42001:2023 AI Management System',
  'AI management system requirements and Annex A controls. Companion management system to ISO 27001 for organizations that develop, provide or use AI systems. 38 controls across 9 categories.',
  'control', 'platform', 'iso_42001_2023', '2023', 'en', true, '{isms,dpms}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, name_de, description, description_de, level, sort_order, status) VALUES
-- ── Clauses 4–10 (HLS — High-Level Structure) ──────────────────────────────
('c0000000-0000-0000-0000-420010000001', '4', 'Context of the organization', 'Kontext der Organisation', 'Determine internal and external issues, interested parties and AIMS scope', 'Interne und externe Themen, interessierte Parteien und AIMS-Geltungsbereich bestimmen', 0, 100, 'active'),
('c0000000-0000-0000-0000-420010000001', '4.1', 'Understanding the organization and its context', 'Organisation und Kontext verstehen', 'Determine relevant external and internal issues for AI', 'Relevante externe und interne Themen für KI bestimmen', 1, 110, 'active'),
('c0000000-0000-0000-0000-420010000001', '4.2', 'Understanding the needs and expectations of interested parties', 'Bedürfnisse interessierter Parteien verstehen', 'Identify interested parties relevant to AI activities', 'Für KI-Aktivitäten relevante interessierte Parteien identifizieren', 1, 120, 'active'),
('c0000000-0000-0000-0000-420010000001', '4.3', 'Determining the scope of the AIMS', 'AIMS-Geltungsbereich festlegen', 'Define the boundaries and applicability of the AIMS', 'Grenzen und Anwendbarkeit des AIMS festlegen', 1, 130, 'active'),
('c0000000-0000-0000-0000-420010000001', '4.4', 'AIMS', 'AI-Managementsystem', 'Establish, implement, maintain and continually improve the AIMS', 'AIMS etablieren, implementieren, aufrechterhalten und kontinuierlich verbessern', 1, 140, 'active'),

('c0000000-0000-0000-0000-420010000001', '5', 'Leadership', 'Führung', 'Top-management commitment, AI policy and roles', 'Top-Management-Verpflichtung, KI-Richtlinie und Rollen', 0, 200, 'active'),
('c0000000-0000-0000-0000-420010000001', '5.1', 'Leadership and commitment', 'Führung und Verpflichtung', 'Top management shall demonstrate leadership and commitment to the AIMS', 'Das Top-Management muss Führung und Verpflichtung gegenüber dem AIMS zeigen', 1, 210, 'active'),
('c0000000-0000-0000-0000-420010000001', '5.2', 'AI policy', 'KI-Richtlinie', 'Establish a documented AI policy aligned with strategy and values', 'Eine dokumentierte KI-Richtlinie im Einklang mit Strategie und Werten etablieren', 1, 220, 'active'),
('c0000000-0000-0000-0000-420010000001', '5.3', 'Roles, responsibilities and authorities', 'Rollen, Verantwortlichkeiten und Befugnisse', 'Assign and communicate AIMS-relevant roles', 'AIMS-relevante Rollen zuweisen und kommunizieren', 1, 230, 'active'),

('c0000000-0000-0000-0000-420010000001', '6', 'Planning', 'Planung', 'Risk and opportunity actions, AI objectives, change planning', 'Maßnahmen für Risiken und Chancen, KI-Ziele, Änderungsplanung', 0, 300, 'active'),
('c0000000-0000-0000-0000-420010000001', '6.1', 'Actions to address risks and opportunities', 'Maßnahmen zu Risiken und Chancen', 'AI risk assessment and risk treatment', 'KI-Risikobewertung und -behandlung', 1, 310, 'active'),
('c0000000-0000-0000-0000-420010000001', '6.1.2', 'AI risk assessment', 'KI-Risikobewertung', 'Define and apply an AI risk-assessment process', 'KI-Risikobewertungs-Prozess definieren und anwenden', 2, 311, 'active'),
('c0000000-0000-0000-0000-420010000001', '6.1.3', 'AI risk treatment', 'KI-Risikobehandlung', 'Define and apply an AI risk-treatment process; produce a Statement of Applicability', 'KI-Risikobehandlungs-Prozess definieren; Statement of Applicability erstellen', 2, 312, 'active'),
('c0000000-0000-0000-0000-420010000001', '6.1.4', 'AI system impact assessment', 'KI-System-Auswirkungsbewertung', 'Assess potential consequences of AI systems on individuals, groups and societies', 'Mögliche Folgen von KI-Systemen für Einzelpersonen, Gruppen und die Gesellschaft bewerten', 2, 313, 'active'),
('c0000000-0000-0000-0000-420010000001', '6.2', 'AI objectives and planning', 'KI-Ziele und Planung', 'Establish AI objectives at relevant functions/levels', 'KI-Ziele auf relevanten Funktionen/Ebenen festlegen', 1, 320, 'active'),

('c0000000-0000-0000-0000-420010000001', '7', 'Support', 'Unterstützung', 'Resources, competence, awareness, communication, documented information', 'Ressourcen, Kompetenz, Bewusstsein, Kommunikation, dokumentierte Information', 0, 400, 'active'),
('c0000000-0000-0000-0000-420010000001', '7.2', 'Competence', 'Kompetenz', 'Determine and ensure competence of personnel for AI work', 'Kompetenz des Personals für KI-Arbeit bestimmen und sicherstellen', 1, 410, 'active'),
('c0000000-0000-0000-0000-420010000001', '7.3', 'Awareness', 'Bewusstsein', 'Persons doing work shall be aware of the AI policy and their contribution', 'Personen müssen sich der KI-Richtlinie und ihres Beitrags bewusst sein', 1, 420, 'active'),

('c0000000-0000-0000-0000-420010000001', '8', 'Operation', 'Betrieb', 'AI lifecycle operation, planning, control', 'KI-Lebenszyklusbetrieb, Planung, Steuerung', 0, 500, 'active'),
('c0000000-0000-0000-0000-420010000001', '8.1', 'Operational planning and control', 'Betriebliche Planung und Steuerung', 'Plan, implement and control the processes needed', 'Notwendige Prozesse planen, implementieren und steuern', 1, 510, 'active'),
('c0000000-0000-0000-0000-420010000001', '8.2', 'AI risk assessment (operational)', 'KI-Risikobewertung (operativ)', 'Perform AI risk assessments at planned intervals and upon significant change', 'KI-Risikobewertungen in geplanten Intervallen und bei wesentlichen Änderungen durchführen', 1, 520, 'active'),
('c0000000-0000-0000-0000-420010000001', '8.3', 'AI risk treatment (operational)', 'KI-Risikobehandlung (operativ)', 'Implement the AI risk-treatment plan', 'KI-Risikobehandlungs-Plan umsetzen', 1, 530, 'active'),
('c0000000-0000-0000-0000-420010000001', '8.4', 'AI system impact assessment (operational)', 'KI-System-Auswirkungsbewertung (operativ)', 'Implement the AI system impact assessment process', 'KI-System-Auswirkungsbewertungs-Prozess umsetzen', 1, 540, 'active'),

('c0000000-0000-0000-0000-420010000001', '9', 'Performance evaluation', 'Bewertung der Leistung', 'Monitoring, internal audit, management review', 'Überwachung, interne Audits, Managementbewertung', 0, 600, 'active'),
('c0000000-0000-0000-0000-420010000001', '9.1', 'Monitoring, measurement, analysis and evaluation', 'Überwachung, Messung, Analyse, Bewertung', 'Determine what to monitor, methods and intervals', 'Festlegen was wann mit welchen Methoden überwacht wird', 1, 610, 'active'),
('c0000000-0000-0000-0000-420010000001', '9.2', 'Internal audit', 'Internes Audit', 'Conduct internal audits at planned intervals', 'Interne Audits in geplanten Intervallen durchführen', 1, 620, 'active'),
('c0000000-0000-0000-0000-420010000001', '9.3', 'Management review', 'Managementbewertung', 'Top management shall review the AIMS at planned intervals', 'Das Top-Management muss das AIMS in geplanten Intervallen bewerten', 1, 630, 'active'),

('c0000000-0000-0000-0000-420010000001', '10', 'Improvement', 'Verbesserung', 'Continual improvement, nonconformity and corrective action', 'Kontinuierliche Verbesserung, Nichtkonformität und Korrekturmaßnahmen', 0, 700, 'active'),
('c0000000-0000-0000-0000-420010000001', '10.1', 'Continual improvement', 'Kontinuierliche Verbesserung', 'Continually improve the suitability, adequacy and effectiveness of the AIMS', 'Eignung, Angemessenheit und Wirksamkeit des AIMS kontinuierlich verbessern', 1, 710, 'active'),
('c0000000-0000-0000-0000-420010000001', '10.2', 'Nonconformity and corrective action', 'Nichtkonformität und Korrekturmaßnahme', 'React to nonconformities and take corrective action', 'Auf Nichtkonformitäten reagieren und Korrekturmaßnahmen ergreifen', 1, 720, 'active'),

-- ── Annex A: AI-specific Controls (38 controls / 9 categories) ─────────────
('c0000000-0000-0000-0000-420010000001', 'A.2', 'A.2 Policies related to AI', 'A.2 KI-bezogene Richtlinien', 'AI-related policy management', 'Verwaltung KI-bezogener Richtlinien', 0, 1000, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.2.2', 'AI policy', 'KI-Richtlinie', 'The AI policy shall be reviewed at planned intervals or when significant changes occur', 'Die KI-Richtlinie muss in geplanten Intervallen oder bei wesentlichen Änderungen überprüft werden', 1, 1010, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.2.3', 'Alignment with other policies', 'Abstimmung mit anderen Richtlinien', 'AI policy shall be aligned with other organizational policies', 'Die KI-Richtlinie muss mit anderen Organisationsrichtlinien abgestimmt sein', 1, 1020, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.2.4', 'Review of the AI policy', 'Überprüfung der KI-Richtlinie', 'Review the AI policy at planned intervals', 'KI-Richtlinie in geplanten Intervallen überprüfen', 1, 1030, 'active'),

('c0000000-0000-0000-0000-420010000001', 'A.3', 'A.3 Internal organization', 'A.3 Interne Organisation', 'Roles and accountability for AI', 'Rollen und Verantwortlichkeit für KI', 0, 1100, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.3.2', 'AI roles and responsibilities', 'KI-Rollen und -Verantwortlichkeiten', 'Assign AI-related roles and responsibilities', 'KI-bezogene Rollen und Verantwortlichkeiten zuweisen', 1, 1110, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.3.3', 'Reporting of concerns', 'Meldung von Bedenken', 'Establish a process to report AI-related concerns', 'Prozess zur Meldung KI-bezogener Bedenken etablieren', 1, 1120, 'active'),

('c0000000-0000-0000-0000-420010000001', 'A.4', 'A.4 Resources for AI systems', 'A.4 Ressourcen für KI-Systeme', 'Documentation of resources for AI systems', 'Dokumentation der Ressourcen für KI-Systeme', 0, 1200, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.4.2', 'Resource documentation', 'Ressourcendokumentation', 'Document resources used by AI systems (data, tooling, compute, human resources)', 'Von KI-Systemen genutzte Ressourcen dokumentieren (Daten, Tools, Rechenleistung, Personal)', 1, 1210, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.4.3', 'Data resources', 'Datenressourcen', 'Document data resources (training, validation, test, operational)', 'Datenressourcen dokumentieren (Training, Validierung, Test, Betrieb)', 1, 1220, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.4.4', 'Tooling resources', 'Tooling-Ressourcen', 'Document tooling used in AI lifecycle', 'Im KI-Lebenszyklus genutzte Tools dokumentieren', 1, 1230, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.4.5', 'System and computing resources', 'System- und Rechenressourcen', 'Document computing resources used by AI systems', 'Von KI-Systemen genutzte Rechenressourcen dokumentieren', 1, 1240, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.4.6', 'Human resources', 'Humanressourcen', 'Identify and document human resources needed across the AI lifecycle', 'Über den KI-Lebenszyklus benötigte Humanressourcen identifizieren und dokumentieren', 1, 1250, 'active'),

('c0000000-0000-0000-0000-420010000001', 'A.5', 'A.5 Assessing impacts of AI systems', 'A.5 Bewertung der Auswirkungen von KI-Systemen', 'AI impact assessment process', 'KI-Auswirkungsbewertungs-Prozess', 0, 1300, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.5.2', 'AI system impact assessment process', 'KI-System-Auswirkungsbewertungs-Prozess', 'Define a process for AI system impact assessments', 'Prozess für KI-System-Auswirkungsbewertungen definieren', 1, 1310, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.5.3', 'Documentation of AI system impact assessments', 'Dokumentation der KI-System-Auswirkungsbewertungen', 'Document the results of AI system impact assessments', 'Ergebnisse der KI-System-Auswirkungsbewertungen dokumentieren', 1, 1320, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.5.4', 'Assessing AI system impact on individuals', 'Bewertung der Auswirkungen auf Einzelpersonen', 'Assess AI system impact on individuals', 'KI-System-Auswirkungen auf Einzelpersonen bewerten', 1, 1330, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.5.5', 'Assessing societal impact', 'Bewertung der gesellschaftlichen Auswirkungen', 'Assess AI system impact on societies', 'KI-System-Auswirkungen auf die Gesellschaft bewerten', 1, 1340, 'active'),

('c0000000-0000-0000-0000-420010000001', 'A.6', 'A.6 AI system life cycle', 'A.6 KI-System-Lebenszyklus', 'AI system development and deployment lifecycle', 'KI-System-Entwicklungs- und Bereitstellungs-Lebenszyklus', 0, 1400, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.6.1.2', 'Objectives for responsible development', 'Ziele für verantwortungsvolle Entwicklung', 'Define objectives for responsible development of AI systems', 'Ziele für die verantwortungsvolle Entwicklung von KI-Systemen festlegen', 1, 1410, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.6.1.3', 'Processes for responsible design and development', 'Prozesse für verantwortungsvollen Entwurf und Entwicklung', 'Define processes for responsible AI design and development', 'Prozesse für verantwortungsvollen KI-Entwurf und -Entwicklung definieren', 1, 1420, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.6.2.2', 'AI system requirements specification', 'KI-System-Anforderungsspezifikation', 'Specify and document AI system requirements', 'KI-System-Anforderungen spezifizieren und dokumentieren', 1, 1430, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.6.2.3', 'Documentation of AI system design and development', 'Dokumentation Entwurf und Entwicklung', 'Document AI system design and development', 'KI-System-Entwurf und -Entwicklung dokumentieren', 1, 1440, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.6.2.4', 'AI system verification and validation', 'KI-System-Verifikation und -Validierung', 'Define and apply verification and validation measures', 'Verifikations- und Validierungsmaßnahmen definieren und anwenden', 1, 1450, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.6.2.5', 'AI system deployment', 'KI-System-Bereitstellung', 'Document AI system deployment', 'KI-System-Bereitstellung dokumentieren', 1, 1460, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.6.2.6', 'AI system operation and monitoring', 'KI-System-Betrieb und -Überwachung', 'Define operation and monitoring requirements for AI systems', 'Betriebs- und Überwachungs-Anforderungen für KI-Systeme definieren', 1, 1470, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.6.2.7', 'AI system technical documentation', 'KI-System technische Dokumentation', 'Maintain technical documentation throughout the AI system lifecycle', 'Technische Dokumentation über den KI-System-Lebenszyklus pflegen', 1, 1480, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.6.2.8', 'AI system event logging', 'KI-System-Ereignisprotokollierung', 'Define and apply AI system event logging', 'KI-System-Ereignisprotokollierung definieren und anwenden', 1, 1490, 'active'),

('c0000000-0000-0000-0000-420010000001', 'A.7', 'A.7 Data for AI systems', 'A.7 Daten für KI-Systeme', 'Data quality, provenance and preparation', 'Datenqualität, -herkunft und -aufbereitung', 0, 1500, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.7.2', 'Data for development and enhancement of AI systems', 'Daten für Entwicklung und Verbesserung', 'Define a process for data used in AI systems', 'Prozess für in KI-Systemen verwendete Daten definieren', 1, 1510, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.7.3', 'Acquisition of data', 'Datenerfassung', 'Determine and document the data acquisition process', 'Datenerfassungs-Prozess festlegen und dokumentieren', 1, 1520, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.7.4', 'Quality of data for AI systems', 'Datenqualität für KI-Systeme', 'Define quality requirements for data used in AI systems', 'Qualitätsanforderungen für in KI-Systemen verwendete Daten festlegen', 1, 1530, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.7.5', 'Data provenance', 'Datenherkunft', 'Document data provenance for AI systems', 'Datenherkunft für KI-Systeme dokumentieren', 1, 1540, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.7.6', 'Data preparation', 'Datenaufbereitung', 'Document data preparation methods for AI systems', 'Methoden der Datenaufbereitung für KI-Systeme dokumentieren', 1, 1550, 'active'),

('c0000000-0000-0000-0000-420010000001', 'A.8', 'A.8 Information for interested parties of AI systems', 'A.8 Informationen für interessierte Parteien', 'Transparency to users and other stakeholders', 'Transparenz für Nutzer und andere Stakeholder', 0, 1600, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.8.2', 'System documentation and information for users', 'Systemdokumentation und Informationen für Nutzer', 'Provide documentation and information for users of AI systems', 'Dokumentation und Informationen für KI-System-Nutzer bereitstellen', 1, 1610, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.8.3', 'External reporting', 'Externe Berichterstattung', 'Establish external reporting mechanisms for AI-related concerns', 'Externe Meldemechanismen für KI-bezogene Bedenken etablieren', 1, 1620, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.8.4', 'Communication of incidents', 'Kommunikation von Vorfällen', 'Communicate AI-related incidents to relevant interested parties', 'KI-bezogene Vorfälle an relevante interessierte Parteien kommunizieren', 1, 1630, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.8.5', 'Information for interested parties', 'Informationen für interessierte Parteien', 'Provide information to other interested parties about AI systems', 'Anderen interessierten Parteien Informationen über KI-Systeme bereitstellen', 1, 1640, 'active'),

('c0000000-0000-0000-0000-420010000001', 'A.9', 'A.9 Use of AI systems', 'A.9 Nutzung von KI-Systemen', 'Responsible use of AI systems by the organization', 'Verantwortungsvolle Nutzung von KI-Systemen durch die Organisation', 0, 1700, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.9.2', 'Processes for responsible use of AI systems', 'Prozesse für verantwortungsvolle Nutzung', 'Define processes for the responsible use of AI systems', 'Prozesse für die verantwortungsvolle Nutzung von KI-Systemen definieren', 1, 1710, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.9.3', 'Objectives for responsible use of AI systems', 'Ziele für verantwortungsvolle Nutzung', 'Define objectives for the responsible use of AI systems', 'Ziele für die verantwortungsvolle Nutzung von KI-Systemen festlegen', 1, 1720, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.9.4', 'Intended use of the AI system', 'Beabsichtigter Nutzungszweck', 'Define and document the intended use of AI systems', 'Beabsichtigten Nutzungszweck von KI-Systemen festlegen und dokumentieren', 1, 1730, 'active'),

('c0000000-0000-0000-0000-420010000001', 'A.10', 'A.10 Third-party and customer relationships', 'A.10 Drittanbieter- und Kundenbeziehungen', 'AI supply-chain and customer responsibilities', 'KI-Lieferketten- und Kundenverantwortlichkeiten', 0, 1800, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.10.2', 'Allocation of responsibilities', 'Zuweisung von Verantwortlichkeiten', 'Allocate responsibilities between organization and third parties', 'Verantwortlichkeiten zwischen Organisation und Dritten zuweisen', 1, 1810, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.10.3', 'Suppliers', 'Lieferanten', 'Define controls for suppliers in AI lifecycle', 'Maßnahmen für Lieferanten im KI-Lebenszyklus festlegen', 1, 1820, 'active'),
('c0000000-0000-0000-0000-420010000001', 'A.10.4', 'Customers', 'Kunden', 'Define controls for customer interactions related to AI', 'Maßnahmen für KI-bezogene Kundeninteraktionen festlegen', 1, 1830, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Done. ~50 ISO 42001 entries (clauses + Annex A)
