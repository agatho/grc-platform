-- Sprint 59: Template Library
-- Migration 912: Create template_pack and template_pack_item tables

CREATE TABLE IF NOT EXISTS template_pack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  framework_key VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  category VARCHAR(50) NOT NULL DEFAULT 'compliance',
  item_count INT NOT NULL DEFAULT 0,
  icon_key VARCHAR(50),
  is_default BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX template_pack_framework_idx ON template_pack(framework_key);
CREATE INDEX template_pack_category_idx ON template_pack(category);

CREATE TABLE IF NOT EXISTS template_pack_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES template_pack(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  reference_id VARCHAR(100),
  sort_order INT NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}',
  parent_item_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX template_item_pack_idx ON template_pack_item(pack_id);
CREATE INDEX template_item_entity_idx ON template_pack_item(entity_type);
CREATE INDEX template_item_sort_idx ON template_pack_item(pack_id, sort_order);

-- Seed template packs
INSERT INTO template_pack (key, name, description, framework_key, item_count, is_default) VALUES
  ('iso27001', 'ISO 27001:2022', 'Information Security Management System template pack with all Annex A controls', 'iso27001', 93, true),
  ('nis2', 'NIS2 Directive', 'Network and Information Security Directive compliance template', 'nis2', 45, true),
  ('gdpr', 'GDPR / DSGVO', 'General Data Protection Regulation compliance template', 'gdpr', 52, true),
  ('dora', 'DORA', 'Digital Operational Resilience Act compliance template for financial entities', 'dora', 38, false),
  ('bsi', 'BSI IT-Grundschutz', 'Federal Office for Information Security baseline protection template', 'bsi', 67, true),
  ('soc2', 'SOC 2 Type II', 'Service Organization Control 2 trust services criteria template', 'soc2', 55, false),
  ('tisax', 'TISAX', 'Trusted Information Security Assessment Exchange for automotive industry', 'tisax', 41, false),
  ('marisk', 'MaRisk', 'Minimum Requirements for Risk Management in financial institutions', 'marisk', 48, false),
  ('idwps340', 'IDW PS 340', 'Risk Management Standard for German companies', 'idwps340', 29, false),
  ('csrd', 'CSRD / ESRS', 'Corporate Sustainability Reporting Directive template', 'csrd', 36, false)
ON CONFLICT (key) DO NOTHING;
