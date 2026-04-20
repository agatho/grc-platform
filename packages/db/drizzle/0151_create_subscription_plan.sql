-- Sprint 61: Multi-Tenant SaaS und Metering
-- Migration 921: Create subscription_plan table

CREATE TABLE IF NOT EXISTS subscription_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tier VARCHAR(30) NOT NULL,
  price_monthly INT,
  price_yearly INT,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  max_users INT,
  max_organizations INT,
  max_storage_gb INT,
  max_api_calls_per_month INT,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  trial_days INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sub_plan_tier_idx ON subscription_plan(tier);
CREATE INDEX sub_plan_active_idx ON subscription_plan(is_active);

-- Seed plans
INSERT INTO subscription_plan (key, name, description, tier, price_monthly, price_yearly, max_users, max_organizations, max_storage_gb, max_api_calls_per_month, trial_days, sort_order, features) VALUES
  ('free', 'Free', 'Get started with basic GRC capabilities', 'free', 0, 0, 5, 1, 1, 1000, 0, 1,
    '{"modules": ["erm"], "max_risks": 50, "max_controls": 25, "api_access": false, "plugins": false, "sso": false, "support": "community"}'),
  ('standard', 'Standard', 'For growing teams needing comprehensive GRC', 'standard', 4900, 49900, 25, 3, 10, 50000, 14, 2,
    '{"modules": ["erm", "bpm", "ics", "dms"], "max_risks": 500, "max_controls": 250, "api_access": true, "plugins": true, "sso": false, "support": "email"}'),
  ('professional', 'Professional', 'Full platform access for mid-size organizations', 'professional', 14900, 149900, 100, 10, 50, 500000, 14, 3,
    '{"modules": ["erm", "bpm", "ics", "dms", "isms", "bcms", "dpms", "audit", "tprm"], "max_risks": -1, "max_controls": -1, "api_access": true, "plugins": true, "sso": true, "support": "priority"}'),
  ('enterprise', 'Enterprise', 'Unlimited access with dedicated support', 'enterprise', NULL, NULL, NULL, NULL, NULL, NULL, 30, 4,
    '{"modules": ["all"], "max_risks": -1, "max_controls": -1, "api_access": true, "plugins": true, "sso": true, "support": "dedicated", "custom_branding": true, "on_premise": true}')
ON CONFLICT (key) DO NOTHING;

-- Audit trigger
CREATE TRIGGER subscription_plan_audit AFTER INSERT OR UPDATE OR DELETE ON subscription_plan
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
