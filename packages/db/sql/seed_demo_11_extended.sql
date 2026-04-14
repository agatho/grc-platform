-- =============================================================================
-- ARCTOS Demo Data Seed 11 — Extended: 15 additional risks, 10 controls, 5 findings
-- Uses ORG_ID and USER_ID placeholders (replaced at runtime by seed-all.ts)
-- Deterministic UUIDs: d0000000-0000-0000-0000-000000001XXX
-- =============================================================================

-- Session config for audit triggers
SELECT set_config('app.current_org_id', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', true);
SELECT set_config('app.current_user_id', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', true);
SELECT set_config('app.current_user_email', 'admin@arctos.dev', true);
SELECT set_config('app.current_user_name', 'Platform Admin', true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Additional Risks (15)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO risk (id, org_id, title, description, risk_category, risk_source, status, owner_id,
  inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
  risk_score_inherent, risk_score_residual, treatment_strategy, review_date,
  created_by, updated_by)
VALUES
  ('d0000000-0000-0000-0000-000000001001', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Unzureichende Patch-Management-Prozesse', 'Verzoegertes Einspielen von Sicherheitsupdates erhoht das Risiko bekannter Schwachstellen.',
   'cyber', 'isms', 'assessed', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   4, 4, 2, 3, 16, 6, 'mitigate', '2026-09-30',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001002', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Insider-Bedrohung durch privilegierte Nutzer', 'Administratoren mit weitreichenden Rechten koennen sensible Daten exfiltrieren.',
   'cyber', 'isms', 'assessed', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   3, 5, 2, 4, 15, 8, 'mitigate', '2026-08-31',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001003', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Nichteinhaltung der NIS2-Meldepflichten', 'Fehlende Prozesse für die 24h-Meldepflicht bei Sicherheitsvorfaellen.',
   'compliance', 'erm', 'identified', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   3, 4, 3, 4, 12, 12, 'mitigate', '2026-07-31',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001004', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Ausfall der Produktionssteuerung durch Cyberangriff', 'OT-Systeme ohne ausreichende Segmentierung vom IT-Netz.',
   'operational', 'isms', 'assessed', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   2, 5, 1, 5, 10, 5, 'mitigate', '2026-12-31',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001005', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Reputationsverlust durch Datenleck', 'Öffentliches Bekanntwerden eines Datenverlusts führt zu Vertrauensverlust bei Kunden.',
   'reputational', 'erm', 'identified', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   2, 4, 2, 3, 8, 6, 'accept', '2026-09-30',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001006', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Regulatorische Änderungen im EU AI Act', 'Neue Pflichten für KI-Systeme erfordern Anpassungen in der Compliance-Strategie.',
   'compliance', 'erm', 'identified', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   3, 3, 2, 3, 9, 6, 'mitigate', '2026-12-31',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001007', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Abhängigkeit von einzelnem Cloud-Provider', 'Vendor Lock-in bei kritischen SaaS-Diensten ohne Exit-Strategie.',
   'strategic', 'erm', 'assessed', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   3, 3, 2, 2, 9, 4, 'transfer', '2026-09-30',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001008', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Fehlendes Schwachstellenmanagement', 'Keine regelmäßigen Vulnerability Scans der externen Angriffsoberflaeche.',
   'cyber', 'isms', 'treated', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   4, 3, 2, 2, 12, 4, 'mitigate', '2026-07-31',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001009', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Klimabedingte Betriebsunterbrechungen', 'Extreme Wetterereignisse beeintraechtigen Standorte und Lieferketten.',
   'esg', 'erm', 'identified', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   2, 3, 2, 3, 6, 6, 'accept', '2026-12-31',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001010', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Verlust der ISO 27001 Zertifizierung', 'Nichtbestehen des nächsten Überwachungsaudits durch ungenuegend dokumentierte Kontrollen.',
   'compliance', 'isms', 'assessed', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   2, 4, 1, 3, 8, 3, 'mitigate', '2026-10-31',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001011', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Betrugsrisiko im Beschaffungsprozess', 'Ungenuegend geprüfte Lieferantenrechnungen und fehlende Vier-Augen-Kontrolle.',
   'financial', 'erm', 'identified', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   2, 3, 1, 2, 6, 2, 'mitigate', '2026-09-30',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001012', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Social Engineering durch Phishing-Kampagnen', 'Zunehmend sophistizierte Phishing-Attacken auf Mitarbeiter mit Adminrechten.',
   'cyber', 'isms', 'treated', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   4, 3, 3, 2, 12, 6, 'mitigate', '2026-06-30',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001013', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'DORA-Compliance für kritische IKT-Dienste', 'Anforderungen an digitale Betriebsstabilitaet im Finanzsektor nicht vollständig umgesetzt.',
   'compliance', 'erm', 'identified', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   3, 3, 3, 3, 9, 9, 'mitigate', '2026-12-31',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001014', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Mangelhafter Zugriffsentzug bei Offboarding', 'Austretende Mitarbeiter behalten Zugriff auf kritische Systeme.',
   'operational', 'isms', 'assessed', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   3, 3, 2, 2, 9, 4, 'mitigate', '2026-07-31',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001015', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Lieferketten-Cyberrisiko durch Drittanbieter', 'Kompromittierung eines Software-Lieferanten kann alle Kunden betreffen (SolarWinds-Szenario).',
   'cyber', 'erm', 'assessed', '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
   2, 5, 2, 4, 10, 8, 'mitigate', '2026-09-30',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf')

ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Additional Controls (10) linked to risks
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO control (id, org_id, title, description, control_type, frequency, status, owner_id,
  created_by, updated_by)
VALUES
  ('d0000000-0000-0000-0000-000000001101', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Automatisiertes Patch-Management', 'WSUS/SCCM-basierte automatische Verteilung von Sicherheitspatches innerhalb 72h.',
   'preventive', 'daily', 'effective',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001102', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Privileged Access Management (PAM)', 'CyberArk-basierte Verwaltung privilegierter Konten mit Session-Recording.',
   'preventive', 'continuous', 'implemented',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001103', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Security Awareness Training', 'Quartalmaessige Phishing-Simulation und E-Learning-Module für alle Mitarbeiter.',
   'preventive', 'quarterly', 'effective',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001104', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Vulnerability Scanning (extern)', 'Wöchentliche automatisierte Schwachstellenscans der externen Angriffsfläche.',
   'detective', 'weekly', 'effective',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001105', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'NIS2-Incident-Response-Prozess', '24h-Meldeprozess an BSI mit definierten Eskalationsstufen und Templates.',
   'corrective', 'event_driven', 'designed',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001106', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'OT/IT-Netzwerksegmentierung', 'Firewall-basierte Trennung von OT- und IT-Netzwerken mit Demilitarized Zone.',
   'preventive', 'continuous', 'implemented',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001107', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Multi-Cloud Exit-Strategie', 'Dokumentierte Migrationspfade und Datenportabilitaet für kritische SaaS-Dienste.',
   'preventive', 'annually', 'designed',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001108', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Automatisierter Offboarding-Workflow', 'SCIM-Integration mit HR-System zum automatischen Zugriffsentzug bei Austritt.',
   'preventive', 'event_driven', 'effective',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001109', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Supplier Security Assessment', 'Jährliche Sicherheitsbewertung kritischer IT-Lieferanten nach TISAX-Standard.',
   'detective', 'annually', 'implemented',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001110', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'DORA IKT-Risikorahmenwerk', 'Implementierung des Digital Operational Resilience Act Rahmenwerks.',
   'preventive', 'continuous', 'designed',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf')

ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Findings (5) — from control assessments
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO finding (id, org_id, title, description, severity, status, source,
  control_id, owner_id, remediation_due_date, created_by, updated_by)
VALUES
  ('d0000000-0000-0000-0000-000000001201', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'PAM-Loesung nicht für alle Adminkonten ausgerollt',
   'Bei der Kontrolltestung wurde festgestellt, dass 12 von 45 Administratorkonten nicht im PAM-System erfasst sind.',
   'significant_nonconformity', 'identified', 'control_test', 'd0000000-0000-0000-0000-000000001102',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '2026-07-31',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001202', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Patch-SLA von 72h wird regelmäßig ueberschritten',
   'In Q1/2026 wurden 23% der kritischen Patches erst nach mehr als 7 Tagen eingespielt.',
   'improvement_requirement', 'identified', 'control_test', 'd0000000-0000-0000-0000-000000001101',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '2026-08-31',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001203', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'NIS2-Meldeprozess nicht getestet',
   'Der 24h-Meldeprozess wurde seit Inkrafttreten nicht in einer Übung getestet.',
   'significant_nonconformity', 'in_remediation', 'audit', 'd0000000-0000-0000-0000-000000001105',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '2026-06-30',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001204', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Awareness-Training-Teilnahmequote unter Zielwert',
   'Nur 78% der Mitarbeiter haben das Quartal-Training absolviert (Ziel: 95%).',
   'observation', 'identified', 'control_test', 'd0000000-0000-0000-0000-000000001103',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '2026-09-30',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'),

  ('d0000000-0000-0000-0000-000000001205', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   'Offboarding-Automatisierung lueckenhaft bei Externen',
   'Der automatische Zugriffsentzug erfasst nur interne Mitarbeiter, nicht externe Berater.',
   'insignificant_nonconformity', 'identified', 'control_test', 'd0000000-0000-0000-0000-000000001108',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '2026-08-31',
   '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf')

ON CONFLICT (id) DO NOTHING;
