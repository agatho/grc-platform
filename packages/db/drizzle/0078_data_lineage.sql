-- Migration 0078: Data Lineage — Track data provenance from source to report
-- Enables full traceability of every datapoint: Source → Transformation → Report

CREATE TABLE IF NOT EXISTS data_lineage_source (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  source_name  varchar(255) NOT NULL,
  source_type  varchar(50) NOT NULL DEFAULT 'manual',
  connection_id uuid,
  description  text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS dls_org_idx ON data_lineage_source(org_id);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS data_lineage_entry (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  entity_type     varchar(50) NOT NULL,
  entity_id       uuid NOT NULL,
  field_name      varchar(100) NOT NULL,
  field_value     text,
  source_id       uuid REFERENCES data_lineage_source(id),
  source_record   varchar(500),
  transformation  text,
  confidence      varchar(20) DEFAULT 'verified',
  verified_by     uuid,
  verified_at     timestamptz,
  reported_in     text[],
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS dle_org_idx ON data_lineage_entry(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dle_entity_idx ON data_lineage_entry(entity_type, entity_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dle_source_idx ON data_lineage_entry(source_id);
