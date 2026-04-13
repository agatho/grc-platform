-- Migration 0077: Global Tag System
-- Adds tags array to all 18 main entity tables + tag_definition management table

-- ──────────────────────────────────────────────────────────────
-- 1. Tag Definition table — predefined tags with categories
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tag_definition (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  name        varchar(100) NOT NULL,
  color       varchar(7) DEFAULT '#6B7280',
  category    varchar(50),
  description text,
  usage_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  CONSTRAINT tag_definition_org_name_uq UNIQUE (org_id, name)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS tag_def_org_idx ON tag_definition(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tag_def_category_idx ON tag_definition(org_id, category);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 2. Add tags column to all main entity tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE risk ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE control ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE finding ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE asset ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE vulnerability ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE vendor ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE process ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE kri ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE audit_plan ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE audit ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE ropa_entry ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE dpia ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE dsr ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE data_breach ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE contract ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE bia_assessment ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE soa_entry ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE security_incident ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 3. GIN indexes for fast array containment queries (@>)
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS risk_tags_idx ON risk USING gin(tags);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS control_tags_idx ON control USING gin(tags);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS finding_tags_idx ON finding USING gin(tags);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS asset_tags_idx ON asset USING gin(tags);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS vendor_tags_idx ON vendor USING gin(tags);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS process_tags_idx ON process USING gin(tags);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 4. Add tags to search_index
-- ──────────────────────────────────────────────────────────────

ALTER TABLE search_index ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 5. Seed common tag definitions
-- ──────────────────────────────────────────────────────────────

-- These will be inserted per-org by seed.ts
