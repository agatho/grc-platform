-- Sprint 80: Multi-Region Deployment und Data Sovereignty
-- Migration 1034: Create data_region and region_tenant_config tables

DO $$ BEGIN
  CREATE TYPE data_region_code AS ENUM ('eu_central', 'eu_west', 'eu_north', 'ch', 'uk', 'us_east', 'us_west', 'ap_southeast');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE region_status AS ENUM ('active', 'provisioning', 'maintenance', 'decommissioned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS data_region (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code data_region_code NOT NULL,
  name VARCHAR(200) NOT NULL,
  location VARCHAR(200) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  status region_status NOT NULL DEFAULT 'provisioning',
  endpoint_url VARCHAR(500),
  infra_config JSONB NOT NULL DEFAULT '{}',
  compliance_tags JSONB NOT NULL DEFAULT '[]',
  max_tenants INT,
  current_tenants INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX dr_code_unique ON data_region(code);
CREATE INDEX data_region_status_idx ON data_region(status);

-- No RLS on data_region — platform-level table

CREATE TABLE IF NOT EXISTS region_tenant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  primary_region_id UUID NOT NULL REFERENCES data_region(id),
  backup_region_id UUID REFERENCES data_region(id),
  is_region_locked BOOLEAN NOT NULL DEFAULT true,
  lock_reason VARCHAR(500),
  data_classification VARCHAR(100) NOT NULL DEFAULT 'confidential',
  retention_policy JSONB NOT NULL DEFAULT '{}',
  encryption_config JSONB NOT NULL DEFAULT '{}',
  approved_by UUID REFERENCES "user"(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rtc_org_unique ON region_tenant_config(org_id);
CREATE INDEX region_tenant_config_region_idx ON region_tenant_config(primary_region_id);

ALTER TABLE region_tenant_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY region_tenant_config_org_isolation ON region_tenant_config
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER region_tenant_config_audit
  AFTER INSERT OR UPDATE OR DELETE ON region_tenant_config
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
