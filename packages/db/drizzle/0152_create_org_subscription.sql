-- Sprint 61: Organization Subscriptions
-- Migration 922: Create org_subscription table

CREATE TABLE IF NOT EXISTS org_subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  plan_id UUID NOT NULL REFERENCES subscription_plan(id),
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  external_customer_id VARCHAR(255),
  external_subscription_id VARCHAR(255),
  payment_method VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX org_sub_org_idx ON org_subscription(org_id);
CREATE INDEX org_sub_plan_idx ON org_subscription(plan_id);
CREATE INDEX org_sub_status_idx ON org_subscription(org_id, status);
CREATE UNIQUE INDEX org_sub_active_unique_idx ON org_subscription(org_id);

-- RLS
ALTER TABLE org_subscription ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_subscription_org_isolation ON org_subscription
  USING (org_id::text = current_setting('app.current_org_id', true));

-- Audit trigger
CREATE TRIGGER org_subscription_audit AFTER INSERT OR UPDATE OR DELETE ON org_subscription
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
