-- Sprint 50: EAM Data Architecture & Scenario Planning
-- Migration 761-780: New tables for data objects, contexts, org units, business contexts

-- ──────────────────────────────────────────────────────────────
-- EAM Data Object
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_data_object" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "parent_id" UUID REFERENCES "eam_data_object"(id),
  "name" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "data_category" VARCHAR(30) NOT NULL,
  "classification" VARCHAR(20) DEFAULT 'internal',
  "owner_application_id" UUID REFERENCES "architecture_element"(id),
  "data_format" VARCHAR(50),
  "volume_estimate" VARCHAR(100),
  "quality_score" INTEGER,
  "retention_period" VARCHAR(50),
  "created_by" UUID REFERENCES "user"(id),
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "edo_org_idx" ON "eam_data_object" ("org_id");
CREATE INDEX IF NOT EXISTS "edo_parent_idx" ON "eam_data_object" ("parent_id");
CREATE INDEX IF NOT EXISTS "edo_owner_idx" ON "eam_data_object" ("owner_application_id");
CREATE INDEX IF NOT EXISTS "edo_category_idx" ON "eam_data_object" ("org_id", "data_category");

-- ──────────────────────────────────────────────────────────────
-- EAM Data Object CRUD Mapping
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_data_object_crud" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "data_object_id" UUID NOT NULL REFERENCES "eam_data_object"(id) ON DELETE CASCADE,
  "application_id" UUID NOT NULL REFERENCES "architecture_element"(id),
  "org_id" UUID NOT NULL,
  "can_create" BOOLEAN NOT NULL DEFAULT false,
  "can_read" BOOLEAN NOT NULL DEFAULT false,
  "can_update" BOOLEAN NOT NULL DEFAULT false,
  "can_delete" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "edoc_unique_idx" ON "eam_data_object_crud" ("data_object_id", "application_id");
CREATE INDEX IF NOT EXISTS "edoc_do_idx" ON "eam_data_object_crud" ("data_object_id");
CREATE INDEX IF NOT EXISTS "edoc_app_idx" ON "eam_data_object_crud" ("application_id");
CREATE INDEX IF NOT EXISTS "edoc_org_idx" ON "eam_data_object_crud" ("org_id");

-- ──────────────────────────────────────────────────────────────
-- EAM Context
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_context" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "name" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "context_type" VARCHAR(20) NOT NULL,
  "valid_from" DATE,
  "valid_to" DATE,
  "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "predecessor_context_id" UUID REFERENCES "eam_context"(id),
  "created_by" UUID REFERENCES "user"(id),
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ectx_org_idx" ON "eam_context" ("org_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ectx_default_idx" ON "eam_context" ("org_id") WHERE is_default = true;
CREATE INDEX IF NOT EXISTS "ectx_type_idx" ON "eam_context" ("org_id", "context_type");

-- ──────────────────────────────────────────────────────────────
-- EAM Context Attribute
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_context_attribute" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "context_id" UUID NOT NULL REFERENCES "eam_context"(id) ON DELETE CASCADE,
  "element_id" UUID NOT NULL REFERENCES "architecture_element"(id),
  "org_id" UUID NOT NULL,
  "functional_fit" VARCHAR(20),
  "technical_fit" VARCHAR(20),
  "time_classification" VARCHAR(20),
  "six_r_strategy" VARCHAR(20),
  "business_criticality" VARCHAR(30),
  "lifecycle_status" VARCHAR(20),
  "notes" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "eca_unique_idx" ON "eam_context_attribute" ("context_id", "element_id");
CREATE INDEX IF NOT EXISTS "eca_ctx_idx" ON "eam_context_attribute" ("context_id");
CREATE INDEX IF NOT EXISTS "eca_elem_idx" ON "eam_context_attribute" ("element_id");
CREATE INDEX IF NOT EXISTS "eca_org_idx" ON "eam_context_attribute" ("org_id");

-- ──────────────────────────────────────────────────────────────
-- EAM Org Unit
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_org_unit" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "parent_org_unit_id" UUID REFERENCES "eam_org_unit"(id),
  "name" VARCHAR(300) NOT NULL,
  "abbreviation" VARCHAR(20),
  "location" VARCHAR(200),
  "head_user_id" UUID REFERENCES "user"(id),
  "head_count" INTEGER,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "eou_org_idx" ON "eam_org_unit" ("org_id");
CREATE INDEX IF NOT EXISTS "eou_parent_idx" ON "eam_org_unit" ("parent_org_unit_id");

-- ──────────────────────────────────────────────────────────────
-- EAM Business Context
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_business_context" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "name" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "capability_id" UUID REFERENCES "business_capability"(id),
  "process_id" UUID REFERENCES "process"(id),
  "org_unit_id" UUID REFERENCES "eam_org_unit"(id),
  "application_ids" UUID[] DEFAULT '{}',
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ebc_org_idx" ON "eam_business_context" ("org_id");
CREATE INDEX IF NOT EXISTS "ebc_cap_idx" ON "eam_business_context" ("capability_id");
CREATE INDEX IF NOT EXISTS "ebc_process_idx" ON "eam_business_context" ("process_id");
CREATE INDEX IF NOT EXISTS "ebc_ou_idx" ON "eam_business_context" ("org_unit_id");

-- ──────────────────────────────────────────────────────────────
-- RLS for all new Sprint 50 tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "eam_data_object" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eam_data_object_crud" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eam_context" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eam_context_attribute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eam_org_unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eam_business_context" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edo_org_isolation" ON "eam_data_object" USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY "edoc_org_isolation" ON "eam_data_object_crud" USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY "ectx_org_isolation" ON "eam_context" USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY "eca_org_isolation" ON "eam_context_attribute" USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY "eou_org_isolation" ON "eam_org_unit" USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY "ebc_org_isolation" ON "eam_business_context" USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────
-- Audit triggers
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER audit_eam_data_object AFTER INSERT OR UPDATE OR DELETE ON "eam_data_object" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_eam_data_object_crud AFTER INSERT OR UPDATE OR DELETE ON "eam_data_object_crud" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_eam_context AFTER INSERT OR UPDATE OR DELETE ON "eam_context" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_eam_context_attribute AFTER INSERT OR UPDATE OR DELETE ON "eam_context_attribute" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_eam_org_unit AFTER INSERT OR UPDATE OR DELETE ON "eam_org_unit" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_eam_business_context AFTER INSERT OR UPDATE OR DELETE ON "eam_business_context" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
