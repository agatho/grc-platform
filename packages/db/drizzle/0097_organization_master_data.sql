-- Migration 0097: Organization Master Data Enhancement
-- Erweitert organization-Tabelle um Stammdaten, Compliance-Status, Finanzdaten
-- Fuegt organization_contact Tabelle fuer strukturierte Ansprechpartner hinzu

-- ============================================================
-- 1. Neue Spalten auf organization
-- ============================================================

-- Identifikatoren
ALTER TABLE organization ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS lei VARCHAR(20);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS duns VARCHAR(9);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS registration_number VARCHAR(50);

-- Adresse (strukturiert)
ALTER TABLE organization ADD COLUMN IF NOT EXISTS street VARCHAR(200);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS zip VARCHAR(20);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS country_code CHAR(2);

-- Kontakt
ALTER TABLE organization ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS website VARCHAR(500);

-- Klassifikation
ALTER TABLE organization ADD COLUMN IF NOT EXISTS nace_code VARCHAR(10);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS employee_count INTEGER;
ALTER TABLE organization ADD COLUMN IF NOT EXISTS revenue_eur NUMERIC(15,2);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS total_assets_eur NUMERIC(15,2);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS is_listed BOOLEAN DEFAULT false;
ALTER TABLE organization ADD COLUMN IF NOT EXISTS stock_exchange VARCHAR(50);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS ticker_symbol VARCHAR(10);

-- Compliance-Status
ALTER TABLE organization ADD COLUMN IF NOT EXISTS is_kritis BOOLEAN DEFAULT false;
ALTER TABLE organization ADD COLUMN IF NOT EXISTS kritis_sector VARCHAR(50);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS nis2_category VARCHAR(20); -- 'essential' | 'important' | 'none'
ALTER TABLE organization ADD COLUMN IF NOT EXISTS csrd_reporting BOOLEAN DEFAULT false;
ALTER TABLE organization ADD COLUMN IF NOT EXISTS lksg_applicable BOOLEAN DEFAULT false;
ALTER TABLE organization ADD COLUMN IF NOT EXISTS certifications TEXT[]; -- ISO 27001, 9001, 14001, etc.
ALTER TABLE organization ADD COLUMN IF NOT EXISTS regulated_by TEXT[]; -- BaFin, BNetzA, etc.

-- Temporale Daten
ALTER TABLE organization ADD COLUMN IF NOT EXISTS founding_date DATE;
ALTER TABLE organization ADD COLUMN IF NOT EXISTS fiscal_year_end VARCHAR(5); -- MM-DD (z.B. '12-31')

-- ============================================================
-- 2. Neue Tabelle: organization_contact
-- ============================================================

CREATE TABLE IF NOT EXISTS organization_contact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,

  -- Rolle
  role_type VARCHAR(50) NOT NULL CHECK (role_type IN (
    'ceo', 'cfo', 'coo', 'cto',
    'dpo', 'ciso', 'compliance_officer', 'risk_manager',
    'whistleblowing_officer', 'audit_coordinator',
    'legal_representative', 'works_council',
    'external_auditor', 'other'
  )),
  role_custom VARCHAR(100),  -- falls role_type = 'other'

  -- Personendaten
  name VARCHAR(255) NOT NULL,
  title VARCHAR(100),           -- z.B. "Dr.", "Prof. Dr."
  position VARCHAR(200),        -- z.B. "Head of Legal"
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),

  -- Flags
  is_primary BOOLEAN DEFAULT false,  -- Primärer Ansprechpartner fuer diese Rolle
  is_external BOOLEAN DEFAULT false, -- Externer DSB/Auditor
  internal_user_id UUID REFERENCES "user"(id), -- Wenn gleichzeitig User im System

  -- Adresse (falls abweichend vom Hauptsitz, z.B. externe Dienstleister)
  address_override TEXT,

  -- Gueltigkeit
  valid_from DATE,
  valid_until DATE,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES "user"(id),
  updated_by UUID REFERENCES "user"(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS oc_org_idx ON organization_contact(org_id);
CREATE INDEX IF NOT EXISTS oc_role_idx ON organization_contact(org_id, role_type);
CREATE INDEX IF NOT EXISTS oc_user_idx ON organization_contact(internal_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS oc_primary_unique ON organization_contact(org_id, role_type) WHERE is_primary = true AND deleted_at IS NULL;

-- RLS
ALTER TABLE organization_contact ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_contact_org_isolation ON organization_contact
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit-Trigger
CREATE TRIGGER organization_contact_audit
  AFTER INSERT OR UPDATE OR DELETE ON organization_contact
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================================
-- 3. Migration bestehender DPO-Daten in organization_contact
-- ============================================================

INSERT INTO organization_contact (org_id, role_type, name, email, is_primary, internal_user_id, created_at)
SELECT
  o.id,
  'dpo',
  COALESCE(o.dpo_name, u.name, 'Datenschutzbeauftragter'),
  COALESCE(o.dpo_email, u.email),
  true,
  o.dpo_user_id,
  now()
FROM organization o
LEFT JOIN "user" u ON u.id = o.dpo_user_id
WHERE (o.dpo_name IS NOT NULL OR o.dpo_email IS NOT NULL OR o.dpo_user_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM organization_contact oc
    WHERE oc.org_id = o.id AND oc.role_type = 'dpo'
  );

-- ============================================================
-- 4. country_code aus country-Feld populieren wo möglich
-- ============================================================

UPDATE organization
SET country_code = CASE upper(country)
  WHEN 'DE' THEN 'DE' WHEN 'GERMANY' THEN 'DE' WHEN 'DEUTSCHLAND' THEN 'DE'
  WHEN 'CH' THEN 'CH' WHEN 'SWITZERLAND' THEN 'CH' WHEN 'SCHWEIZ' THEN 'CH'
  WHEN 'AT' THEN 'AT' WHEN 'AUSTRIA' THEN 'AT' WHEN 'OESTERREICH' THEN 'AT'
  WHEN 'NO' THEN 'NO' WHEN 'NORWAY' THEN 'NO' WHEN 'NORWEGEN' THEN 'NO'
  WHEN 'US' THEN 'US' WHEN 'USA' THEN 'US' WHEN 'UNITED STATES' THEN 'US'
  WHEN 'GB' THEN 'GB' WHEN 'UK' THEN 'GB' WHEN 'UNITED KINGDOM' THEN 'GB'
  WHEN 'FR' THEN 'FR' WHEN 'FRANCE' THEN 'FR' WHEN 'FRANKREICH' THEN 'FR'
  WHEN 'IT' THEN 'IT' WHEN 'ITALY' THEN 'IT' WHEN 'ITALIEN' THEN 'IT'
  WHEN 'ES' THEN 'ES' WHEN 'SPAIN' THEN 'ES' WHEN 'SPANIEN' THEN 'ES'
  WHEN 'NL' THEN 'NL' WHEN 'NETHERLANDS' THEN 'NL' WHEN 'NIEDERLANDE' THEN 'NL'
  ELSE NULL
END
WHERE country_code IS NULL AND country IS NOT NULL;
