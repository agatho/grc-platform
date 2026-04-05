-- Migration 0075: Create tables referenced by seed data but missing from prior migrations
-- Fixes database setup so that `seed-all.ts` runs cleanly on a fresh database.
-- All statements are idempotent (IF NOT EXISTS / DO $$ EXCEPTION).

-- ──────────────────────────────────────────────────────────────
-- 1. Generic catalog + catalog_entry tables
--    Schema: packages/db/src/schema/catalog.ts
--    Required by: seed_catalog_*.sql, migration 0069
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS catalog (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(500) NOT NULL,
  description text,
  catalog_type varchar(20) NOT NULL,
  scope       varchar(20) NOT NULL DEFAULT 'platform',
  source      varchar(100) NOT NULL,
  version     varchar(50),
  language    varchar(5) DEFAULT 'de',
  is_active   boolean NOT NULL DEFAULT true,
  target_modules text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS catalog_type_idx ON catalog(catalog_type);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS catalog_source_idx ON catalog(source);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS catalog_entry (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id      uuid NOT NULL REFERENCES catalog(id) ON DELETE CASCADE,
  parent_entry_id uuid REFERENCES catalog_entry(id),
  code            varchar(50) NOT NULL,
  name            varchar(500) NOT NULL,
  name_de         varchar(500),
  description     text,
  description_de  text,
  level           integer NOT NULL DEFAULT 0,
  sort_order      integer NOT NULL DEFAULT 0,
  status          varchar(20) NOT NULL DEFAULT 'active',
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS catalog_entry_catalog_idx ON catalog_entry(catalog_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS catalog_entry_parent_idx ON catalog_entry(parent_entry_id);--> statement-breakpoint

-- Unique constraint needed for ON CONFLICT in catalog seed SQL files
DO $$ BEGIN
  ALTER TABLE catalog_entry
    ADD CONSTRAINT catalog_entry_catalog_code_uniq UNIQUE (catalog_id, code);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 2. module_nav_item table
--    Referenced by: sql/seed_module_definitions_sprint4_9.sql
--    Not defined in Drizzle schema (SQL-only table)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS module_nav_item (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key  varchar(50) NOT NULL REFERENCES module_definition(module_key),
  label_de    varchar(200) NOT NULL,
  label_en    varchar(200) NOT NULL,
  icon        varchar(50),
  route       varchar(200) NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  required_roles text[] DEFAULT '{}',
  parent_route varchar(200),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT module_nav_item_route_uq UNIQUE (module_key, route)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS module_nav_item_module_idx ON module_nav_item(module_key);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 3. Cross-framework mapping enums + table
--    Required by: sql/seed_cross_framework_mappings.sql
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE mapping_relationship AS ENUM (
    'equivalent', 'partial', 'related', 'superset', 'subset',
    'partial_overlap', 'contains', 'contained_by'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE mapping_source AS ENUM (
    'official', 'nist_olir', 'manual', 'ai_suggested', 'community'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS catalog_entry_mapping (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entry_id uuid NOT NULL REFERENCES catalog_entry(id),
  target_entry_id uuid NOT NULL REFERENCES catalog_entry(id),
  relationship    mapping_relationship NOT NULL DEFAULT 'equivalent',
  confidence      integer NOT NULL DEFAULT 85,
  mapping_source  mapping_source NOT NULL DEFAULT 'official',
  source_reference text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_entry_mapping_pair_uq UNIQUE (source_entry_id, target_entry_id)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cem_source_idx ON catalog_entry_mapping(source_entry_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cem_target_idx ON catalog_entry_mapping(target_entry_id);
