-- Sprint 51: EAM AI Assistant — Provider-Agnostic AI Infrastructure
-- Migration 781-800: AI config, prompt templates, suggestion logs, translations, chat, suggestions

-- ──────────────────────────────────────────────────────────────
-- EAM AI Config (encrypted provider config)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_ai_config" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "provider" VARCHAR(30) NOT NULL,
  "config_encrypted" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_validated_at" TIMESTAMP WITH TIME ZONE,
  "validation_status" VARCHAR(20) DEFAULT 'untested',
  "created_by" UUID REFERENCES "user"(id),
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "eaic_org_idx" ON "eam_ai_config" ("org_id");
CREATE UNIQUE INDEX IF NOT EXISTS "eaic_active_idx" ON "eam_ai_config" ("org_id") WHERE is_active = true;

-- ──────────────────────────────────────────────────────────────
-- EAM AI Prompt Template
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_ai_prompt_template" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID REFERENCES "organization"(id),
  "template_key" VARCHAR(50) NOT NULL,
  "template_text" TEXT NOT NULL,
  "variables" JSONB DEFAULT '[]',
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "eapt_key_idx" ON "eam_ai_prompt_template" ("template_key");
CREATE INDEX IF NOT EXISTS "eapt_org_key_idx" ON "eam_ai_prompt_template" ("org_id", "template_key");

-- ──────────────────────────────────────────────────────────────
-- EAM AI Suggestion Log
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_ai_suggestion_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "user_id" UUID NOT NULL REFERENCES "user"(id),
  "feature_key" VARCHAR(50) NOT NULL,
  "suggestion_data" JSONB NOT NULL,
  "action" VARCHAR(20) NOT NULL,
  "provider" VARCHAR(30),
  "model" VARCHAR(100),
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "easl_org_idx" ON "eam_ai_suggestion_log" ("org_id");
CREATE INDEX IF NOT EXISTS "easl_feature_idx" ON "eam_ai_suggestion_log" ("org_id", "feature_key");
CREATE INDEX IF NOT EXISTS "easl_user_idx" ON "eam_ai_suggestion_log" ("user_id");

-- ──────────────────────────────────────────────────────────────
-- EAM Translation
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_translation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "entity_id" UUID NOT NULL,
  "entity_type" VARCHAR(30) NOT NULL,
  "field_name" VARCHAR(50) NOT NULL,
  "language" VARCHAR(10) NOT NULL,
  "translated_text" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ai_translated',
  "translated_by" UUID REFERENCES "user"(id),
  "translated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "etr_entity_idx" ON "eam_translation" ("entity_id", "entity_type", "field_name", "language");
CREATE INDEX IF NOT EXISTS "etr_org_idx" ON "eam_translation" ("org_id");
CREATE INDEX IF NOT EXISTS "etr_status_idx" ON "eam_translation" ("org_id", "status");

-- ──────────────────────────────────────────────────────────────
-- EAM Chat Session
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_chat_session" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "user_id" UUID NOT NULL REFERENCES "user"(id),
  "title" VARCHAR(500),
  "messages" JSONB NOT NULL DEFAULT '[]',
  "provider" VARCHAR(30),
  "model" VARCHAR(100),
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ecs_org_idx" ON "eam_chat_session" ("org_id");
CREATE INDEX IF NOT EXISTS "ecs_user_idx" ON "eam_chat_session" ("user_id");

-- ──────────────────────────────────────────────────────────────
-- EAM Object Suggestion (rule-based, no LLM)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_object_suggestion" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "user_id" UUID NOT NULL REFERENCES "user"(id),
  "entity_id" UUID NOT NULL,
  "entity_type" VARCHAR(30) NOT NULL,
  "reason" VARCHAR(50) NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "dismissed" BOOLEAN NOT NULL DEFAULT false,
  "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "eos_user_idx" ON "eam_object_suggestion" ("user_id", "org_id");
CREATE INDEX IF NOT EXISTS "eos_entity_idx" ON "eam_object_suggestion" ("entity_id");
CREATE INDEX IF NOT EXISTS "eos_dismissed_idx" ON "eam_object_suggestion" ("user_id", "dismissed");

-- ──────────────────────────────────────────────────────────────
-- RLS for all Sprint 51 tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "eam_ai_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eam_ai_prompt_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eam_ai_suggestion_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eam_translation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eam_chat_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eam_object_suggestion" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eaic_org_isolation" ON "eam_ai_config" USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY "eapt_org_isolation" ON "eam_ai_prompt_template" USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY "easl_org_isolation" ON "eam_ai_suggestion_log" USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY "etr_org_isolation" ON "eam_translation" USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY "ecs_org_isolation" ON "eam_chat_session" USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY "eos_org_isolation" ON "eam_object_suggestion" USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────
-- Audit triggers
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER audit_eam_ai_config AFTER INSERT OR UPDATE OR DELETE ON "eam_ai_config" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_eam_ai_prompt_template AFTER INSERT OR UPDATE OR DELETE ON "eam_ai_prompt_template" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_eam_ai_suggestion_log AFTER INSERT OR UPDATE OR DELETE ON "eam_ai_suggestion_log" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_eam_translation AFTER INSERT OR UPDATE OR DELETE ON "eam_translation" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_eam_chat_session AFTER INSERT OR UPDATE OR DELETE ON "eam_chat_session" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_eam_object_suggestion AFTER INSERT OR UPDATE OR DELETE ON "eam_object_suggestion" FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- Seed: system default prompt templates (org_id = NULL)
-- ──────────────────────────────────────────────────────────────

INSERT INTO "eam_ai_prompt_template" (org_id, template_key, template_text, variables) VALUES
(NULL, 'object_generation', 'Generate exactly {count} typical {objectType} entries for a {industry} company. Return ONLY a JSON array. Each entry: {"name": "...", "description": "...", "keywords": ["...", "..."]}. Do NOT include any of these existing objects: {existingObjects}. Focus on real-world applications/capabilities common in {industry}.', '[{"name":"count","type":"number"},{"name":"objectType","type":"string"},{"name":"industry","type":"string"},{"name":"existingObjects","type":"string"}]'),
(NULL, 'description_generation', 'Write a concise 2-3 sentence description for this {objectType}: Name: {name}, Keywords: {keywords}, Connected to: {relationships}. Format: What it does + Who uses it + Key integrations. Language: {language}. Professional tone.', '[{"name":"objectType","type":"string"},{"name":"name","type":"string"},{"name":"keywords","type":"string"},{"name":"relationships","type":"string"},{"name":"language","type":"string"}]'),
(NULL, 'translation', 'Translate the following text to {targetLanguage}. Maintain professional tone and technical terminology. Do not add explanations. Return ONLY the translation. Text: {sourceText}', '[{"name":"targetLanguage","type":"string"},{"name":"sourceText","type":"string"}]'),
(NULL, 'rag_system', 'You are an Enterprise Architecture assistant. Answer based on the provided architecture data. Include risk and compliance information when relevant. Reference specific objects by name. If you cannot answer from the provided data, say so clearly. Format: Answer paragraph + "Detailed information:" section with object references.', '[]')
ON CONFLICT DO NOTHING;
