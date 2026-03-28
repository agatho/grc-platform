-- Sprint 49: EAM Visualizations — Insight Grid, Context Diagram, Roadmap, Risk/Alignment Dashboards
-- Migration 746-760: Indices only, no new tables (pure visualization sprint)

-- ──────────────────────────────────────────────────────────────
-- Insight Grid performance indices
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "ar_realizes_idx" ON "architecture_relationship" ("source_id")
  WHERE relationship_type = 'realizes';
CREATE INDEX IF NOT EXISTS "ar_runs_on_idx" ON "architecture_relationship" ("source_id")
  WHERE relationship_type IN ('runs_on', 'deployed_on');
CREATE INDEX IF NOT EXISTS "ap_lifecycle_dates_idx" ON "application_portfolio" ("planned_introduction", "planned_eol");
CREATE INDEX IF NOT EXISTS "ap_time_cls_idx" ON "application_portfolio" ("org_id", "time_classification");
CREATE INDEX IF NOT EXISTS "bc_level_idx" ON "business_capability" ("org_id", "level");

-- ──────────────────────────────────────────────────────────────
-- Context diagram indices (entity_reference traversal)
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "er_source_type_idx" ON "entity_reference" ("source_id", "source_type")
  WHERE source_type IN ('risk', 'architecture_element');
CREATE INDEX IF NOT EXISTS "er_target_type_idx" ON "entity_reference" ("target_id", "target_type")
  WHERE target_type = 'architecture_element';

-- ──────────────────────────────────────────────────────────────
-- Risk per application indices
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "risk_category_level_idx" ON "risk" ("org_id", "risk_category", "inherent_risk_level");

-- ──────────────────────────────────────────────────────────────
-- Technology alignment indices
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "te_ring_align_idx" ON "technology_entry" ("org_id", "ring");
CREATE INDEX IF NOT EXISTS "tal_align_idx" ON "technology_application_link" ("technology_id", "element_id");
