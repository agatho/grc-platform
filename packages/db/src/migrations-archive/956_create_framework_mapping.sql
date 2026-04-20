-- Sprint 66: Cross-Framework Auto-Mapping Engine
-- Migration 956: Create framework_mapping table

CREATE TABLE IF NOT EXISTS framework_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_framework VARCHAR(50) NOT NULL,
  source_control_id VARCHAR(100) NOT NULL,
  source_control_title VARCHAR(500),
  target_framework VARCHAR(50) NOT NULL,
  target_control_id VARCHAR(100) NOT NULL,
  target_control_title VARCHAR(500),
  relationship_type VARCHAR(30) NOT NULL,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0.80,
  mapping_source VARCHAR(30) NOT NULL DEFAULT 'nist_olir',
  rationale TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES "user"(id),
  verified_at TIMESTAMPTZ,
  is_built_in BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fm_source_idx ON framework_mapping(source_framework, source_control_id);
CREATE INDEX fm_target_idx ON framework_mapping(target_framework, target_control_id);
CREATE INDEX fm_rel_type_idx ON framework_mapping(relationship_type);
CREATE INDEX fm_confidence_idx ON framework_mapping(confidence);
CREATE UNIQUE INDEX fm_unique_mapping_idx ON framework_mapping(source_framework, source_control_id, target_framework, target_control_id);

-- Audit trigger
CREATE TRIGGER framework_mapping_audit AFTER INSERT OR UPDATE OR DELETE ON framework_mapping
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
