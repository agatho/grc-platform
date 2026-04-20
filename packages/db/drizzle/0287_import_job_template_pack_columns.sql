-- Sprint 59 follow-up: extend import_job for template-pack imports
-- Source columns plus granular progress tracking consumed by the
-- import-job-processor worker (apps/worker/src/crons/import-job-processor.ts).

ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "source"            VARCHAR(30);
ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "template_pack_id"  UUID;
ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "total_items"       INTEGER;
ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "processed_items"   INTEGER;
ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "failed_items"      INTEGER;
ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "error_log"         JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "started_at"        TIMESTAMPTZ;
ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now();
