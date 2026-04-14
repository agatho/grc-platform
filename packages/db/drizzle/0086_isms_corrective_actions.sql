-- Migration 0086: ISMS Corrective Action Plan (CAP)
-- ISO 27001:2022 Kap. 10.1-10.2 Nonconformity & Corrective Action

CREATE TABLE IF NOT EXISTS isms_nonconformity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  -- Identification
  nc_code VARCHAR(30),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  -- Source: internal_audit, management_review, incident, assessment, external_audit, complaint
  source_type VARCHAR(50) NOT NULL DEFAULT 'internal_audit',
  source_id UUID,
  source_reference VARCHAR(200),
  -- Classification
  severity VARCHAR(20) NOT NULL DEFAULT 'minor',
  category VARCHAR(100),
  iso_clause VARCHAR(50),
  -- Dates
  identified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date DATE,
  closed_at TIMESTAMPTZ,
  -- Assignment
  identified_by UUID REFERENCES "user"(id),
  assigned_to UUID REFERENCES "user"(id),
  -- Root Cause
  root_cause TEXT,
  root_cause_method VARCHAR(50),
  -- Status: open, analysis, action_planned, in_progress, verification, closed, reopened
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS isms_corrective_action (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  nonconformity_id UUID NOT NULL REFERENCES isms_nonconformity(id),
  -- Action
  title VARCHAR(500) NOT NULL,
  description TEXT,
  action_type VARCHAR(50) NOT NULL DEFAULT 'corrective',
  -- Tracking
  assigned_to UUID REFERENCES "user"(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  -- Verification (ISO 27001 10.1 e)
  verification_required BOOLEAN NOT NULL DEFAULT true,
  verified_by UUID REFERENCES "user"(id),
  verified_at TIMESTAMPTZ,
  verification_result VARCHAR(50),
  verification_notes TEXT,
  -- Effectiveness (ISO 27001 10.1 f)
  effectiveness_review_date DATE,
  effectiveness_rating VARCHAR(50),
  effectiveness_notes TEXT,
  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'planned',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_isms_nc_org ON isms_nonconformity(org_id);
CREATE INDEX IF NOT EXISTS idx_isms_nc_status ON isms_nonconformity(org_id, status);
CREATE INDEX IF NOT EXISTS idx_isms_ca_org ON isms_corrective_action(org_id);
CREATE INDEX IF NOT EXISTS idx_isms_ca_nc ON isms_corrective_action(nonconformity_id);

-- RLS
DO $$ BEGIN
  EXECUTE 'ALTER TABLE isms_nonconformity ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_isms_nc ON isms_nonconformity USING (org_id = current_setting(''app.current_org_id'')::uuid)';
  EXECUTE 'ALTER TABLE isms_corrective_action ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_isms_ca ON isms_corrective_action USING (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Demo data
INSERT INTO isms_nonconformity (id, org_id, nc_code, title, description, source_type, severity, iso_clause, identified_at, due_date, root_cause, root_cause_method, status) VALUES
('b0000000-0000-0000-0000-000000000001', 'c2446a5c-64f1-40a7-862a-8ab084f66f41',
 'NC-001', 'Fehlende Verschlüsselung auf Backup-Medien',
 'Bei der internen Revision wurde festgestellt, dass Backup-Bänder ohne Verschlüsselung transportiert werden. Verstoß gegen A.8.24 (Einsatz von Kryptographie).',
 'internal_audit', 'major', 'A.8.24',
 '2026-01-20', '2026-03-31',
 'Backup-Software unterstützt Verschlüsselung, wurde aber bei der Migration auf das neue System nicht konfiguriert. Kein 4-Augen-Check bei der Konfigurationsänderung.',
 'five_why', 'in_progress'),
('b0000000-0000-0000-0000-000000000002', 'c2446a5c-64f1-40a7-862a-8ab084f66f41',
 'NC-002', 'Zugriffsrechte-Review nicht fristgerecht durchgeführt',
 'Die quartalsweise Rezertifizierung der Zugriffsrechte für Q4/2025 wurde nicht innerhalb der vorgeschriebenen Frist abgeschlossen. 3 von 8 Systemen ausstehend.',
 'management_review', 'minor', 'A.5.18',
 '2026-02-15', '2026-04-30',
 'Ressourcenmangel im IAM-Team durch Krankheitsausfälle und Priorisierung des ERP-Migrationsprojekts.',
 'ishikawa', 'action_planned')
ON CONFLICT (id) DO NOTHING;

INSERT INTO isms_corrective_action (id, org_id, nonconformity_id, title, description, action_type, due_date, status, verification_required) VALUES
('b0000000-0000-0000-0000-000000000011', 'c2446a5c-64f1-40a7-862a-8ab084f66f41',
 'b0000000-0000-0000-0000-000000000001',
 'AES-256 Verschlüsselung für alle Backup-Medien aktivieren',
 'Konfiguration der Backup-Software (Veeam) für AES-256 Verschlüsselung aller Backup-Jobs. Schlüsselmanagement über bestehendes HSM.',
 'corrective', '2026-02-28', 'in_progress', true),
('b0000000-0000-0000-0000-000000000012', 'c2446a5c-64f1-40a7-862a-8ab084f66f41',
 'b0000000-0000-0000-0000-000000000001',
 'Änderungsmanagement-Prozess für Sicherheitskonfigurationen',
 'Einführung eines 4-Augen-Prinzips bei Änderungen an sicherheitsrelevanten Konfigurationen. Checkliste und Freigabeworkflow implementieren.',
 'preventive', '2026-03-31', 'planned', true),
('b0000000-0000-0000-0000-000000000013', 'c2446a5c-64f1-40a7-862a-8ab084f66f41',
 'b0000000-0000-0000-0000-000000000002',
 'Automatisierte Rezertifizierungs-Erinnerungen',
 'Implementierung automatischer Erinnerungen 2 Wochen vor Rezertifizierungsfrist. Eskalation an CISO bei Fristüberschreitung.',
 'corrective', '2026-03-15', 'planned', true)
ON CONFLICT (id) DO NOTHING;
