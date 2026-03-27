-- Sprint 18: Custom Dashboards (Drag-and-Drop)
-- Migrations 277-285: widget_definition, custom_dashboard, custom_dashboard_widget,
-- RLS, audit triggers, seed widget definitions, seed default dashboards

-- ──────────────────────────────────────────────────────────────
-- 277: widget_definition — Widget type catalog
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "widget_definition" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(50) NOT NULL UNIQUE,
  "name_de" varchar(200) NOT NULL,
  "name_en" varchar(200) NOT NULL,
  "description_de" text,
  "description_en" text,
  "type" varchar(20) NOT NULL,
  "default_config" jsonb NOT NULL,
  "min_width" integer NOT NULL DEFAULT 2,
  "min_height" integer NOT NULL DEFAULT 2,
  "max_width" integer DEFAULT 12,
  "max_height" integer DEFAULT 8,
  "required_permissions" text[],
  "preview_image_url" varchar(500),
  "is_active" boolean NOT NULL DEFAULT true
);--> statement-breakpoint

CREATE UNIQUE INDEX "wd_key_idx" ON "widget_definition" USING btree ("key");--> statement-breakpoint
CREATE INDEX "wd_type_idx" ON "widget_definition" USING btree ("type");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 278: custom_dashboard — User/team dashboards with layout JSON
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "custom_dashboard" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "user_id" uuid REFERENCES "user"("id"),
  "name" varchar(500) NOT NULL,
  "description" text,
  "visibility" varchar(20) NOT NULL DEFAULT 'personal',
  "layout_json" jsonb NOT NULL DEFAULT '[]',
  "is_default" boolean NOT NULL DEFAULT false,
  "is_favorite" boolean NOT NULL DEFAULT false,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint

CREATE INDEX "cd_org_idx" ON "custom_dashboard" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "cd_user_idx" ON "custom_dashboard" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cd_default_idx" ON "custom_dashboard" USING btree ("org_id", "is_default");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 279: custom_dashboard_widget — Widget instances with config
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "custom_dashboard_widget" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dashboard_id" uuid NOT NULL REFERENCES "custom_dashboard"("id") ON DELETE CASCADE,
  "widget_definition_id" uuid NOT NULL REFERENCES "widget_definition"("id"),
  "position_json" jsonb NOT NULL,
  "config_json" jsonb NOT NULL DEFAULT '{}',
  "sort_order" integer NOT NULL DEFAULT 0
);--> statement-breakpoint

CREATE INDEX "cdw_dashboard_idx" ON "custom_dashboard_widget" USING btree ("dashboard_id");--> statement-breakpoint
CREATE INDEX "cdw_definition_idx" ON "custom_dashboard_widget" USING btree ("widget_definition_id");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 280: RLS on Sprint 18 tables
-- ──────────────────────────────────────────────────────────────

-- custom_dashboard: isolate by org_id
ALTER TABLE "custom_dashboard" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "cd_org_isolation" ON "custom_dashboard"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

CREATE POLICY "cd_insert_policy" ON "custom_dashboard"
  FOR INSERT WITH CHECK ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

-- custom_dashboard_widget: inherits through dashboard_id join
-- No direct org_id — security enforced by dashboard access check in API layer
-- Widget_definition: global catalog, no RLS needed (read-only for all)

-- ──────────────────────────────────────────────────────────────
-- 281: Audit triggers on Sprint 18 tables
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER "custom_dashboard_audit_trigger"
  AFTER INSERT OR UPDATE OR DELETE ON "custom_dashboard"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

CREATE TRIGGER "custom_dashboard_widget_audit_trigger"
  AFTER INSERT OR UPDATE OR DELETE ON "custom_dashboard_widget"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 282: Seed Widget Definitions (~20)
-- ──────────────────────────────────────────────────────────────

INSERT INTO "widget_definition" ("key", "name_de", "name_en", "description_de", "description_en", "type", "default_config", "min_width", "min_height", "max_width", "max_height") VALUES
-- KPI Type (5)
('kpi_risk_count', 'Risikoanzahl', 'Risk Count', 'Gesamtanzahl offener Risiken', 'Total open risk count', 'kpi',
  '{"dataSource": "/api/v1/erm/dashboard/risk-count", "filters": {}, "displayOptions": {"color": "#EF4444", "showTrend": true}}',
  2, 2, 4, 4),
('kpi_open_findings', 'Offene Feststellungen', 'Open Findings', 'Anzahl offener Feststellungen', 'Number of open findings', 'kpi',
  '{"dataSource": "/api/v1/ics/dashboard/open-findings", "filters": {}, "displayOptions": {"color": "#F97316", "showTrend": true}}',
  2, 2, 4, 4),
('kpi_avg_ces', 'Durchschnittlicher CES', 'Average CES', 'Durchschnittlicher Control Effectiveness Score', 'Average Control Effectiveness Score', 'kpi',
  '{"dataSource": "/api/v1/ics/ces/overview", "filters": {}, "displayOptions": {"color": "#3B82F6", "showTrend": true}}',
  2, 2, 4, 4),
('kpi_audit_sla', 'Audit-SLA', 'Audit SLA', 'SLA-Einhaltung der Audits', 'Audit SLA compliance rate', 'kpi',
  '{"dataSource": "/api/v1/audit/dashboard/sla-compliance", "filters": {}, "displayOptions": {"color": "#10B981", "showTrend": true}}',
  2, 2, 4, 4),
('kpi_dsr_sla', 'DSR-SLA', 'DSR SLA', 'Betroffenenanfragen SLA-Einhaltung', 'Data subject request SLA compliance', 'kpi',
  '{"dataSource": "/api/v1/dpms/dashboard/dsr-sla", "filters": {}, "displayOptions": {"color": "#8B5CF6", "showTrend": true}}',
  2, 2, 4, 4),

-- Chart Type (5)
('chart_risk_distribution', 'Risikoverteilung', 'Risk Distribution', 'Verteilung der Risiken nach Kategorie', 'Risk distribution by category', 'chart',
  '{"dataSource": "/api/v1/erm/dashboard/risk-distribution", "filters": {}, "displayOptions": {"chartType": "donut"}}',
  4, 3, 8, 6),
('chart_ces_trend', 'CES-Trend', 'CES Trend', 'Control Effectiveness Score Verlauf', 'Control Effectiveness Score trend over time', 'chart',
  '{"dataSource": "/api/v1/ics/ces/trend", "filters": {}, "displayOptions": {"chartType": "line"}}',
  4, 3, 12, 6),
('chart_finding_aging', 'Feststellungen Alter', 'Finding Aging', 'Alterverteilung offener Feststellungen', 'Age distribution of open findings', 'chart',
  '{"dataSource": "/api/v1/ics/findings/analytics/aging", "filters": {}, "displayOptions": {"chartType": "bar"}}',
  4, 3, 8, 6),
('chart_kri_trend', 'KRI-Trend', 'KRI Trend', 'Risikoindikatoren Zeitverlauf', 'Key Risk Indicator trend over time', 'chart',
  '{"dataSource": "/api/v1/erm/dashboard/kri-trend", "filters": {}, "displayOptions": {"chartType": "line"}}',
  4, 3, 12, 6),
('chart_incident_monthly', 'Monatliche Vorfaelle', 'Monthly Incidents', 'Vorfaelle pro Monat', 'Incidents per month', 'chart',
  '{"dataSource": "/api/v1/isms/dashboard/incidents-monthly", "filters": {}, "displayOptions": {"chartType": "bar"}}',
  4, 3, 8, 6),

-- Table Type (4)
('table_top_risks', 'Top-Risiken', 'Top Risks', 'Die wichtigsten Risiken nach Bewertung', 'Top risks by assessment score', 'table',
  '{"dataSource": "/api/v1/erm/dashboard/top-risks", "filters": {}, "displayOptions": {"limit": 10}}',
  4, 3, 12, 8),
('table_overdue_tasks', 'Ueberfaellige Aufgaben', 'Overdue Tasks', 'Liste ueberfaelliger Aufgaben', 'List of overdue tasks', 'table',
  '{"dataSource": "/api/v1/tasks/overdue", "filters": {}, "displayOptions": {"limit": 10}}',
  4, 3, 12, 8),
('table_expiring_contracts', 'Auslaufende Vertraege', 'Expiring Contracts', 'Bald auslaufende Vertraege', 'Contracts expiring soon', 'table',
  '{"dataSource": "/api/v1/contracts/expiring", "filters": {}, "displayOptions": {"limit": 10}}',
  4, 3, 12, 8),
('table_recent_findings', 'Neueste Feststellungen', 'Recent Findings', 'Zuletzt erstellte Feststellungen', 'Most recently created findings', 'table',
  '{"dataSource": "/api/v1/ics/findings/recent", "filters": {}, "displayOptions": {"limit": 10}}',
  4, 3, 12, 8),

-- Special Type (6)
('special_risk_heatmap', 'Risiko-Heatmap', 'Risk Heatmap', 'Risikomatrix als Heatmap', 'Risk matrix as heatmap', 'special',
  '{"dataSource": "/api/v1/erm/dashboard/heatmap", "filters": {}, "displayOptions": {}}',
  4, 4, 8, 8),
('special_compliance_calendar', 'Compliance-Kalender', 'Compliance Calendar', 'Bevorstehende Compliance-Termine', 'Upcoming compliance deadlines', 'special',
  '{"dataSource": "/api/v1/calendar/upcoming", "filters": {}, "displayOptions": {"limit": 5}}',
  4, 3, 8, 6),
('special_assurance_radar', 'Assurance-Radar', 'Assurance Radar', 'Bewertung der Assurance-Funktionen', 'Assurance function score overview', 'special',
  '{"dataSource": "/api/v1/assurance/scores", "filters": {}, "displayOptions": {}}',
  4, 4, 8, 8),
('special_posture_gauge', 'Sicherheitslage', 'Security Posture', 'Gesamtbewertung der Sicherheitslage', 'Overall security posture gauge', 'special',
  '{"dataSource": "/api/v1/isms/posture", "filters": {}, "displayOptions": {}}',
  3, 3, 6, 6),
('special_appetite_bars', 'Risikoappetit', 'Risk Appetite', 'Risikoappetit vs. aktuelles Risiko', 'Risk appetite vs. current risk level', 'special',
  '{"dataSource": "/api/v1/erm/risk-appetite/dashboard", "filters": {}, "displayOptions": {}}',
  4, 3, 8, 6),
('special_budget_burnrate', 'Budget-Burn-Rate', 'Budget Burn Rate', 'GRC-Budget Verbrauchsrate', 'GRC budget consumption rate', 'special',
  '{"dataSource": "/api/v1/budget/burn-rate", "filters": {}, "displayOptions": {}}',
  3, 3, 6, 6);--> statement-breakpoint
