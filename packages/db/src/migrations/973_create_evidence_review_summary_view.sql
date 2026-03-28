-- Sprint 68: AI Evidence Review Agent
-- Migration 973: Create evidence review summary view

CREATE MATERIALIZED VIEW IF NOT EXISTS evidence_review_summary AS
SELECT
  j.org_id,
  COUNT(DISTINCT j.id) AS total_jobs,
  COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'completed') AS completed_jobs,
  COALESCE(SUM(j.total_artifacts), 0) AS total_artifacts_reviewed,
  COALESCE(SUM(j.compliant_artifacts), 0) AS total_compliant,
  COALESCE(SUM(j.non_compliant_artifacts), 0) AS total_non_compliant,
  COALESCE(SUM(j.gaps_identified), 0) AS total_gaps,
  COALESCE(AVG(j.overall_confidence), 0) AS avg_confidence,
  COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'open') AS open_gaps,
  COUNT(DISTINCT g.id) FILTER (WHERE g.severity = 'critical') AS critical_gaps
FROM evidence_review_job j
LEFT JOIN evidence_review_gap g ON g.job_id = j.id
GROUP BY j.org_id;

CREATE UNIQUE INDEX evidence_review_summary_org_idx ON evidence_review_summary(org_id);
