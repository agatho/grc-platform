-- Sprint 36: Enterprise Architecture Management (EAM) Foundation
-- Tables: architecture_element, architecture_relationship, business_capability,
--         application_portfolio, architecture_rule, architecture_rule_violation
-- Migration range: 449-468

-- ──────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────
CREATE TYPE "public"."architecture_layer" AS ENUM('business', 'application', 'technology');
--> statement-breakpoint
CREATE TYPE "public"."architecture_type" AS ENUM('business_capability', 'business_service', 'business_function', 'application', 'app_service', 'app_interface', 'app_component', 'data_object', 'server', 'network', 'cloud_service', 'database', 'infrastructure_service');
--> statement-breakpoint
CREATE TYPE "public"."arch_relationship_type" AS ENUM('realizes', 'serves', 'runs_on', 'accesses', 'flows_to', 'composes', 'depends_on', 'deployed_on', 'uses');

-- ──────────────────────────────────────────────────────────────
-- Architecture Element
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "architecture_element" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "name" varchar(500) NOT NULL,
  "description" text,
  "layer" "architecture_layer" NOT NULL,
  "type" "architecture_type" NOT NULL,
  "asset_id" uuid REFERENCES "asset"("id"),
  "process_id" uuid REFERENCES "process"("id"),
  "owner" uuid REFERENCES "user"("id"),
  "department" varchar(200),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "criticality" varchar(20) DEFAULT 'normal',
  "tags" text[],
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "architecture_element_org_idx" ON "architecture_element" ("org_id");
--> statement-breakpoint
CREATE INDEX "architecture_element_layer_idx" ON "architecture_element" ("org_id", "layer");
--> statement-breakpoint
CREATE INDEX "architecture_element_type_idx" ON "architecture_element" ("org_id", "type");
--> statement-breakpoint
CREATE INDEX "architecture_element_asset_idx" ON "architecture_element" ("asset_id");
--> statement-breakpoint
CREATE INDEX "architecture_element_status_idx" ON "architecture_element" ("org_id", "status");

-- ──────────────────────────────────────────────────────────────
-- Architecture Relationship
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "architecture_relationship" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "source_id" uuid NOT NULL REFERENCES "architecture_element"("id") ON DELETE CASCADE,
  "target_id" uuid NOT NULL REFERENCES "architecture_element"("id") ON DELETE CASCADE,
  "relationship_type" "arch_relationship_type" NOT NULL,
  "criticality" varchar(20) DEFAULT 'normal',
  "data_flow_direction" varchar(20),
  "description" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "archrel_org_idx" ON "architecture_relationship" ("org_id");
--> statement-breakpoint
CREATE INDEX "archrel_source_idx" ON "architecture_relationship" ("source_id");
--> statement-breakpoint
CREATE INDEX "archrel_target_idx" ON "architecture_relationship" ("target_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "archrel_unique_idx" ON "architecture_relationship" ("source_id", "target_id", "relationship_type");

-- ──────────────────────────────────────────────────────────────
-- Business Capability (hierarchical)
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "business_capability" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "element_id" uuid NOT NULL REFERENCES "architecture_element"("id") ON DELETE CASCADE,
  "parent_id" uuid REFERENCES "business_capability"("id"),
  "level" integer NOT NULL DEFAULT 1,
  "sort_order" integer NOT NULL DEFAULT 0,
  "maturity_level" integer,
  "strategic_importance" varchar(20)
);
--> statement-breakpoint
CREATE INDEX "bc_org_idx" ON "business_capability" ("org_id");
--> statement-breakpoint
CREATE INDEX "bc_parent_idx" ON "business_capability" ("parent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "bc_element_idx" ON "business_capability" ("element_id");

-- ──────────────────────────────────────────────────────────────
-- Application Portfolio
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "application_portfolio" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "element_id" uuid NOT NULL REFERENCES "architecture_element"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "vendor_name" varchar(500),
  "vendor_id" uuid,
  "version" varchar(100),
  "license_type" varchar(50),
  "planned_introduction" date,
  "go_live_date" date,
  "planned_eol" date,
  "lifecycle_status" varchar(20) NOT NULL DEFAULT 'active',
  "time_classification" varchar(20),
  "business_value" integer,
  "technical_condition" integer,
  "annual_cost" numeric(15,2),
  "user_count" integer,
  "cost_center" varchar(100),
  "has_api" boolean DEFAULT false,
  "auth_method" varchar(50),
  "data_classification" varchar(20)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ap_element_idx" ON "application_portfolio" ("element_id");
--> statement-breakpoint
CREATE INDEX "ap_org_idx" ON "application_portfolio" ("org_id");
--> statement-breakpoint
CREATE INDEX "ap_lifecycle_idx" ON "application_portfolio" ("org_id", "lifecycle_status");
--> statement-breakpoint
CREATE INDEX "ap_eol_idx" ON "application_portfolio" ("org_id", "planned_eol");

-- ──────────────────────────────────────────────────────────────
-- Architecture Rule
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "architecture_rule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "name" varchar(500) NOT NULL,
  "description" text,
  "rule_type" varchar(50) NOT NULL,
  "condition" jsonb NOT NULL,
  "severity" varchar(20) NOT NULL DEFAULT 'warning',
  "is_active" boolean NOT NULL DEFAULT true,
  "last_evaluated_at" timestamp with time zone,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "archrule_org_idx" ON "architecture_rule" ("org_id");
--> statement-breakpoint
CREATE INDEX "archrule_active_idx" ON "architecture_rule" ("org_id", "is_active");

-- ──────────────────────────────────────────────────────────────
-- Architecture Rule Violation
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "architecture_rule_violation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rule_id" uuid NOT NULL REFERENCES "architecture_rule"("id") ON DELETE CASCADE,
  "element_id" uuid NOT NULL REFERENCES "architecture_element"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL,
  "violation_detail" text,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "status" varchar(20) NOT NULL DEFAULT 'open',
  "acknowledged_by" uuid REFERENCES "user"("id"),
  "acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "archviol_org_idx" ON "architecture_rule_violation" ("org_id");
--> statement-breakpoint
CREATE INDEX "archviol_rule_idx" ON "architecture_rule_violation" ("rule_id");
--> statement-breakpoint
CREATE INDEX "archviol_element_idx" ON "architecture_rule_violation" ("element_id");
--> statement-breakpoint
CREATE INDEX "archviol_status_idx" ON "architecture_rule_violation" ("org_id", "status");

-- ──────────────────────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
ALTER TABLE "architecture_element" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "arch_element_org_isolation" ON "architecture_element" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "architecture_relationship" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "arch_rel_org_isolation" ON "architecture_relationship" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "business_capability" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "bus_cap_org_isolation" ON "business_capability" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "application_portfolio" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "app_portfolio_org_isolation" ON "application_portfolio" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "architecture_rule" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "arch_rule_org_isolation" ON "architecture_rule" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "architecture_rule_violation" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "arch_viol_org_isolation" ON "architecture_rule_violation" USING (org_id::text = current_setting('app.current_org_id', true));

-- ──────────────────────────────────────────────────────────────
-- Audit Triggers
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TRIGGER "architecture_element_audit" AFTER INSERT OR UPDATE OR DELETE ON "architecture_element" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "architecture_relationship_audit" AFTER INSERT OR UPDATE OR DELETE ON "architecture_relationship" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "business_capability_audit" AFTER INSERT OR UPDATE OR DELETE ON "business_capability" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "application_portfolio_audit" AFTER INSERT OR UPDATE OR DELETE ON "application_portfolio" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "architecture_rule_audit" AFTER INSERT OR UPDATE OR DELETE ON "architecture_rule" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "architecture_rule_violation_audit" AFTER INSERT OR UPDATE OR DELETE ON "architecture_rule_violation" FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- Entity Reference Sync Trigger (architecture_relationship → entity_reference)
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sync_arch_rel_to_entity_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
    SELECT NEW.org_id,
           (SELECT type::text FROM architecture_element WHERE id = NEW.source_id),
           NEW.source_id,
           (SELECT type::text FROM architecture_element WHERE id = NEW.target_id),
           NEW.target_id,
           NEW.relationship_type::text
    ON CONFLICT DO NOTHING;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM entity_reference WHERE source_id = OLD.source_id AND target_id = OLD.target_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "arch_rel_entity_ref_sync" AFTER INSERT OR DELETE ON "architecture_relationship" FOR EACH ROW EXECUTE FUNCTION sync_arch_rel_to_entity_ref();
