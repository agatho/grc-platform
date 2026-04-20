-- Sprint 55, Migration 865: Create asset_type_risk_recommendation mapping table

CREATE TABLE IF NOT EXISTS asset_type_risk_recommendation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type VARCHAR(50) NOT NULL,
  risk_catalog_entry_id UUID NOT NULL,
  is_default_selected BOOLEAN DEFAULT true,
  UNIQUE(asset_type, risk_catalog_entry_id)
);
