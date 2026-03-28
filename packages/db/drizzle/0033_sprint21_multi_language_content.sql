-- Sprint 21: Multi-Language Content Management
-- Migrations 303–315: ALTER 13 fields across 6 tables from TEXT/VARCHAR to JSONB,
-- CREATE translation_status table, ALTER user ADD content_language,
-- ALTER organization ADD active_languages + default_language,
-- RLS policies, audit triggers, indexes

-- ──────────────────────────────────────────────────────────────
-- 303: Enums for translation status
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "translation_status_value" AS ENUM ('original', 'draft_translation', 'verified', 'outdated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "translation_method" AS ENUM ('manual', 'ai_claude', 'ai_ollama', 'xliff_import', 'csv_import');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 304: ALTER organization — add language config fields
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "default_language" varchar(5) NOT NULL DEFAULT 'de',
  ADD COLUMN IF NOT EXISTS "active_languages" jsonb NOT NULL DEFAULT '["de"]';--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 305: ALTER user — add content_language preference
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "content_language" varchar(5) DEFAULT NULL;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 306–308: ALTER risk — title and description to JSONB
-- ──────────────────────────────────────────────────────────────

-- risk.title: VARCHAR → JSONB
ALTER TABLE "risk"
  ALTER COLUMN "title" TYPE jsonb
  USING COALESCE(
    jsonb_build_object(
      COALESCE((SELECT o.default_language FROM organization o WHERE o.id = org_id), 'de'),
      title
    ),
    '{}'::jsonb
  );--> statement-breakpoint

-- risk.description: TEXT → JSONB
ALTER TABLE "risk"
  ALTER COLUMN "description" TYPE jsonb
  USING CASE
    WHEN description IS NOT NULL THEN
      jsonb_build_object(
        COALESCE((SELECT o.default_language FROM organization o WHERE o.id = org_id), 'de'),
        description
      )
    ELSE NULL
  END;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 309: ALTER control — title and description to JSONB
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "control"
  ALTER COLUMN "title" TYPE jsonb
  USING COALESCE(
    jsonb_build_object(
      COALESCE((SELECT o.default_language FROM organization o WHERE o.id = org_id), 'de'),
      title
    ),
    '{}'::jsonb
  );--> statement-breakpoint

ALTER TABLE "control"
  ALTER COLUMN "description" TYPE jsonb
  USING CASE
    WHEN description IS NOT NULL THEN
      jsonb_build_object(
        COALESCE((SELECT o.default_language FROM organization o WHERE o.id = org_id), 'de'),
        description
      )
    ELSE NULL
  END;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 310: ALTER process — name and description to JSONB
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "process"
  ALTER COLUMN "name" TYPE jsonb
  USING COALESCE(
    jsonb_build_object(
      COALESCE((SELECT o.default_language FROM organization o WHERE o.id = org_id), 'de'),
      name
    ),
    '{}'::jsonb
  );--> statement-breakpoint

ALTER TABLE "process"
  ALTER COLUMN "description" TYPE jsonb
  USING CASE
    WHEN description IS NOT NULL THEN
      jsonb_build_object(
        COALESCE((SELECT o.default_language FROM organization o WHERE o.id = org_id), 'de'),
        description
      )
    ELSE NULL
  END;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 311: ALTER document — title to JSONB
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "document"
  ALTER COLUMN "title" TYPE jsonb
  USING COALESCE(
    jsonb_build_object(
      COALESCE((SELECT o.default_language FROM organization o WHERE o.id = org_id), 'de'),
      title
    ),
    '{}'::jsonb
  );--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 312: ALTER finding — title and description to JSONB
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "finding"
  ALTER COLUMN "title" TYPE jsonb
  USING COALESCE(
    jsonb_build_object(
      COALESCE((SELECT o.default_language FROM organization o WHERE o.id = org_id), 'de'),
      title
    ),
    '{}'::jsonb
  );--> statement-breakpoint

ALTER TABLE "finding"
  ALTER COLUMN "description" TYPE jsonb
  USING CASE
    WHEN description IS NOT NULL THEN
      jsonb_build_object(
        COALESCE((SELECT o.default_language FROM organization o WHERE o.id = org_id), 'de'),
        description
      )
    ELSE NULL
  END;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 313: ALTER security_incident — title to JSONB
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "security_incident"
  ALTER COLUMN "title" TYPE jsonb
  USING COALESCE(
    jsonb_build_object(
      COALESCE((SELECT o.default_language FROM organization o WHERE o.id = org_id), 'de'),
      title
    ),
    '{}'::jsonb
  );--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 314: CREATE translation_status table
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "translation_status" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "entity_type" varchar(50) NOT NULL,
  "entity_id" uuid NOT NULL,
  "field" varchar(50) NOT NULL,
  "language" varchar(5) NOT NULL,
  "status" "translation_status_value" NOT NULL DEFAULT 'original',
  "method" "translation_method",
  "translated_by" uuid REFERENCES "user"("id"),
  "translated_at" timestamptz,
  "source_hash" varchar(64),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamptz,
  "deleted_by" uuid,
  UNIQUE("org_id", "entity_type", "entity_id", "field", "language")
);--> statement-breakpoint

CREATE INDEX "ts_entity_idx" ON "translation_status"("entity_type", "entity_id");--> statement-breakpoint
CREATE INDEX "ts_lang_status_idx" ON "translation_status"("org_id", "language", "status");--> statement-breakpoint
CREATE INDEX "ts_org_entity_type_idx" ON "translation_status"("org_id", "entity_type");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 315: RLS + Audit triggers
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "translation_status" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "translation_status_org_isolation" ON "translation_status";--> statement-breakpoint
CREATE POLICY "translation_status_org_isolation" ON "translation_status"
  USING (org_id::text = current_setting('app.current_org_id', true));--> statement-breakpoint

-- Audit trigger on translation_status
DROP TRIGGER IF EXISTS "translation_status_audit" ON "translation_status";--> statement-breakpoint
CREATE TRIGGER "translation_status_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "translation_status"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- Catalog entry migration: merge titleDe/titleEn → JSONB title
-- (catalog entries are platform-wide, no org_id-based default)
-- ──────────────────────────────────────────────────────────────

-- risk_catalog_entry: merge title_de/title_en into JSONB title
ALTER TABLE "risk_catalog_entry"
  ADD COLUMN IF NOT EXISTS "title" jsonb;--> statement-breakpoint

UPDATE "risk_catalog_entry"
  SET "title" = jsonb_build_object('de', title_de) ||
    CASE WHEN title_en IS NOT NULL THEN jsonb_build_object('en', title_en) ELSE '{}'::jsonb END;--> statement-breakpoint

ALTER TABLE "risk_catalog_entry"
  ADD COLUMN IF NOT EXISTS "description" jsonb;--> statement-breakpoint

UPDATE "risk_catalog_entry"
  SET "description" = CASE
    WHEN description_de IS NOT NULL THEN
      jsonb_build_object('de', description_de) ||
      CASE WHEN description_en IS NOT NULL THEN jsonb_build_object('en', description_en) ELSE '{}'::jsonb END
    WHEN description_en IS NOT NULL THEN jsonb_build_object('en', description_en)
    ELSE NULL
  END;--> statement-breakpoint

-- control_catalog_entry: merge title_de/title_en into JSONB title
ALTER TABLE "control_catalog_entry"
  ADD COLUMN IF NOT EXISTS "title" jsonb;--> statement-breakpoint

UPDATE "control_catalog_entry"
  SET "title" = jsonb_build_object('de', title_de) ||
    CASE WHEN title_en IS NOT NULL THEN jsonb_build_object('en', title_en) ELSE '{}'::jsonb END;--> statement-breakpoint

ALTER TABLE "control_catalog_entry"
  ADD COLUMN IF NOT EXISTS "description" jsonb;--> statement-breakpoint

UPDATE "control_catalog_entry"
  SET "description" = CASE
    WHEN description_de IS NOT NULL THEN
      jsonb_build_object('de', description_de) ||
      CASE WHEN description_en IS NOT NULL THEN jsonb_build_object('en', description_en) ELSE '{}'::jsonb END
    WHEN description_en IS NOT NULL THEN jsonb_build_object('en', description_en)
    ELSE NULL
  END;--> statement-breakpoint

-- implementation field for control catalog
ALTER TABLE "control_catalog_entry"
  ADD COLUMN IF NOT EXISTS "implementation" jsonb;--> statement-breakpoint

UPDATE "control_catalog_entry"
  SET "implementation" = CASE
    WHEN implementation_de IS NOT NULL THEN
      jsonb_build_object('de', implementation_de) ||
      CASE WHEN implementation_en IS NOT NULL THEN jsonb_build_object('en', implementation_en) ELSE '{}'::jsonb END
    WHEN implementation_en IS NOT NULL THEN jsonb_build_object('en', implementation_en)
    ELSE NULL
  END;--> statement-breakpoint
