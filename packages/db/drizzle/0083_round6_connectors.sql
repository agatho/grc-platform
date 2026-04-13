-- Migration 0083: Implementierungsrunde 6 — Enterprise-Konnektoren
-- SAP, Oracle, Workday, Salesforce, Energieversorger, CDP API

-- ──────────────────────────────────────────────────────────────
-- 1. Connector Registry — Zentrale Konnektoren-Verwaltung
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS connector_instance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  connector_type  varchar(50) NOT NULL,
  name            varchar(255) NOT NULL,
  description     text,
  auth_method     varchar(30) NOT NULL DEFAULT 'oauth2',
  config          jsonb NOT NULL DEFAULT '{}',
  credentials_encrypted text,
  sync_direction  varchar(20) NOT NULL DEFAULT 'pull',
  sync_frequency  varchar(20) DEFAULT 'daily',
  last_sync_at    timestamptz,
  last_sync_status varchar(20),
  last_sync_records integer,
  last_error      text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS ci_org_idx ON connector_instance(org_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ci_type_idx ON connector_instance(connector_type);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 2. Connector Sync Log
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS connector_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id    uuid NOT NULL REFERENCES connector_instance(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL,
  sync_type       varchar(20) NOT NULL DEFAULT 'full',
  status          varchar(20) NOT NULL,
  records_pulled  integer DEFAULT 0,
  records_pushed  integer DEFAULT 0,
  records_failed  integer DEFAULT 0,
  error_details   jsonb DEFAULT '[]',
  started_at      timestamptz NOT NULL,
  completed_at    timestamptz,
  duration_ms     integer
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS csl_connector_idx ON connector_sync_log(connector_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS csl_org_idx ON connector_sync_log(org_id, started_at);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 3. Connector Field Mappings
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS connector_field_mapping (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id    uuid NOT NULL REFERENCES connector_instance(id) ON DELETE CASCADE,
  source_field    varchar(255) NOT NULL,
  target_entity   varchar(50) NOT NULL,
  target_field    varchar(100) NOT NULL,
  transformation  varchar(50) DEFAULT 'direct',
  transform_config jsonb DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cfm_connector_idx ON connector_field_mapping(connector_id);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 4. Connector Type Definitions (predefined)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS connector_type_definition (
  connector_type  varchar(50) PRIMARY KEY,
  display_name    varchar(255) NOT NULL,
  display_name_de varchar(255),
  category        varchar(50) NOT NULL,
  description     text,
  description_de  text,
  icon            varchar(50),
  auth_methods    text[] DEFAULT '{oauth2}',
  supported_entities text[] DEFAULT '{}',
  config_schema   jsonb DEFAULT '{}',
  is_available    boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

-- Seed connector types
INSERT INTO connector_type_definition (connector_type, display_name, display_name_de, category, description, description_de, icon, auth_methods, supported_entities) VALUES
  ('sap_erp', 'SAP ERP', 'SAP ERP', 'erp', 'SAP ECC/S4HANA integration for financial data, organizational structure, and master data', 'SAP ECC/S4HANA-Integration für Finanzdaten, Organisationsstruktur und Stammdaten', 'database', '{api_key,oauth2}', '{organization,asset,process,control}'),
  ('oracle_erp', 'Oracle ERP', 'Oracle ERP', 'erp', 'Oracle EBS/Fusion integration for financial and operational data', 'Oracle EBS/Fusion-Integration für Finanz- und Betriebsdaten', 'database', '{oauth2}', '{organization,asset,control}'),
  ('workday', 'Workday', 'Workday', 'hcm', 'Workday HCM integration for workforce data, diversity metrics, and training records', 'Workday HCM-Integration für Personaldaten, Diversitätsmetriken und Schulungsdaten', 'users', '{oauth2}', '{user,organization}'),
  ('salesforce', 'Salesforce', 'Salesforce', 'crm', 'Salesforce CRM integration for customer data and business context', 'Salesforce CRM-Integration für Kundendaten und Geschäftskontext', 'briefcase', '{oauth2}', '{vendor,contract}'),
  ('jira', 'Jira', 'Jira', 'project', 'Atlassian Jira integration for findings, tasks, and issue tracking', 'Atlassian Jira-Integration für Feststellungen, Aufgaben und Issue-Tracking', 'clipboard', '{api_key,oauth2}', '{finding,task}'),
  ('servicenow', 'ServiceNow', 'ServiceNow', 'itsm', 'ServiceNow ITSM integration for incidents, changes, and CMDB', 'ServiceNow ITSM-Integration für Incidents, Changes und CMDB', 'server', '{oauth2}', '{asset,security_incident,finding}'),
  ('azure_ad', 'Microsoft Entra ID', 'Microsoft Entra ID', 'identity', 'Azure AD/Entra ID for user provisioning and access reviews', 'Azure AD/Entra ID für Benutzer-Provisioning und Zugriffsüberprüfungen', 'shield', '{oauth2}', '{user}'),
  ('aws_security_hub', 'AWS Security Hub', 'AWS Security Hub', 'cloud_security', 'AWS Security Hub for cloud security findings and compliance', 'AWS Security Hub für Cloud-Sicherheitsbefunde und Compliance', 'cloud', '{api_key}', '{finding,vulnerability,asset}'),
  ('azure_security_center', 'Azure Security Center', 'Azure Sicherheitscenter', 'cloud_security', 'Azure Defender/Security Center for cloud security posture', 'Azure Defender/Security Center für Cloud-Sicherheitslage', 'cloud', '{oauth2}', '{finding,vulnerability,asset}'),
  ('tenable', 'Tenable', 'Tenable', 'vulnerability', 'Tenable.io/Nessus for vulnerability scanning results', 'Tenable.io/Nessus für Schwachstellen-Scan-Ergebnisse', 'search', '{api_key}', '{vulnerability,asset}'),
  ('qualys', 'Qualys', 'Qualys', 'vulnerability', 'Qualys platform for vulnerability and compliance scanning', 'Qualys-Plattform für Schwachstellen- und Compliance-Scans', 'search', '{api_key}', '{vulnerability,asset}'),
  ('energy_provider', 'Energy Provider API', 'Energieversorger-API', 'utility', 'Automated energy consumption data from utility providers', 'Automatische Energieverbrauchsdaten von Energieversorgern', 'zap', '{api_key}', '{emission_source}'),
  ('cdp_api', 'CDP Submission API', 'CDP-Einreichungs-API', 'esg', 'Direct submission to Carbon Disclosure Project', 'Direkte Einreichung beim Carbon Disclosure Project', 'leaf', '{api_key}', '{esg_measurement}'),
  ('persefoni', 'Persefoni', 'Persefoni', 'carbon', 'Carbon accounting data import from Persefoni', 'CO2-Bilanzierungsdaten-Import aus Persefoni', 'leaf', '{api_key}', '{emission_source,emission_factor}'),
  ('ms_teams', 'Microsoft Teams', 'Microsoft Teams', 'messaging', 'Notifications and alerts to Microsoft Teams channels', 'Benachrichtigungen und Alerts an Microsoft Teams-Kanäle', 'message-square', '{webhook}', '{}'),
  ('slack', 'Slack', 'Slack', 'messaging', 'Notifications and alerts to Slack channels', 'Benachrichtigungen und Alerts an Slack-Kanäle', 'message-square', '{webhook,oauth2}', '{}')
ON CONFLICT (connector_type) DO NOTHING;
