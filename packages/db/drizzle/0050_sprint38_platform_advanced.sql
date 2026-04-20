-- Sprint 38: Platform Advanced — Custom Fields, Notifications, Search, Branding Extensions, Multi-Org Hierarchy
-- Migrations 491–520

-- ═══════════════════════════════════════════════════════════
-- 491: custom_field_definition
-- ═══════════════════════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE custom_field_type AS ENUM ('text','number','date','single_select','multi_select','url','email','checkbox','rich_text','currency');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS custom_field_definition (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organization(id),
  entity_type  VARCHAR(50) NOT NULL,
  field_key    VARCHAR(100) NOT NULL,
  label        JSONB NOT NULL,
  field_type   custom_field_type NOT NULL,
  options      JSONB DEFAULT '[]',
  validation   JSONB DEFAULT '{}',
  default_value JSONB,
  placeholder  JSONB,
  help_text    JSONB,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  show_in_list BOOLEAN NOT NULL DEFAULT false,
  show_in_export BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES "user"(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cfd_org_entity_idx ON custom_field_definition(org_id, entity_type);
CREATE UNIQUE INDEX IF NOT EXISTS cfd_unique_key_idx ON custom_field_definition(org_id, entity_type, field_key);

-- ═══════════════════════════════════════════════════════════
-- 492–499: ADD custom_fields JSONB to entity tables
-- ═══════════════════════════════════════════════════════════
ALTER TABLE risk ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
ALTER TABLE control ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
ALTER TABLE process ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
ALTER TABLE asset ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
ALTER TABLE vendor ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
-- Renamed incident -> isms_incident in a later schema revision
DO $BODY$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='incident') THEN
    EXECUTE 'ALTER TABLE incident ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT ''{}''';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='isms_incident') THEN
    EXECUTE 'ALTER TABLE isms_incident ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT ''{}''';
  END IF;
END
$BODY$;
ALTER TABLE document ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
ALTER TABLE finding ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- ═══════════════════════════════════════════════════════════
-- 501: notification_preference
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notification_preference (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES "user"(id),
  notification_type  VARCHAR(50) NOT NULL,
  channel            VARCHAR(20) NOT NULL DEFAULT 'both',
  quiet_hours_start  VARCHAR(5),
  quiet_hours_end    VARCHAR(5),
  digest_frequency   VARCHAR(20)
);
CREATE UNIQUE INDEX IF NOT EXISTS np_user_type_idx ON notification_preference(user_id, notification_type);

-- ═══════════════════════════════════════════════════════════
-- 502: search_index with tsvector
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS search_index (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organization(id),
  entity_type VARCHAR(50) NOT NULL,
  entity_id   UUID NOT NULL,
  title       VARCHAR(1000) NOT NULL,
  content     TEXT,
  module      VARCHAR(20),
  status      VARCHAR(50),
  owner_id    UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  tsv         TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content,'')), 'B')
  ) STORED
);
CREATE INDEX IF NOT EXISTS si_org_idx ON search_index(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS si_entity_idx ON search_index(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS si_tsv_gin ON search_index USING GIN(tsv);

-- ═══════════════════════════════════════════════════════════
-- 505: ALTER organization for hierarchy
-- ═══════════════════════════════════════════════════════════
ALTER TABLE organization ADD COLUMN IF NOT EXISTS parent_org_id UUID REFERENCES organization(id);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0;
ALTER TABLE organization ADD COLUMN IF NOT EXISTS hierarchy_path TEXT DEFAULT '';

-- ═══════════════════════════════════════════════════════════
-- 506: RLS
-- ═══════════════════════════════════════════════════════════
ALTER TABLE custom_field_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preference ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cfd_org_isolation ON custom_field_definition;
CREATE POLICY cfd_org_isolation ON custom_field_definition
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS si_org_isolation ON search_index;
CREATE POLICY si_org_isolation ON search_index
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ═══════════════════════════════════════════════════════════
-- 507: Audit triggers
-- ═══════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS audit_custom_field_definition ON custom_field_definition;
CREATE TRIGGER audit_custom_field_definition
  AFTER INSERT OR UPDATE OR DELETE ON custom_field_definition
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS audit_notification_preference ON notification_preference;
CREATE TRIGGER audit_notification_preference
  AFTER INSERT OR UPDATE OR DELETE ON notification_preference
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ═══════════════════════════════════════════════════════════
-- 508–515: Search sync triggers for entity types
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sync_risk_search_index() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM search_index WHERE entity_type = 'risk' AND entity_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO search_index (org_id, entity_type, entity_id, title, content, module, status, owner_id, updated_at)
  VALUES (NEW.org_id, 'risk', NEW.id, NEW.title,
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,''),
    'erm', NEW.status, NEW.owner_id, now())
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, content = EXCLUDED.content, status = EXCLUDED.status,
    owner_id = EXCLUDED.owner_id, updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_risk_search ON risk;
CREATE TRIGGER trg_sync_risk_search AFTER INSERT OR UPDATE OR DELETE ON risk
  FOR EACH ROW EXECUTE FUNCTION sync_risk_search_index();

CREATE OR REPLACE FUNCTION sync_control_search_index() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM search_index WHERE entity_type = 'control' AND entity_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO search_index (org_id, entity_type, entity_id, title, content, module, status, owner_id, updated_at)
  VALUES (NEW.org_id, 'control', NEW.id, NEW.title,
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,''),
    'ics', NEW.status, NEW.owner_id, now())
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, content = EXCLUDED.content, status = EXCLUDED.status,
    owner_id = EXCLUDED.owner_id, updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_control_search ON control;
CREATE TRIGGER trg_sync_control_search AFTER INSERT OR UPDATE OR DELETE ON control
  FOR EACH ROW EXECUTE FUNCTION sync_control_search_index();

CREATE OR REPLACE FUNCTION sync_process_search_index() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM search_index WHERE entity_type = 'process' AND entity_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO search_index (org_id, entity_type, entity_id, title, content, module, status, owner_id, updated_at)
  VALUES (NEW.org_id, 'process', NEW.id, NEW.title,
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,''),
    'bpm', NEW.status, NEW.owner_id, now())
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, content = EXCLUDED.content, status = EXCLUDED.status,
    owner_id = EXCLUDED.owner_id, updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_process_search ON process;
CREATE TRIGGER trg_sync_process_search AFTER INSERT OR UPDATE OR DELETE ON process
  FOR EACH ROW EXECUTE FUNCTION sync_process_search_index();

CREATE OR REPLACE FUNCTION sync_document_search_index() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM search_index WHERE entity_type = 'document' AND entity_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO search_index (org_id, entity_type, entity_id, title, content, module, status, updated_at)
  VALUES (NEW.org_id, 'document', NEW.id, NEW.title,
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,''),
    'dms', NEW.status, now())
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, content = EXCLUDED.content, status = EXCLUDED.status,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_document_search ON document;
CREATE TRIGGER trg_sync_document_search AFTER INSERT OR UPDATE OR DELETE ON document
  FOR EACH ROW EXECUTE FUNCTION sync_document_search_index();
