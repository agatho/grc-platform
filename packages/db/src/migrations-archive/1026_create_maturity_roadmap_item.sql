-- Sprint 78: GRC Benchmarking und Maturity Model
-- Migration 1026: Create maturity_roadmap_item table

DO $$ BEGIN
  CREATE TYPE maturity_roadmap_item_status AS ENUM ('planned', 'in_progress', 'completed', 'deferred');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE maturity_roadmap_item_priority AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS maturity_roadmap_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  module_key maturity_module_key NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  from_level maturity_level NOT NULL,
  to_level maturity_level NOT NULL,
  status maturity_roadmap_item_status NOT NULL DEFAULT 'planned',
  priority maturity_roadmap_item_priority NOT NULL DEFAULT 'medium',
  assignee_id UUID REFERENCES "user"(id),
  estimated_effort_days INT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mri_org_idx ON maturity_roadmap_item(org_id);
CREATE INDEX mri_module_idx ON maturity_roadmap_item(org_id, module_key);
CREATE INDEX mri_status_idx ON maturity_roadmap_item(org_id, status);

ALTER TABLE maturity_roadmap_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY maturity_roadmap_item_org_isolation ON maturity_roadmap_item
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER maturity_roadmap_item_audit
  AFTER INSERT OR UPDATE OR DELETE ON maturity_roadmap_item
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
