-- Migration 0094: DPIA Art. 35 DSGVO — Full Compliance Enhancement
-- Adds missing fields for complete GDPR Art. 35 + WP248 coverage
-- + Risk↔Measure linkage for traceable mitigation

-- ============================================================
-- 1. New columns on dpia table
-- ============================================================

-- Art. 35(7)(a): Systematic description of processing
ALTER TABLE dpia ADD COLUMN IF NOT EXISTS systematic_description TEXT;

-- Art. 35(7)(a): Data categories processed
ALTER TABLE dpia ADD COLUMN IF NOT EXISTS data_categories TEXT[];

-- Affected data subject categories
ALTER TABLE dpia ADD COLUMN IF NOT EXISTS data_subject_categories TEXT[];

-- Recipients of personal data
ALTER TABLE dpia ADD COLUMN IF NOT EXISTS recipients TEXT[];

-- Third country transfers with legal basis and safeguards
ALTER TABLE dpia ADD COLUMN IF NOT EXISTS third_country_transfers JSONB;

-- Retention period
ALTER TABLE dpia ADD COLUMN IF NOT EXISTS retention_period VARCHAR(255);

-- DPO consultation result
ALTER TABLE dpia ADD COLUMN IF NOT EXISTS consultation_result TEXT;

-- DPO consultation date
ALTER TABLE dpia ADD COLUMN IF NOT EXISTS consultation_date DATE;

-- Next scheduled review date
ALTER TABLE dpia ADD COLUMN IF NOT EXISTS next_review_date DATE;

-- Formal DPO opinion / statement
ALTER TABLE dpia ADD COLUMN IF NOT EXISTS dpo_opinion TEXT;

-- ============================================================
-- 2. Risk↔Measure linkage on dpia_measure
-- ============================================================

ALTER TABLE dpia_measure ADD COLUMN IF NOT EXISTS risk_id UUID REFERENCES dpia_risk(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dpia_measure_risk_idx ON dpia_measure(risk_id) WHERE risk_id IS NOT NULL;

-- ============================================================
-- 3. Update seed data for demo DPIAs
-- ============================================================

-- DPIA-001: Mitarbeiterueberwachung
UPDATE dpia SET
  systematic_description = 'Systematische Erfassung der Arbeitszeiten und Anwendungsnutzung aller Mitarbeiter der Meridian Holdings GmbH. Zweck: Arbeitszeitgesetz-Compliance und Leistungsbewertung im Rahmen der Zielvereinbarungen. Betroffene Systeme: SAP HCM, Zeiterfassungsterminals, Microsoft 365 Activity Reports.',
  data_categories = ARRAY['Arbeitszeitdaten', 'Anwendungsnutzungsdaten', 'Leistungskennzahlen', 'Anwesenheitsdaten'],
  data_subject_categories = ARRAY['Mitarbeiter', 'Zeitarbeitskraefte', 'Praktikanten'],
  recipients = ARRAY['HR-Abteilung', 'Vorgesetzte (aggregiert)', 'Betriebsrat (anonymisiert)', 'Lohnbuchhaltung'],
  third_country_transfers = '[{"country": "USA", "legal_basis": "EU-US Data Privacy Framework", "safeguards": "Microsoft DPA mit SCCs als Fallback"}]'::jsonb,
  retention_period = '3 Jahre nach Austritt des Mitarbeiters (gesetzliche Aufbewahrungsfrist ArbZG)',
  consultation_result = 'DPO empfiehlt Durchfuehrung mit Auflagen: (1) Keine Einzelauswertung ohne konkreten Anlass, (2) Betriebsvereinbarung vor Produktivstart, (3) Jaehrliche Verhaeltnismaessigkeitspruefung',
  consultation_date = '2026-01-15',
  next_review_date = '2027-01-15',
  dpo_opinion = 'Die Verarbeitung ist bei Einhaltung der genannten Auflagen verhaeltnismaessig. Die Risiken fuer die Betroffenen sind durch die vorgeschlagenen Massnahmen auf ein akzeptables Niveau reduziert. Eine Konsultation der Aufsichtsbehoerde nach Art. 36 DSGVO ist nicht erforderlich.'
WHERE title LIKE '%berwachung%' OR title LIKE '%Monitoring%';

-- DPIA-002: KI-gestuetzte Kundenanalyse
UPDATE dpia SET
  systematic_description = 'Einsatz von Machine-Learning-Modellen zur Analyse des Kundenverhaltens (Kaufhistorie, Zahlungsverhalten, Interaktionsdaten). Automatisierte Kreditlimitentscheidung gemaess Art. 22 DSGVO mit menschlicher Ueberpruefung bei Ablehnungen.',
  data_categories = ARRAY['Kaufhistorie', 'Zahlungsverhalten', 'CRM-Interaktionsdaten', 'Bonitaetsdaten', 'Demographische Daten'],
  data_subject_categories = ARRAY['Bestandskunden', 'Neukunden', 'Geschaeftspartner'],
  recipients = ARRAY['Vertriebsabteilung', 'Kreditmanagement', 'Externer ML-Dienstleister (Auftragsverarbeiter)'],
  third_country_transfers = '[{"country": "USA", "legal_basis": "Standardvertragsklauseln (SCCs)", "safeguards": "TIA durchgefuehrt, Verschluesselung in Transit und at Rest, kein Zugriff auf Klartextdaten durch US-Personal"}]'::jsonb,
  retention_period = '5 Jahre nach letzter Kundeninteraktion (handelsrechtliche Aufbewahrungspflicht)',
  consultation_result = 'Konsultation noch ausstehend — DSFA muss erst abgeschlossen werden',
  consultation_date = NULL,
  next_review_date = '2026-09-01',
  dpo_opinion = NULL
WHERE title LIKE '%Kundenanalyse%' OR title LIKE '%Customer%' OR title LIKE '%Scoring%';

-- Link measures to specific risks where appropriate
-- Measure 1 (Betriebsvereinbarung) → Risk 1 (Psychischer Druck)
UPDATE dpia_measure m SET risk_id = r.id
FROM dpia_risk r
WHERE m.dpia_id = r.dpia_id
  AND m.measure_description LIKE '%Betriebsvereinbarung%'
  AND r.risk_description LIKE '%psychisch%';

-- Measure 2 (Zugriffsbeschraenkung) → Risk 2 (Datenmissbrauch)
UPDATE dpia_measure m SET risk_id = r.id
FROM dpia_risk r
WHERE m.dpia_id = r.dpia_id
  AND m.measure_description LIKE '%Zugriffsbeschr%'
  AND r.risk_description LIKE '%Missbrauch%';

-- Measure 3 (Bias-Audit) → Risk 3 (Diskriminierung)
UPDATE dpia_measure m SET risk_id = r.id
FROM dpia_risk r
WHERE m.dpia_id = r.dpia_id
  AND m.measure_description LIKE '%Bias%'
  AND r.risk_description LIKE '%Diskriminier%';

-- Measure 4 (XAI) → Risk 4 (Transparenz)
UPDATE dpia_measure m SET risk_id = r.id
FROM dpia_risk r
WHERE m.dpia_id = r.dpia_id
  AND m.measure_description LIKE '%XAI%'
  AND r.risk_description LIKE '%Transparenz%';
