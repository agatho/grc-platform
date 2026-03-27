-- Sprint 19: Bulk Import/Export
-- Migrations 286-292: import_job, import_column_mapping, export_schedule,
-- RLS, audit triggers, indexes

-- ──────────────────────────────────────────────────────────────
-- 286: import_job — Import job tracking with status + log
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "import_job" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "entity_type" varchar(50) NOT NULL,
  "file_name" varchar(500) NOT NULL,
  "file_size" integer NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'uploaded',
  "total_rows" integer,
  "valid_rows" integer,
  "error_rows" integer,
  "imported_rows" integer,
  "column_mapping" jsonb,
  "validation_errors" jsonb DEFAULT '[]',
  "log_json" jsonb DEFAULT '[]',
  "raw_headers" jsonb DEFAULT '[]',
  "raw_preview_rows" jsonb DEFAULT '[]',
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);--> statement-breakpoint

CREATE INDEX "ij_org_idx" ON "import_job" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ij_status_idx" ON "import_job" USING btree ("org_id", "status");--> statement-breakpoint
CREATE INDEX "ij_created_by_idx" ON "import_job" USING btree ("created_by");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 287: import_column_mapping — Saved mapping templates
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "import_column_mapping" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "entity_type" varchar(50) NOT NULL,
  "name" varchar(200) NOT NULL,
  "mapping_json" jsonb NOT NULL,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX "icm_org_entity_idx" ON "import_column_mapping" USING btree ("org_id", "entity_type");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 288: export_schedule — Scheduled recurring exports
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "export_schedule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "name" varchar(200) NOT NULL,
  "entity_types" jsonb NOT NULL,
  "format" varchar(10) NOT NULL DEFAULT 'csv',
  "cron_expression" varchar(50) NOT NULL DEFAULT '0 6 * * 1',
  "recipient_emails" jsonb NOT NULL,
  "filters" jsonb DEFAULT '{}',
  "is_active" varchar(5) NOT NULL DEFAULT 'true',
  "last_run_at" timestamptz,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX "es_org_idx" ON "export_schedule" USING btree ("org_id");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 289: RLS on Sprint 19 tables
-- ──────────────────────────────────────────────────────────────

-- import_job: isolate by org_id
ALTER TABLE "import_job" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "ij_org_isolation" ON "import_job"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

CREATE POLICY "ij_insert_policy" ON "import_job"
  FOR INSERT WITH CHECK ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

-- import_column_mapping: isolate by org_id
ALTER TABLE "import_column_mapping" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "icm_org_isolation" ON "import_column_mapping"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

CREATE POLICY "icm_insert_policy" ON "import_column_mapping"
  FOR INSERT WITH CHECK ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

-- export_schedule: isolate by org_id
ALTER TABLE "export_schedule" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "es_org_isolation" ON "export_schedule"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

CREATE POLICY "es_insert_policy" ON "export_schedule"
  FOR INSERT WITH CHECK ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 290: Audit triggers on Sprint 19 tables
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER "import_job_audit_trigger"
  AFTER INSERT OR UPDATE OR DELETE ON "import_job"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

CREATE TRIGGER "import_column_mapping_audit_trigger"
  AFTER INSERT OR UPDATE OR DELETE ON "import_column_mapping"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

CREATE TRIGGER "export_schedule_audit_trigger"
  AFTER INSERT OR UPDATE OR DELETE ON "export_schedule"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
