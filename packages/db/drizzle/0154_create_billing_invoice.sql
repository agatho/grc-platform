-- Sprint 61: Billing
-- Migration 924: Create billing_invoice table

CREATE TABLE IF NOT EXISTS billing_invoice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  subscription_id UUID NOT NULL REFERENCES org_subscription(id),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  subtotal INT NOT NULL,
  tax INT NOT NULL DEFAULT 0,
  total INT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  line_items JSONB DEFAULT '[]',
  paid_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ NOT NULL,
  external_invoice_id VARCHAR(255),
  pdf_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX billing_inv_org_idx ON billing_invoice(org_id);
CREATE INDEX billing_inv_sub_idx ON billing_invoice(subscription_id);
CREATE INDEX billing_inv_status_idx ON billing_invoice(org_id, status);
CREATE INDEX billing_inv_date_idx ON billing_invoice(created_at);

-- RLS
ALTER TABLE billing_invoice ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_invoice_org_isolation ON billing_invoice
  USING (org_id::text = current_setting('app.current_org_id', true));

-- Audit trigger
CREATE TRIGGER billing_invoice_audit AFTER INSERT OR UPDATE OR DELETE ON billing_invoice
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
