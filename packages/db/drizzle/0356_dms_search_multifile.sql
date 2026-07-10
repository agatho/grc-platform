-- Migration 0356: DMS Paket D4 — Volltextsuche + Multi-File.
--
-- 1. document.search_vector — GENERATED tsvector over title (weight A)
--    + content (weight B) with 'simple' config (DE/EN mixed corpus,
--    same pattern as search_index in 0050) + GIN index. Consumed by
--    GET /api/v1/documents?q=… via websearch_to_tsquery + ts_rank.
-- 2. document_file — multiple attachments per document. version_id
--    snapshots which document_version a file belonged to; the legacy
--    inline file columns on document keep mirroring the newest file
--    for backward compatibility.

BEGIN;

ALTER TABLE document ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS document_search_vector_gin
  ON document USING GIN(search_vector);

CREATE TABLE IF NOT EXISTS document_file (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organization(id),
  document_id uuid NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  version_id uuid REFERENCES document_version(id) ON DELETE SET NULL,
  file_name varchar(500) NOT NULL,
  file_path varchar(1000) NOT NULL,
  file_size bigint,
  mime_type varchar(255),
  sha256 varchar(64),
  uploaded_by uuid REFERENCES "user"(id),

  -- Cross-cutting mandatory fields
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE INDEX IF NOT EXISTS df_org_idx ON document_file(org_id);
CREATE INDEX IF NOT EXISTS df_document_idx ON document_file(document_id);
CREATE INDEX IF NOT EXISTS df_version_idx ON document_file(version_id);

-- RLS
ALTER TABLE document_file ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_file FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_file' AND policyname='document_file_tenant_select') THEN
    CREATE POLICY document_file_tenant_select ON document_file FOR SELECT
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_file' AND policyname='document_file_tenant_insert') THEN
    CREATE POLICY document_file_tenant_insert ON document_file FOR INSERT
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_file' AND policyname='document_file_tenant_update') THEN
    CREATE POLICY document_file_tenant_update ON document_file FOR UPDATE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_file' AND policyname='document_file_tenant_delete') THEN
    CREATE POLICY document_file_tenant_delete ON document_file FOR DELETE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
END $$;

-- Audit trigger (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger')
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'document_file_audit_trigger'
         AND tgrelid = 'document_file'::regclass
     ) THEN
    CREATE TRIGGER document_file_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON document_file
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

COMMIT;
