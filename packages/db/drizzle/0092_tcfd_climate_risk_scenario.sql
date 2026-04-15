-- Migration 0092: TCFD Climate Risk Scenarios
-- Physical + Transition risks with temperature pathways (1.5°C / 2°C / 3°C / 4°C)
-- Aligned to TCFD recommendations and ESRS E1

-- ============================================================
-- 1. Create climate_risk_scenario table
-- ============================================================

CREATE TABLE IF NOT EXISTS climate_risk_scenario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  description TEXT,

  -- Scenario classification
  scenario_type VARCHAR(30) NOT NULL CHECK (scenario_type IN ('physical', 'transition')),
  risk_category VARCHAR(50) NOT NULL,
  temperature_pathway VARCHAR(10) NOT NULL CHECK (temperature_pathway IN ('1.5', '2.0', '3.0', '4.0')),
  time_horizon VARCHAR(20) NOT NULL CHECK (time_horizon IN ('short', 'medium', 'long')),

  -- Impact assessment
  likelihood_score INTEGER CHECK (likelihood_score BETWEEN 1 AND 5),
  impact_score INTEGER CHECK (impact_score BETWEEN 1 AND 5),
  financial_impact_min NUMERIC(15,2),
  financial_impact_max NUMERIC(15,2),
  financial_impact_currency VARCHAR(3) DEFAULT 'EUR',

  -- Affected areas
  affected_assets TEXT,
  affected_business_lines JSONB DEFAULT '[]'::jsonb,
  geographic_scope VARCHAR(200),

  -- Mitigation
  adaptation_measures TEXT,
  mitigation_strategy TEXT,
  residual_risk_score INTEGER CHECK (residual_risk_score BETWEEN 1 AND 5),

  -- TCFD alignment
  tcfd_category VARCHAR(50),
  esrs_disclosure VARCHAR(20),
  sbti_relevance BOOLEAN DEFAULT false,

  -- Status & ERM bridge
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  erm_risk_id UUID,
  erm_synced_at TIMESTAMPTZ,

  -- Audit
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS crs_org_idx ON climate_risk_scenario(org_id);
CREATE INDEX IF NOT EXISTS crs_type_idx ON climate_risk_scenario(org_id, scenario_type);
CREATE INDEX IF NOT EXISTS crs_pathway_idx ON climate_risk_scenario(org_id, temperature_pathway);

-- ============================================================
-- 3. RLS Policy
-- ============================================================

ALTER TABLE climate_risk_scenario ENABLE ROW LEVEL SECURITY;

CREATE POLICY climate_risk_scenario_org_isolation ON climate_risk_scenario
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================
-- 4. Audit trigger
-- ============================================================

CREATE TRIGGER climate_risk_scenario_audit
  AFTER INSERT OR UPDATE OR DELETE ON climate_risk_scenario
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================================
-- 5. Seed demo data
-- ============================================================

INSERT INTO climate_risk_scenario (org_id, name, description, scenario_type, risk_category, temperature_pathway, time_horizon, likelihood_score, impact_score, financial_impact_min, financial_impact_max, tcfd_category, esrs_disclosure, status, created_by)
SELECT
  o.id,
  s.name,
  s.description,
  s.scenario_type,
  s.risk_category,
  s.temperature_pathway,
  s.time_horizon,
  s.likelihood_score,
  s.impact_score,
  s.financial_impact_min,
  s.financial_impact_max,
  s.tcfd_category,
  s.esrs_disclosure,
  s.status,
  u.id
FROM organization o
CROSS JOIN (VALUES
  ('Hochwasser & Überflutung', 'Physisches Risiko: Hochwasserschäden an Produktionsstandorten in Flussgebieten', 'physical', 'acute', '2.0', 'medium', 4, 4, 2500000, 15000000, 'risk_management', 'E1-9', 'identified'),
  ('Hitzestress Mitarbeiter', 'Chronische Hitzebelastung führt zu Produktivitätsverlust und erhöhten Kühlkosten', 'physical', 'chronic', '3.0', 'medium', 3, 3, 500000, 3000000, 'strategy', 'E1-9', 'identified'),
  ('CO₂-Bepreisung EU ETS Phase 5', 'Transition: Steigende CO₂-Preise (>150€/t) erhöhen Betriebskosten signifikant', 'transition', 'policy', '1.5', 'short', 5, 4, 5000000, 25000000, 'strategy', 'E1-9', 'assessed'),
  ('Technologiewandel E-Mobilität', 'Transition: Beschleunigte Elektrifizierung verändert Produktnachfrage', 'transition', 'technology', '2.0', 'medium', 4, 3, 1000000, 8000000, 'strategy', 'E1-9', 'draft'),
  ('Reputationsrisiko Greenwashing', 'Transition: Stakeholder-Erwartungen an Klimatransparenz steigen', 'transition', 'reputation', '2.0', 'short', 3, 3, 200000, 2000000, 'governance', 'E1-9', 'draft'),
  ('Extremwetter Lieferketten', 'Physisches Risiko: Lieferkettenunterbrechungen durch Extremwetterereignisse', 'physical', 'acute', '3.0', 'short', 4, 5, 3000000, 20000000, 'risk_management', 'E1-9', 'assessed'),
  ('Wasserknappheit Standorte', 'Chronisches Risiko: Zunehmende Wasserknappheit an südeuropäischen Standorten', 'physical', 'chronic', '4.0', 'long', 3, 4, 1000000, 5000000, 'strategy', 'E1-9', 'draft'),
  ('Regulatorische Verschärfung CBAM', 'Transition: Carbon Border Adjustment Mechanism erhöht Importkosten', 'transition', 'policy', '1.5', 'short', 5, 3, 2000000, 10000000, 'strategy', 'E1-9', 'identified')
) AS s(name, description, scenario_type, risk_category, temperature_pathway, time_horizon, likelihood_score, impact_score, financial_impact_min, financial_impact_max, tcfd_category, esrs_disclosure, status)
CROSS JOIN "user" u
WHERE o.slug = 'meridian-holdings' AND u.email = 'admin@arctos.dev'
ON CONFLICT DO NOTHING;
