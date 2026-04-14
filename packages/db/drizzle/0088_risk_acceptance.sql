-- Migration 0088: Formal Risk Acceptance (ISO 27005 Clause 10)
-- Closes gaps 10.1, 10.2, 10.3

-- ============================================================
-- Risk Acceptance Record
-- ============================================================

CREATE TABLE IF NOT EXISTS risk_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  risk_id UUID NOT NULL REFERENCES risk(id),
  -- Who accepted
  accepted_by UUID NOT NULL REFERENCES "user"(id),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Conditions
  acceptance_conditions TEXT,
  -- Time-bound acceptance
  valid_until DATE,
  -- Risk level at time of acceptance (for audit trail)
  risk_score_at_acceptance INTEGER NOT NULL,
  risk_level_at_acceptance VARCHAR(20) NOT NULL,
  -- Justification (mandatory per ISO 27005)
  justification TEXT NOT NULL,
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES "user"(id),
  revoke_reason TEXT,
  -- Metadata
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_acceptance_org ON risk_acceptance(org_id);
CREATE INDEX IF NOT EXISTS idx_risk_acceptance_risk ON risk_acceptance(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_acceptance_status ON risk_acceptance(org_id, status);

-- ============================================================
-- Acceptance Authority Matrix
-- ============================================================

CREATE TABLE IF NOT EXISTS risk_acceptance_authority (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  -- Rule: risk_score >= min_score AND risk_score <= max_score -> required_role
  min_score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 25,
  required_role VARCHAR(50) NOT NULL,
  required_role_label VARCHAR(200),
  -- Optional: require specific user approval
  required_approver_id UUID REFERENCES "user"(id),
  -- Description
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, min_score, max_score)
);

-- ============================================================
-- RLS
-- ============================================================

DO $$ BEGIN
  EXECUTE 'ALTER TABLE risk_acceptance ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_risk_acceptance ON risk_acceptance USING (org_id = current_setting(''app.current_org_id'')::uuid)';
  EXECUTE 'ALTER TABLE risk_acceptance_authority ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_risk_acceptance_authority ON risk_acceptance_authority USING (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Default Authority Matrix
-- ============================================================

INSERT INTO risk_acceptance_authority (org_id, min_score, max_score, required_role, required_role_label, description) VALUES
('c2446a5c-64f1-40a7-862a-8ab084f66f41', 1, 8, 'control_owner', 'Kontrollverantwortlicher', 'Niedrige und mittlere Risiken (Score 1-8) können vom Kontrollverantwortlichen akzeptiert werden'),
('c2446a5c-64f1-40a7-862a-8ab084f66f41', 9, 14, 'risk_manager', 'Risikomanager', 'Hohe Risiken (Score 9-14) erfordern die Genehmigung des Risikomanagers'),
('c2446a5c-64f1-40a7-862a-8ab084f66f41', 15, 25, 'admin', 'Geschäftsführung', 'Sehr hohe und kritische Risiken (Score 15-25) erfordern die Genehmigung der Geschäftsführung')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Demo: One accepted risk
-- ============================================================

INSERT INTO risk_acceptance (org_id, risk_id, accepted_by, risk_score_at_acceptance, risk_level_at_acceptance, justification, valid_until, status)
SELECT
  'c2446a5c-64f1-40a7-862a-8ab084f66f41',
  r.id,
  (SELECT id FROM "user" WHERE email = 'admin@arctos.dev'),
  COALESCE(r.risk_score_residual, 6),
  'medium',
  'Restrisiko akzeptiert nach Implementierung der Verschlüsselungsrichtlinie und Zugangskontrollen. Kosten-Nutzen-Analyse zeigt keine wirtschaftlich vertretbaren weiteren Maßnahmen. Nächste Überprüfung in 6 Monaten.',
  '2026-10-15',
  'active'
FROM risk r
WHERE r.org_id = 'c2446a5c-64f1-40a7-862a-8ab084f66f41'
  AND r.treatment_strategy = 'accept'
LIMIT 1
ON CONFLICT DO NOTHING;
