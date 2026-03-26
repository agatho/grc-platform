CREATE TABLE "ai_prompt_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"prompt_template" varchar(100) NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"model" varchar(50) NOT NULL,
	"latency_ms" integer NOT NULL,
	"cost_usd" numeric(10, 6),
	"cached_result" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_effectiveness_score" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"test_score_avg" numeric(5, 2),
	"overdue_penalty" numeric(5, 2),
	"finding_penalty" numeric(5, 2),
	"automation_bonus" numeric(5, 2),
	"open_findings_count" integer DEFAULT 0,
	"last_test_at" timestamp with time zone,
	"last_computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trend" varchar(20) DEFAULT 'stable',
	"previous_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executive_kpi_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"kpis" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finding_sla_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"severity" varchar(50) NOT NULL,
	"sla_days" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulatory_feed_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"summary" text,
	"url" varchar(1000),
	"published_at" timestamp with time zone NOT NULL,
	"category" varchar(100),
	"jurisdictions" text[],
	"frameworks" text[],
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulatory_relevance_score" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_item_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"relevance_score" integer NOT NULL,
	"reasoning" text,
	"affected_modules" text[],
	"is_notified" boolean DEFAULT false,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_prompt_log" ADD CONSTRAINT "ai_prompt_log_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompt_log" ADD CONSTRAINT "ai_prompt_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_effectiveness_score" ADD CONSTRAINT "control_effectiveness_score_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_effectiveness_score" ADD CONSTRAINT "control_effectiveness_score_control_id_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."control"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executive_kpi_snapshot" ADD CONSTRAINT "executive_kpi_snapshot_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_sla_config" ADD CONSTRAINT "finding_sla_config_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_relevance_score" ADD CONSTRAINT "regulatory_relevance_score_feed_item_id_regulatory_feed_item_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."regulatory_feed_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_relevance_score" ADD CONSTRAINT "regulatory_relevance_score_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apl_org_idx" ON "ai_prompt_log" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "apl_user_idx" ON "ai_prompt_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "apl_created_idx" ON "ai_prompt_log" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ces_control_idx" ON "control_effectiveness_score" USING btree ("org_id","control_id");--> statement-breakpoint
CREATE INDEX "ces_score_idx" ON "control_effectiveness_score" USING btree ("org_id","score");--> statement-breakpoint
CREATE UNIQUE INDEX "eks_org_date_idx" ON "executive_kpi_snapshot" USING btree ("org_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "fsc_org_severity_idx" ON "finding_sla_config" USING btree ("org_id","severity");--> statement-breakpoint

-- ─── CHECK CONSTRAINTS ──────────────────────────────────────────
ALTER TABLE "control_effectiveness_score" ADD CONSTRAINT "ces_score_range" CHECK (score >= 0 AND score <= 100);--> statement-breakpoint
ALTER TABLE "regulatory_relevance_score" ADD CONSTRAINT "rrs_score_range" CHECK (relevance_score >= 0 AND relevance_score <= 100);--> statement-breakpoint

-- ─── ROW-LEVEL SECURITY (ADR-001) ──────────────────────────────
-- RLS on all tables with org_id. NOT on regulatory_feed_item (platform-wide).
ALTER TABLE "control_effectiveness_score" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finding_sla_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "regulatory_relevance_score" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_prompt_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "executive_kpi_snapshot" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY org_isolation ON "control_effectiveness_score"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "finding_sla_config"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "regulatory_relevance_score"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "ai_prompt_log"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "executive_kpi_snapshot"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

-- ─── set_updated_at TRIGGER ─────────────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "control_effectiveness_score"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- ─── SEED: Default finding SLA configs for all existing orgs ────
-- significant=30, insignificant=60, improvement=90
INSERT INTO "finding_sla_config" ("org_id", "severity", "sla_days")
SELECT o.id, s.severity, s.sla_days
FROM "organization" o
CROSS JOIN (
  VALUES
    ('significant_nonconformity', 30),
    ('insignificant_nonconformity', 60),
    ('improvement_requirement', 90)
) AS s(severity, sla_days)
ON CONFLICT (org_id, severity) DO NOTHING;