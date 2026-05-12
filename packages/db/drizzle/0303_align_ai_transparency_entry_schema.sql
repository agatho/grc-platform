-- #NIGHT-023 / #WAVE3-PARTIAL: GET /api/v1/ai-act/transparency-entries was
-- 500-crashing because the Drizzle schema declared columns the DB never
-- had. The original migration (0085_ai_act_complete) created the table
-- without public_url / registration_ref / published_by, but the schema
-- file in packages/db/src/schema/ai-act.ts was later updated to include
-- them. Drizzle .select() emits a SELECT for every declared column, so
-- the query crashed at planning time with `column ... does not exist`.
--
-- Add the missing columns so the schema and DB agree.

ALTER TABLE ai_transparency_entry
  ADD COLUMN IF NOT EXISTS public_url VARCHAR(2000),
  ADD COLUMN IF NOT EXISTS registration_ref VARCHAR(200),
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES "user"(id);
