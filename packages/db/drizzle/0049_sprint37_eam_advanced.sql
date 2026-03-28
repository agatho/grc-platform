-- Sprint 37: EAM Advanced — Data Flows, Interfaces, Tech Radar, Change Requests, Health, Cloud
-- Tables: data_flow, application_interface, technology_entry, technology_application_link,
--         architecture_change_request, architecture_change_vote, architecture_health_snapshot, cloud_service_catalog
-- Migration range: 469-490

-- ──────────────────────────────────────────────────────────────
-- Data Flow
-- ──────────────────────────────────────────────────────────────
CREATE TABLE "data_flow" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "source_element_id" uuid NOT NULL REFERENCES "architecture_element"("id"),
  "target_element_id" uuid NOT NULL REFERENCES "architecture_element"("id"),
  "name" varchar(500) NOT NULL,
  "description" text,
  "data_categories" text[] NOT NULL,
  "contains_personal_data" boolean NOT NULL DEFAULT false,
  "transfer_mechanism" varchar(50) NOT NULL,
  "encryption_in_transit" varchar(20) DEFAULT 'tls',
  "encryption_at_rest" varchar(20) DEFAULT 'aes256',
  "frequency" varchar(20) NOT NULL,
  "volume_per_day" varchar(100),
  "hosting_source" varchar(5),
  "hosting_target" varchar(5),
  "crosses_eu_border" boolean NOT NULL DEFAULT false,
  "legal_basis" varchar(50),
  "schrems_ii_safeguard" varchar(50),
  "ropa_entry_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "df_org_idx" ON "data_flow" ("org_id");
--> statement-breakpoint
CREATE INDEX "df_source_idx" ON "data_flow" ("source_element_id");
--> statement-breakpoint
CREATE INDEX "df_target_idx" ON "data_flow" ("target_element_id");
--> statement-breakpoint
CREATE INDEX "df_personal_idx" ON "data_flow" ("org_id", "contains_personal_data");
--> statement-breakpoint
CREATE INDEX "df_cross_border_idx" ON "data_flow" ("org_id", "crosses_eu_border");

-- ──────────────────────────────────────────────────────────────
-- Application Interface
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "application_interface" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "element_id" uuid NOT NULL REFERENCES "architecture_element"("id") ON DELETE CASCADE,
  "name" varchar(500) NOT NULL,
  "description" text,
  "interface_type" varchar(30) NOT NULL,
  "direction" varchar(20) NOT NULL,
  "protocol" varchar(30),
  "authentication" varchar(30),
  "data_format" varchar(20),
  "sla_availability" numeric(5,2),
  "documentation_url" varchar(2000),
  "health_check_url" varchar(2000),
  "health_status" varchar(20) DEFAULT 'unknown',
  "last_health_check" timestamp with time zone,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_element_idx" ON "application_interface" ("element_id");
--> statement-breakpoint
CREATE INDEX "appintf_org_idx" ON "application_interface" ("org_id");
--> statement-breakpoint
CREATE INDEX "ai_health_idx" ON "application_interface" ("org_id", "health_status");

-- ──────────────────────────────────────────────────────────────
-- Technology Entry (Radar)
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "technology_entry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "name" varchar(300) NOT NULL,
  "category" varchar(30) NOT NULL,
  "quadrant" varchar(30) NOT NULL,
  "ring" varchar(20) NOT NULL,
  "version_in_use" varchar(100),
  "latest_version" varchar(100),
  "vendor" varchar(300),
  "description" text,
  "rationale" text,
  "moved_from" varchar(20),
  "moved_at" timestamp with time zone,
  "website_url" varchar(2000),
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "te_org_idx" ON "technology_entry" ("org_id");
--> statement-breakpoint
CREATE INDEX "te_ring_idx" ON "technology_entry" ("org_id", "ring");
--> statement-breakpoint
CREATE INDEX "te_category_idx" ON "technology_entry" ("org_id", "category");

-- ──────────────────────────────────────────────────────────────
-- Technology ↔ Application Link
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "technology_application_link" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "technology_id" uuid NOT NULL REFERENCES "technology_entry"("id") ON DELETE CASCADE,
  "element_id" uuid NOT NULL REFERENCES "architecture_element"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL,
  "version_used" varchar(100),
  "notes" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tal_unique_idx" ON "technology_application_link" ("technology_id", "element_id");
--> statement-breakpoint
CREATE INDEX "tal_tech_idx" ON "technology_application_link" ("technology_id");
--> statement-breakpoint
CREATE INDEX "tal_element_idx" ON "technology_application_link" ("element_id");

-- ──────────────────────────────────────────────────────────────
-- Architecture Change Request
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "architecture_change_request" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "title" varchar(500) NOT NULL,
  "description" text NOT NULL,
  "justification" text,
  "change_type" varchar(30) NOT NULL,
  "affected_element_ids" uuid[] NOT NULL DEFAULT '{}',
  "risk_assessment" varchar(20) DEFAULT 'medium',
  "cost_estimate" numeric(15,2),
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "submitted_by" uuid REFERENCES "user"("id"),
  "submitted_at" timestamp with time zone,
  "reviewed_by" uuid REFERENCES "user"("id"),
  "reviewed_at" timestamp with time zone,
  "decision_rationale" text,
  "conditions" text,
  "implementation_deadline" date,
  "impact_summary" jsonb DEFAULT '{}'::jsonb,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "acr_org_idx" ON "architecture_change_request" ("org_id");
--> statement-breakpoint
CREATE INDEX "acr_status_idx" ON "architecture_change_request" ("org_id", "status");

-- ──────────────────────────────────────────────────────────────
-- Architecture Change Vote
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "architecture_change_vote" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "change_request_id" uuid NOT NULL REFERENCES "architecture_change_request"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "user"("id"),
  "vote" varchar(20) NOT NULL,
  "comment" text,
  "voted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "acv_unique_idx" ON "architecture_change_vote" ("change_request_id", "user_id");

-- ──────────────────────────────────────────────────────────────
-- Architecture Health Snapshot
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "architecture_health_snapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "overall_score" integer NOT NULL,
  "portfolio_age_score" integer,
  "technology_currency_score" integer,
  "integration_complexity_score" integer,
  "spof_count" integer,
  "rule_violations" integer,
  "data_flow_compliance_score" integer,
  "technical_debt_eur" numeric(15,2),
  "factor_breakdown" jsonb DEFAULT '{}'::jsonb,
  "snapshot_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ahs_org_idx" ON "architecture_health_snapshot" ("org_id");
--> statement-breakpoint
CREATE INDEX "ahs_date_idx" ON "architecture_health_snapshot" ("org_id", "snapshot_at");

-- ──────────────────────────────────────────────────────────────
-- Cloud Service Catalog (seed-only, read-only)
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "cloud_service_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(20) NOT NULL,
  "service_name" varchar(200) NOT NULL,
  "category" varchar(50) NOT NULL,
  "description" text,
  "architecture_type" varchar(30) NOT NULL,
  "region_availability" text[]
);
--> statement-breakpoint
CREATE INDEX "csc_provider_idx" ON "cloud_service_catalog" ("provider");
--> statement-breakpoint
CREATE INDEX "csc_category_idx" ON "cloud_service_catalog" ("provider", "category");

-- ──────────────────────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
ALTER TABLE "data_flow" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "data_flow_org_isolation" ON "data_flow" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "application_interface" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "app_interface_org_isolation" ON "application_interface" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "technology_entry" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tech_entry_org_isolation" ON "technology_entry" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "technology_application_link" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tech_app_link_org_isolation" ON "technology_application_link" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "architecture_change_request" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "acr_org_isolation" ON "architecture_change_request" USING (org_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "architecture_health_snapshot" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ahs_org_isolation" ON "architecture_health_snapshot" USING (org_id::text = current_setting('app.current_org_id', true));

-- ──────────────────────────────────────────────────────────────
-- Audit Triggers
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE TRIGGER "data_flow_audit" AFTER INSERT OR UPDATE OR DELETE ON "data_flow" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "application_interface_audit" AFTER INSERT OR UPDATE OR DELETE ON "application_interface" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "technology_entry_audit" AFTER INSERT OR UPDATE OR DELETE ON "technology_entry" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "architecture_change_request_audit" AFTER INSERT OR UPDATE OR DELETE ON "architecture_change_request" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
--> statement-breakpoint
CREATE TRIGGER "architecture_change_vote_audit" AFTER INSERT OR UPDATE OR DELETE ON "architecture_change_vote" FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- Cross-border Detection Trigger
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE OR REPLACE FUNCTION detect_cross_border_data_flow()
RETURNS TRIGGER AS $$
DECLARE
  eu_eea_countries text[] := ARRAY['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO'];
  adequacy_countries text[] := ARRAY['AD','AR','CA','FO','GG','IL','IM','JP','JE','NZ','KR','CH','UY','UK','US'];
  source_in_eu boolean;
  target_in_eu boolean;
BEGIN
  IF NEW.hosting_source IS NOT NULL AND NEW.hosting_target IS NOT NULL THEN
    source_in_eu := NEW.hosting_source = ANY(eu_eea_countries);
    target_in_eu := NEW.hosting_target = ANY(eu_eea_countries);
    NEW.crosses_eu_border := source_in_eu AND NOT target_in_eu;
  ELSE
    NEW.crosses_eu_border := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "data_flow_cross_border" BEFORE INSERT OR UPDATE ON "data_flow" FOR EACH ROW EXECUTE FUNCTION detect_cross_border_data_flow();

-- ──────────────────────────────────────────────────────────────
-- Data Flow → Entity Reference Sync
-- ──────────────────────────────────────────────────────────────
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sync_data_flow_to_entity_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
    VALUES (NEW.org_id, 'data_flow', NEW.source_element_id, 'data_flow', NEW.target_element_id, 'data_flow')
    ON CONFLICT DO NOTHING;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM entity_reference WHERE source_id = OLD.source_element_id AND target_id = OLD.target_element_id AND relationship = 'data_flow';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "data_flow_entity_ref_sync" AFTER INSERT OR DELETE ON "data_flow" FOR EACH ROW EXECUTE FUNCTION sync_data_flow_to_entity_ref();
