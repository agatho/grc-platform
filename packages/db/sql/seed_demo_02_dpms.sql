-- =============================================================================
-- ARCTOS Demo Data Seed — DPMS (Data Protection Management System)
-- RoPA entries, Data categories/subjects/recipients, DPIAs, DSRs, Data breaches
-- =============================================================================
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING
-- Deterministic UUIDs: d0000000-0000-0000-0000-0000000005XX pattern
-- Depends on: seed_demo_data.sql (budgets, org, admin user)
-- =============================================================================

-- No BEGIN/COMMIT — each INSERT runs independently to avoid transaction abort on trigger errors

-- ─────────────────────────────────────────────────────────────────────────────
-- Session config for audit triggers
-- ─────────────────────────────────────────────────────────────────────────────

SELECT set_config('app.current_org_id', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', true);
SELECT set_config('app.current_user_id', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', true);
SELECT set_config('app.current_user_email', 'admin@arctos.dev', true);
SELECT set_config('app.current_user_name', 'Platform Admin', true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RoPA Entries (5 records of processing activities)
-- ─────────────────────────────────────────────────────────────────────────────

-- ROPA-001: HR Mitarbeiterdaten
INSERT INTO ropa_entry (id, org_id, title, purpose, legal_basis, legal_basis_detail,
  processor_name, processing_description, retention_period, retention_justification,
  technical_measures, organizational_measures, international_transfer,
  status, last_reviewed, next_review_date, responsible_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000501',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Personalverwaltung — Mitarbeiterstammdaten',
  'Verwaltung von Arbeitsverhaeltnissen, Gehaltsabrechnung, Sozialversicherungsmeldungen und betriebliche Altersvorsorge gemäß arbeitsrechtlichen Verpflichtungen.',
  'legal_obligation',
  'Art. 6 Abs. 1 lit. b und c DSGVO i.V.m. BDSG, EStG, SGB IV',
  NULL,
  'Erhebung, Speicherung und Verarbeitung von Mitarbeiterstammdaten im HR-System. Umfasst Personalakte, Gehaltsabrechnung, Zeiterfassung und Abwesenheitsmanagement.',
  '10 Jahre nach Austritt',
  'Aufbewahrungspflichten gemäß HGB (6 Jahre) und Steuerrecht (10 Jahre)',
  'Verschlüsselung at-rest (AES-256), TLS 1.3 in-transit, rollenbasierte Zugriffskontrolle',
  'Need-to-know-Prinzip, Vertraulichkeitsvereinbarungen, jährliche Datenschutzschulung',
  false,
  'active',
  '2026-01-15T10:00:00Z',
  '2027-01-15',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ROPA-002: CRM Kundendaten
INSERT INTO ropa_entry (id, org_id, title, purpose, legal_basis, legal_basis_detail,
  processor_name, processing_description, retention_period, retention_justification,
  technical_measures, organizational_measures, international_transfer,
  status, last_reviewed, next_review_date, responsible_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000502',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'CRM — Kundenstammdaten und Kommunikationshistorie',
  'Verwaltung von Kundenbeziehungen, Angebotserstellung, Vertragsmanagement und Kundenkommunikation zur Erfuellung vertraglicher Pflichten.',
  'contract',
  'Art. 6 Abs. 1 lit. b DSGVO — Vertragserfuellung',
  NULL,
  'Erfassung und Pflege von Kundenkontaktdaten, Kaufhistorie, Angeboten und Vertragsunterlagen im CRM-System.',
  '3 Jahre nach letztem Geschäftsvorfall',
  'Verjaehrungsfrist gemäß BGB (3 Jahre), steuerliche Aufbewahrung separater Beleg',
  'Mandantentrennung, Verschlüsselung, API-Zugriff ueber OAuth 2.0',
  'Zugriff nur Vertrieb und Kundenservice, quartalsweise Zugriffsprüfung',
  false,
  'active',
  '2026-02-01T09:00:00Z',
  '2027-02-01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ROPA-003: Website-Analyse
INSERT INTO ropa_entry (id, org_id, title, purpose, legal_basis, legal_basis_detail,
  processor_name, processing_description, retention_period, retention_justification,
  technical_measures, organizational_measures, international_transfer,
  status, last_reviewed, next_review_date, responsible_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000503',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Website-Analyse und Nutzungsstatistiken',
  'Analyse des Nutzerverhaltens auf der Unternehmenswebsite zur Optimierung der Benutzererfahrung und Messung der Marketing-Effektivitaet.',
  'consent',
  'Art. 6 Abs. 1 lit. a DSGVO — Einwilligung ueber Cookie-Banner (TTDSG-konform)',
  'Matomo (Self-hosted)',
  'Erhebung anonymisierter Nutzungsdaten (Seitenaufrufe, Verweildauer, Referrer) ueber Self-hosted Matomo-Instanz. IP-Anonymisierung aktiviert.',
  '26 Monate',
  'Maximale Analyseperiode für Trendvergleiche, danach automatische Loeschung',
  'IP-Anonymisierung, Self-hosted Instanz im eigenen Rechenzentrum, kein Drittland-Transfer',
  'Zugriff nur Marketing-Team, Consent-Management-Plattform implementiert',
  false,
  'active',
  '2026-01-20T14:00:00Z',
  '2027-01-20',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ROPA-004: E-Mail-Marketing
INSERT INTO ropa_entry (id, org_id, title, purpose, legal_basis, legal_basis_detail,
  processor_name, processing_description, retention_period, retention_justification,
  technical_measures, organizational_measures, international_transfer,
  status, last_reviewed, next_review_date, responsible_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000504',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'E-Mail-Marketing und Newsletter-Versand',
  'Versand von Produkt-Newslettern, Veranstaltungseinladungen und Unternehmensnews an Abonnenten mit deren ausdruecklicher Einwilligung.',
  'consent',
  'Art. 6 Abs. 1 lit. a DSGVO i.V.m. UWG § 7 Abs. 2 Nr. 3 — Double-Opt-in',
  NULL,
  'Verwaltung von Newsletter-Abonnements, Segmentierung nach Interessen, Versand personalisierter E-Mails, Tracking von Öffnungs- und Klickraten.',
  'Bis zum Widerruf der Einwilligung',
  'Einwilligung ist widerrufbar; Daten werden nach Abmeldung innerhalb von 30 Tagen gelöscht',
  'Double-Opt-in-Verfahren, verschlüsselter Versand, Abmeldelink in jeder E-Mail',
  'Marketing-Team verantwortlich, monatliche Prüfung der Abmeldeliste',
  false,
  'under_review',
  '2025-12-10T11:00:00Z',
  '2026-06-10',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ROPA-005: Cloud-Gehaltsabrechnung
INSERT INTO ropa_entry (id, org_id, title, purpose, legal_basis, legal_basis_detail,
  processor_name, processing_description, retention_period, retention_justification,
  technical_measures, organizational_measures, international_transfer,
  status, last_reviewed, next_review_date, responsible_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000505',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Cloud-basierte Gehaltsabrechnung',
  'Durchfuehrung der monatlichen Gehaltsabrechnung, Erstellung von Lohnsteuerbescheinigungen und Sozialversicherungsmeldungen ueber externen Payroll-Dienstleister.',
  'legal_obligation',
  'Art. 6 Abs. 1 lit. b und c DSGVO i.V.m. EStG, SGB IV — Arbeitsvertrag und gesetzliche Meldepflichten',
  'DATEV eG',
  'Uebermittlung von Gehaltsdaten an DATEV-Rechenzentrum zur Lohn- und Gehaltsabrechnung. Auftragsverarbeitung gemäß Art. 28 DSGVO.',
  '10 Jahre nach Ende des Beschaeftigungsverhaeltnisses',
  'Steuerrechtliche Aufbewahrungspflicht (10 Jahre) gemäß AO § 147',
  'Ende-zu-Ende-Verschlüsselung, DATEV-Rechenzentrum ISO 27001 zertifiziert',
  'AVV mit DATEV abgeschlossen, Zugriff nur HR-Leitung und Payroll-Team',
  false,
  'active',
  '2026-03-01T08:00:00Z',
  '2027-03-01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RoPA Data Categories (~12 entries)
-- ─────────────────────────────────────────────────────────────────────────────

-- HR (ROPA-001)
INSERT INTO ropa_data_category (id, org_id, ropa_entry_id, category) VALUES
  ('d0000000-0000-0000-0000-000000000510', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000501', 'Name, Vorname, Geburtsdatum'),
  ('d0000000-0000-0000-0000-000000000511', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000501', 'Anschrift und Kontaktdaten'),
  ('d0000000-0000-0000-0000-000000000512', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000501', 'Gehaltsdaten und Bankverbindung'),
  ('d0000000-0000-0000-0000-000000000513', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000501', 'Sozialversicherungsnummer')
ON CONFLICT (id) DO NOTHING;

-- CRM (ROPA-002)
INSERT INTO ropa_data_category (id, org_id, ropa_entry_id, category) VALUES
  ('d0000000-0000-0000-0000-000000000514', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000502', 'Firmenname und Ansprechpartner'),
  ('d0000000-0000-0000-0000-000000000515', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000502', 'E-Mail-Adresse und Telefonnummer'),
  ('d0000000-0000-0000-0000-000000000516', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000502', 'Kaufhistorie und Vertragsdaten')
ON CONFLICT (id) DO NOTHING;

-- Website (ROPA-003)
INSERT INTO ropa_data_category (id, org_id, ropa_entry_id, category) VALUES
  ('d0000000-0000-0000-0000-000000000517', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000503', 'Anonymisierte IP-Adresse'),
  ('d0000000-0000-0000-0000-000000000518', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000503', 'Seitenaufrufe und Verweildauer')
ON CONFLICT (id) DO NOTHING;

-- E-Mail-Marketing (ROPA-004)
INSERT INTO ropa_data_category (id, org_id, ropa_entry_id, category) VALUES
  ('d0000000-0000-0000-0000-000000000519', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000504', 'E-Mail-Adresse'),
  ('d0000000-0000-0000-0000-00000000051a', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000504', 'Öffnungs- und Klickverhalten')
ON CONFLICT (id) DO NOTHING;

-- Payroll (ROPA-005)
INSERT INTO ropa_data_category (id, org_id, ropa_entry_id, category) VALUES
  ('d0000000-0000-0000-0000-00000000051b', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000505', 'Lohnsteuerdaten und Steuerklasse')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RoPA Data Subjects (~8 entries)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ropa_data_subject (id, org_id, ropa_entry_id, subject_category) VALUES
  ('d0000000-0000-0000-0000-000000000520', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000501', 'Mitarbeiter'),
  ('d0000000-0000-0000-0000-000000000521', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000501', 'Bewerber'),
  ('d0000000-0000-0000-0000-000000000522', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000502', 'Kunden (Ansprechpartner)'),
  ('d0000000-0000-0000-0000-000000000523', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000502', 'Interessenten'),
  ('d0000000-0000-0000-0000-000000000524', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000503', 'Website-Besucher'),
  ('d0000000-0000-0000-0000-000000000525', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000504', 'Newsletter-Abonnenten'),
  ('d0000000-0000-0000-0000-000000000526', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000505', 'Mitarbeiter (Gehaltsempfaenger)'),
  ('d0000000-0000-0000-0000-000000000527', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000505', 'Ehemalige Mitarbeiter')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RoPA Recipients (~7 entries)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ropa_recipient (id, org_id, ropa_entry_id, recipient_name, recipient_type) VALUES
  ('d0000000-0000-0000-0000-000000000530', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000501', 'Finanzamt', 'behoerde'),
  ('d0000000-0000-0000-0000-000000000531', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000501', 'Sozialversicherungstraeger', 'behoerde'),
  ('d0000000-0000-0000-0000-000000000532', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000501', 'Betriebliche Altersvorsorge — Versicherer', 'auftragsverarbeiter'),
  ('d0000000-0000-0000-0000-000000000533', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000502', 'Internes Vertriebsteam', 'intern'),
  ('d0000000-0000-0000-0000-000000000534', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000504', 'E-Mail-Versanddienstleister', 'auftragsverarbeiter'),
  ('d0000000-0000-0000-0000-000000000535', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000505', 'DATEV eG — Lohnabrechnung', 'auftragsverarbeiter'),
  ('d0000000-0000-0000-0000-000000000536', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000505', 'Hausbank — Gehaltsueberweisungen', 'empfaenger')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. DPIAs (2 Data Protection Impact Assessments)
-- ─────────────────────────────────────────────────────────────────────────────

-- DPIA-001: Mitarbeiterüberwachung (completed)
INSERT INTO dpia (id, org_id, title, processing_description, legal_basis,
  necessity_assessment, dpo_consultation_required, status,
  residual_risk_sign_off_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000540',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'DSFA — Mitarbeiterüberwachung und Leistungsmessung',
  'Einfuehrung eines Systems zur Zeiterfassung und Leistungsmessung am Arbeitsplatz. Umfasst Login-Zeiten, Applikationsnutzung und Projektzeitzuordnung. Keine Videoueberachung oder Tastaturprotokollierung.',
  'legitimate_interest',
  'Die Verarbeitung ist notwendig zur Erfuellung arbeitsrechtlicher Pflichten (Arbeitszeitgesetz) und zur berechtigten Leistungsbewertung. Weniger eingriffsintensive Alternativen (manuelle Stechkarte) wurden geprüft und als nicht praktikabel verworfen.',
  true,
  'completed',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- DPIA-002: KI-gestuetzte Analyse (in_progress)
INSERT INTO dpia (id, org_id, title, processing_description, legal_basis,
  necessity_assessment, dpo_consultation_required, status,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000541',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'DSFA — KI-gestuetzte Kundenanalyse und Scoring',
  'Einsatz von Machine-Learning-Modellen zur Analyse von Kundenverhalten und Bonitaetsbewertung. Automatisierte Entscheidungsfindung gemäß Art. 22 DSGVO bei Kreditlimitvergabe. Trainingsdaten werden aus CRM und Zahlungshistorie aggregiert.',
  'legitimate_interest',
  'Die automatisierte Bonitaetsbewertung ist notwendig für effizientes Kreditrisikomanagement. Menschliche Ueberprüfung ist bei ablehnenden Entscheidungen vorgesehen (Art. 22 Abs. 3 DSGVO). Alternative: rein manuelle Prüfung — nicht skalierbar bei aktuellem Kundenvolumen.',
  true,
  'in_progress',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. DPIA Risks (4 entries)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dpia_risk (id, org_id, dpia_id, risk_description, severity, likelihood, impact) VALUES
  ('d0000000-0000-0000-0000-000000000545', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000540',
   'Überwachungsdruck führt zu psychischer Belastung der Mitarbeiter und Verletzung der Persönlichkeitsrechte.',
   'high', 'medium', 'high'),
  ('d0000000-0000-0000-0000-000000000546', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000540',
   'Zweckentfremdung der erhobenen Zeiterfassungsdaten für unzulaessige Verhaltenskontrolle.',
   'medium', 'low', 'high'),
  ('d0000000-0000-0000-0000-000000000547', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000541',
   'Diskriminierende Ergebnisse durch Bias in Trainingsdaten bei der KI-Bonitaetsbewertung.',
   'high', 'medium', 'high'),
  ('d0000000-0000-0000-0000-000000000548', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000541',
   'Mangelnde Transparenz und Erklaerbarkeit der KI-Entscheidungen gegenueber betroffenen Kunden.',
   'medium', 'high', 'medium')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. DPIA Measures (4 entries)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dpia_measure (id, org_id, dpia_id, measure_description, implementation_timeline,
  cost_onetime, cost_annual, effort_hours, cost_currency, cost_note) VALUES
  ('d0000000-0000-0000-0000-00000000054a', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000540',
   'Betriebsvereinbarung zur Zeiterfassung mit klaren Nutzungsgrenzen und Zweckbindung abschliessen.',
   'Q1 2026', NULL, NULL, 40.00, 'EUR', 'Interne Rechtsberatung und Betriebsratsverhandlung'),
  ('d0000000-0000-0000-0000-00000000054b', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000540',
   'Technische Zugriffsbeschraenkung: Nur Teamleiter sehen aggregierte Daten, keine Einzelauswertung.',
   'Q1 2026', 5000.00, NULL, 24.00, 'EUR', 'Anpassung des Zeiterfassungssystems'),
  ('d0000000-0000-0000-0000-00000000054c', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000541',
   'Bias-Audit der Trainingsdaten durch externen Dienstleister vor Produktivschaltung.',
   'Q2 2026', 25000.00, 10000.00, 80.00, 'EUR', 'Externer Fairness-Audit und jährliche Wiederholung'),
  ('d0000000-0000-0000-0000-00000000054d', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000541',
   'Implementierung eines Erklaerbarkeitslayers (XAI) mit verstaendlicher Begruendung für jede KI-Entscheidung.',
   'Q3 2026', 35000.00, 5000.00, 160.00, 'EUR', 'Entwicklung XAI-Dashboard und Integration in CRM')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Security Incident (1 — linked to ransomware data breach)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO security_incident (id, org_id, element_id, title, description, severity, status,
  incident_type, detected_at, reported_by, assigned_to, is_data_breach,
  data_breach_72h_deadline, root_cause, remediation_actions,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000570',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'INC00000042',
  'Ransomware-Angriff auf Fileserver mit personenbezogenen Daten',
  'Am 2026-03-10 wurde ein Ransomware-Befall auf dem zentralen Fileserver (FS-PROD-01) festgestellt. Verschlüsselt wurden unter anderem Verzeichnisse mit Personalakten und Kundendaten. Laterale Ausbreitung konnte auf ein Netzwerksegment begrenzt werden.',
  'critical',
  'contained',
  'ransomware',
  '2026-03-10T06:30:00Z',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  true,
  '2026-03-13T06:30:00Z',
  'Initiale Kompromittierung ueber Phishing-E-Mail mit manipuliertem PDF-Anhang. Mitarbeiter hat Makro aktiviert, dadurch Cobalt-Strike-Beacon nachgeladen.',
  'Sofortige Netzwerksegmentierung, Isolation des betroffenen Fileservers, Wiederherstellung aus Offline-Backup, Credential-Reset für alle Admin-Konten.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Data Breaches (3 entries)
-- ─────────────────────────────────────────────────────────────────────────────

-- BREACH-001: Phishing-E-Mail-Breach (closed)
INSERT INTO data_breach (id, org_id, title, description, severity, status,
  detected_at, dpa_notified_at, is_dpa_notification_required,
  is_individual_notification_required,
  data_categories_affected, estimated_records_affected, affected_countries,
  containment_measures, remediation_measures, lessons_learned,
  dpo_id, assignee_id, closed_at, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000550',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Phishing-Angriff — Offenlegung von Mitarbeiter-Zugangsdaten',
  'Durch eine gezielte Phishing-Kampagne wurden Zugangsdaten von 12 Mitarbeitern kompromittiert. Angreifer erhielten kurzzeitig Zugriff auf E-Mail-Postfaecher mit personenbezogenen Daten.',
  'medium',
  'closed',
  '2025-11-15T08:00:00Z',
  '2025-11-16T14:30:00Z',
  true,
  false,
  ARRAY['E-Mail-Adressen', 'Korrespondenz mit personenbezogenen Daten'],
  230,
  ARRAY['DE'],
  'Sofortiger Passwort-Reset aller betroffenen Konten, MFA-Erzwingung, Session-Invalidierung.',
  'Einfuehrung verpflichtender MFA für alle Mitarbeiter, verstaerkte Phishing-Simulation.',
  'MFA haette den Zugriff verhindert. Phishing-Awareness-Schulung muss haeufiger durchgeführt werden.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2025-12-20T16:00:00Z',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- BREACH-002: CRM-Datenexposition (remediation)
INSERT INTO data_breach (id, org_id, title, description, severity, status,
  detected_at, dpa_notified_at, is_dpa_notification_required,
  is_individual_notification_required,
  data_categories_affected, estimated_records_affected, affected_countries,
  containment_measures, remediation_measures,
  dpo_id, assignee_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000551',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'CRM-API-Fehlkonfiguration — Kundendaten oeffentlich abrufbar',
  'Durch eine Fehlkonfiguration der CRM-REST-API waren Kundenstammdaten (Name, Adresse, E-Mail) für 48 Stunden ohne Authentifizierung abrufbar. Entdeckt durch externen Sicherheitsforscher.',
  'high',
  'remediation',
  '2026-02-28T10:15:00Z',
  '2026-03-01T09:00:00Z',
  true,
  true,
  ARRAY['Kundennamen', 'Adressen', 'E-Mail-Adressen', 'Telefonnummern'],
  4200,
  ARRAY['DE', 'AT', 'CH'],
  'Sofortige Deaktivierung des betroffenen API-Endpunkts, Einschraenkung auf authentifizierte Zugriffe.',
  'Umfassender API-Security-Review, Einfuehrung von API-Gateway mit OAuth 2.0, Penetrationstest beauftragt.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- BREACH-003: Ransomware-Breach (notifying_dpa, linked to incident 0570)
INSERT INTO data_breach (id, org_id, incident_id, title, description, severity, status,
  detected_at, is_dpa_notification_required,
  is_individual_notification_required,
  data_categories_affected, estimated_records_affected, affected_countries,
  containment_measures,
  dpo_id, assignee_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000552',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000570',
  'Ransomware-Verschlüsselung — Personalakten und Kundendaten betroffen',
  'Im Rahmen des Ransomware-Vorfalls (INC00000042) wurden Fileserver-Verzeichnisse mit Personalakten, Gehaltsabrechnungen und Kundenprojektdaten verschlüsselt. Exfiltration kann nicht ausgeschlossen werden.',
  'critical',
  'notifying_dpa',
  '2026-03-10T06:30:00Z',
  true,
  true,
  ARRAY['Personalakten', 'Gehaltsdaten', 'Kundenprojektdaten', 'Bankverbindungen'],
  8500,
  ARRAY['DE', 'AT'],
  'Fileserver isoliert, Netzwerksegment abgetrennt, Forensik-Dienstleister beauftragt.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Data Breach Notifications (2 entries)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_breach_notification (id, org_id, data_breach_id, recipient_type, recipient_email, sent_at, response_status) VALUES
  ('d0000000-0000-0000-0000-000000000560', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000550',
   'dpa', 'poststelle@ldi.nrw.de', '2025-11-16T14:30:00Z', 'acknowledged'),
  ('d0000000-0000-0000-0000-000000000561', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000551',
   'dpa', 'poststelle@ldi.nrw.de', '2026-03-01T09:00:00Z', 'pending_review')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Data Subject Requests (2 DSRs)
-- ─────────────────────────────────────────────────────────────────────────────

-- DSR-001: Auskunftsersuchen (closed)
INSERT INTO dsr (id, org_id, request_type, status, subject_name, subject_email,
  received_at, deadline, verified_at, responded_at, closed_at,
  handler_id, notes, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000580',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'access',
  'closed',
  'Thomas Weber',
  'thomas.weber@example.com',
  '2026-01-10T09:00:00Z',
  '2026-02-07T09:00:00Z',
  '2026-01-11T14:00:00Z',
  '2026-01-25T10:30:00Z',
  '2026-01-28T16:00:00Z',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Ehemaliger Mitarbeiter fordert vollständige Auskunft ueber gespeicherte personenbezogene Daten gemäß Art. 15 DSGVO. Umfasst Personalakte, E-Mail-Archiv und Zeiterfassungsdaten.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- DSR-002: Loeschungsantrag (processing)
INSERT INTO dsr (id, org_id, request_type, status, subject_name, subject_email,
  received_at, deadline, verified_at,
  handler_id, notes, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000581',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'erasure',
  'processing',
  'Maria Schneider',
  'maria.schneider@example.com',
  '2026-03-15T11:00:00Z',
  '2026-04-12T11:00:00Z',
  '2026-03-16T09:30:00Z',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Kundin fordert Loeschung aller personenbezogenen Daten gemäß Art. 17 DSGVO. Prüfung laufender Aufbewahrungspflichten (Steuerrecht, HGB) erforderlich.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. DSR Activities (4 entries)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dsr_activity (id, org_id, dsr_id, activity_type, timestamp, details, created_by) VALUES
  ('d0000000-0000-0000-0000-000000000590', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000580',
   'identity_verification', '2026-01-11T14:00:00Z',
   'Identitaet per Ausweiskopie und Abgleich mit HR-Stammdaten verifiziert.',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),
  ('d0000000-0000-0000-0000-000000000591', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000580',
   'data_compilation', '2026-01-20T16:00:00Z',
   'Daten aus HR-System, E-Mail-Archiv und Zeiterfassung zusammengestellt. 47 Seiten Gesamtdossier.',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),
  ('d0000000-0000-0000-0000-000000000592', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000581',
   'identity_verification', '2026-03-16T09:30:00Z',
   'Identitaet per E-Mail-Verifizierung und Kundennummer-Abgleich im CRM bestätigt.',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),
  ('d0000000-0000-0000-0000-000000000593', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'd0000000-0000-0000-0000-000000000581',
   'legal_review', '2026-03-20T11:00:00Z',
   'Prüfung der Aufbewahrungspflichten durch Rechtsabteilung. Steuerrelevante Rechnungsdaten unterliegen 10-jähriger Aufbewahrungsfrist und können nicht gelöscht werden.',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf')
ON CONFLICT (id) DO NOTHING;

-- End of DPMS seed
