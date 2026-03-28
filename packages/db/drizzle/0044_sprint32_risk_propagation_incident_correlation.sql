-- Sprint 32: Risk Propagation + Incident Correlation
-- Migrations 399–408 consolidated

-- ──────────────────────────────────────────────────────────────
-- 399: org_entity_relationship
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_entity_relationship (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_org_id UUID NOT NULL REFERENCES organization(id),
  target_org_id UUID NOT NULL REFERENCES organization(id),
  relationship_type VARCHAR(30) NOT NULL,
  strength INTEGER NOT NULL DEFAULT 50 CHECK (strength >= 0 AND strength <= 100),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS oer_unique_idx ON org_entity_relationship(source_org_id, target_org_id, relationship_type);
CREATE INDEX IF NOT EXISTS oer_source_idx ON org_entity_relationship(source_org_id);
CREATE INDEX IF NOT EXISTS oer_target_idx ON org_entity_relationship(target_org_id);

-- ──────────────────────────────────────────────────────────────
-- 400: risk_propagation_result
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS risk_propagation_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  source_risk_id UUID NOT NULL,
  batch_id UUID NOT NULL,
  results_json JSONB NOT NULL,
  total_affected_entities INTEGER NOT NULL,
  max_depth INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rpr_org_idx ON risk_propagation_result(org_id);
CREATE INDEX IF NOT EXISTS rpr_source_idx ON risk_propagation_result(org_id, source_risk_id);
CREATE INDEX IF NOT EXISTS rpr_batch_idx ON risk_propagation_result(batch_id);

-- ──────────────────────────────────────────────────────────────
-- 401: incident_correlation
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incident_correlation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  correlation_type VARCHAR(20) NOT NULL,
  incident_ids UUID[] NOT NULL,
  campaign_name VARCHAR(500),
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  reasoning TEXT,
  mitre_attack_techniques JSONB DEFAULT '[]'::jsonb,
  shared_factors_json JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ic_org_idx ON incident_correlation(org_id);
CREATE INDEX IF NOT EXISTS ic_type_idx ON incident_correlation(org_id, correlation_type);

-- ──────────────────────────────────────────────────────────────
-- 402–404: RLS policies + audit triggers
-- ──────────────────────────────────────────────────────────────

ALTER TABLE org_entity_relationship ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_propagation_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_correlation ENABLE ROW LEVEL SECURITY;

-- org_entity_relationship: RLS via source_org_id
CREATE POLICY oer_org_isolation ON org_entity_relationship
  USING (source_org_id = current_setting('app.current_org_id', true)::uuid
         OR target_org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY rpr_org_isolation ON risk_propagation_result
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY ic_org_isolation ON incident_correlation
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit triggers
CREATE TRIGGER org_entity_relationship_audit
  AFTER INSERT OR UPDATE OR DELETE ON org_entity_relationship
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER risk_propagation_result_audit
  AFTER INSERT OR UPDATE OR DELETE ON risk_propagation_result
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER incident_correlation_audit
  AFTER INSERT OR UPDATE OR DELETE ON incident_correlation
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
