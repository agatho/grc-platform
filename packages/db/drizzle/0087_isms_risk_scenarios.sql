-- Migration 0087: ISMS Risk Scenario Enhancement
-- ISO 27005: Threat × Vulnerability × Asset → IS-Risk Scenario → Treatment

-- Extend risk_scenario with assessment and treatment fields
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS scenario_code VARCHAR(30);
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS likelihood INTEGER DEFAULT 0 CHECK (likelihood BETWEEN 0 AND 5);
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS impact INTEGER DEFAULT 0 CHECK (impact BETWEEN 0 AND 5);
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS risk_score INTEGER GENERATED ALWAYS AS (likelihood * impact) STORED;
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS treatment_strategy VARCHAR(20) DEFAULT 'mitigate';
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS treatment_description TEXT;
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS residual_likelihood INTEGER DEFAULT 0;
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS residual_impact INTEGER DEFAULT 0;
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS residual_score INTEGER GENERATED ALWAYS AS (residual_likelihood * residual_impact) STORED;
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'identified';
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES "user"(id);
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS review_date DATE;
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS control_ids UUID[] DEFAULT '{}';
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS synced_to_erm BOOLEAN DEFAULT false;
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS erm_risk_id UUID REFERENCES risk(id);
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE risk_scenario ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- RLS
DO $$ BEGIN
  EXECUTE 'ALTER TABLE risk_scenario ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_risk_scenario ON risk_scenario USING (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Demo scenarios
INSERT INTO risk_scenario (id, org_id, scenario_code, title, threat_id, vulnerability_id, asset_id, description, likelihood, impact, treatment_strategy, residual_likelihood, residual_impact, status) VALUES
-- Ransomware on ERP
('e0000000-0000-0000-0000-000000000001', 'c2446a5c-64f1-40a7-862a-8ab084f66f41',
 'RSC-001', 'Ransomware-Angriff auf ERP-System',
 'd0000000-0000-0000-0000-000000000501', -- Ransomware threat
 'd0000000-0000-0000-0000-000000000601', -- Unpatched systems vulnerability
 'd0000000-0000-0000-0000-000000000402', -- ERP-System asset
 'Ein Ransomware-Angriff verschlüsselt das ERP-System und alle verknüpften Datenbanken. Geschäftsprozesse stehen für 48-72h still.',
 4, 5, 'mitigate', 2, 3, 'treated'),
-- Insider threat on CRM
('e0000000-0000-0000-0000-000000000002', 'c2446a5c-64f1-40a7-862a-8ab084f66f41',
 'RSC-002', 'Datenexfiltration durch Insider',
 'd0000000-0000-0000-0000-000000000502', -- Insider threat
 'd0000000-0000-0000-0000-000000000602', -- Excessive permissions vulnerability
 'd0000000-0000-0000-0000-000000000403', -- CRM-System asset
 'Ein Mitarbeiter mit überhöhten Zugriffsrechten exportiert Kundendaten. DSGVO-Meldepflicht wird ausgelöst.',
 3, 4, 'mitigate', 2, 2, 'treated'),
-- DDoS on Cloud
('e0000000-0000-0000-0000-000000000003', 'c2446a5c-64f1-40a7-862a-8ab084f66f41',
 'RSC-003', 'DDoS auf Cloud-Infrastruktur',
 'd0000000-0000-0000-0000-000000000503', -- DDoS threat
 NULL, -- no specific vulnerability
 'd0000000-0000-0000-0000-000000000409', -- Cloud-Speicher asset
 'Volumetrischer DDoS-Angriff macht Cloud-Dienste für 4-8h unerreichbar. Betrifft E-Mail, Fileserver und SaaS-Anwendungen.',
 3, 3, 'transfer', 1, 2, 'identified'),
-- Social Engineering on personnel
('e0000000-0000-0000-0000-000000000004', 'c2446a5c-64f1-40a7-862a-8ab084f66f41',
 'RSC-004', 'Phishing-Angriff auf Geschäftsführung',
 'd0000000-0000-0000-0000-000000000504', -- Social engineering threat
 NULL,
 'd0000000-0000-0000-0000-000000000401', -- IT-Abteilung asset
 'CEO-Fraud / Spear-Phishing auf C-Level. Potenzielle Offenlegung strategischer Informationen oder finanzielle Schäden.',
 4, 4, 'mitigate', 2, 3, 'treated'),
-- Supply chain compromise
('e0000000-0000-0000-0000-000000000005', 'c2446a5c-64f1-40a7-862a-8ab084f66f41',
 'RSC-005', 'Supply-Chain-Angriff über Drittanbieter',
 'd0000000-0000-0000-0000-000000000505', -- Supply chain threat
 NULL,
 'd0000000-0000-0000-0000-000000000404', -- Cloud-Gehaltsabrechnung asset
 'Kompromittierung eines SaaS-Anbieters führt zu Zugriff auf Gehaltsdaten. Betrifft alle Mitarbeiterdaten.',
 2, 5, 'mitigate', 1, 3, 'identified')
ON CONFLICT (id) DO NOTHING;
