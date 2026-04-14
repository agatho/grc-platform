-- Gap 1: AI Act Document Lifecycle Enforcement (Art. 18-19)
-- Creates a view to identify AI systems with documentation due for review or expiring soon

CREATE OR REPLACE VIEW v_ai_documentation_status AS
SELECT
  s.id AS ai_system_id,
  s.org_id,
  s.name,
  s.system_code,
  s.risk_classification,
  s.status,
  s.documentation_retention_years,
  s.documentation_expiry_date,
  s.last_documentation_review,
  -- Review is overdue if last review is older than 12 months
  CASE
    WHEN s.last_documentation_review IS NULL THEN true
    WHEN s.last_documentation_review < (CURRENT_DATE - INTERVAL '12 months') THEN true
    ELSE false
  END AS review_overdue,
  -- Documentation expiring within 90 days
  CASE
    WHEN s.documentation_expiry_date IS NULL THEN false
    WHEN s.documentation_expiry_date <= (CURRENT_DATE + INTERVAL '90 days') THEN true
    ELSE false
  END AS expiry_approaching,
  -- Days until expiry (NULL if no expiry date set)
  CASE
    WHEN s.documentation_expiry_date IS NOT NULL
    THEN (s.documentation_expiry_date - CURRENT_DATE)
    ELSE NULL
  END AS days_until_expiry,
  -- Days since last review (NULL if never reviewed)
  CASE
    WHEN s.last_documentation_review IS NOT NULL
    THEN (CURRENT_DATE - s.last_documentation_review)
    ELSE NULL
  END AS days_since_last_review
FROM ai_system s
WHERE s.deleted_at IS NULL;

-- Index to speed up documentation lifecycle queries
CREATE INDEX IF NOT EXISTS ai_sys_doc_review_idx ON ai_system (org_id, last_documentation_review) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ai_sys_doc_expiry_idx ON ai_system (org_id, documentation_expiry_date) WHERE deleted_at IS NULL;
