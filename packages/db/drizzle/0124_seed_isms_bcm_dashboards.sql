-- Sprint 55, Migration 861: Seed 13 dashboard configs (7 ISMS + 6 BCM)
-- Uses existing dashboard_widget_config table from Sprint 18

INSERT INTO dashboard_widget_config (id, name, key, module, layout, is_system, created_at)
VALUES
  -- 7 ISMS dashboards
  (gen_random_uuid(), 'Overview Protection Requirement', 'isms_prq', 'isms', '{"widgets": [{"type": "protection_requirements_table", "w": 12, "h": 6}]}', true, NOW()),
  (gen_random_uuid(), 'Overview Assessments', 'isms_assessments', 'isms', '{"widgets": [{"type": "assessments_table", "w": 12, "h": 6}]}', true, NOW()),
  (gen_random_uuid(), 'Overview Risk Scenario', 'isms_risk_scenario', 'isms', '{"widgets": [{"type": "risk_scenarios_table", "w": 12, "h": 6}]}', true, NOW()),
  (gen_random_uuid(), 'Overview Single Risk ISM', 'isms_single_risk', 'isms', '{"widgets": [{"type": "single_risk_table", "w": 12, "h": 6}]}', true, NOW()),
  (gen_random_uuid(), 'Overview Control ISM', 'isms_control', 'isms', '{"widgets": [{"type": "controls_table", "w": 12, "h": 6}]}', true, NOW()),
  (gen_random_uuid(), 'Finding BCM', 'isms_finding_bcm', 'isms', '{"widgets": [{"type": "findings_table", "w": 12, "h": 6}]}', true, NOW()),
  (gen_random_uuid(), 'ISMS Welcome', 'isms_welcome', 'isms', '{"widgets": [{"type": "welcome_card", "w": 6, "h": 3}, {"type": "my_todos", "w": 6, "h": 3}]}', true, NOW()),
  -- 6 BCM dashboards
  (gen_random_uuid(), 'Overview Essential Process', 'bcm_essential', 'bcms', '{"widgets": [{"type": "essential_processes_table", "w": 12, "h": 6}]}', true, NOW()),
  (gen_random_uuid(), 'Overview BIA', 'bcm_bia', 'bcms', '{"widgets": [{"type": "bia_table", "w": 12, "h": 6}]}', true, NOW()),
  (gen_random_uuid(), 'Overview Continuity Strategy', 'bcm_strategy', 'bcms', '{"widgets": [{"type": "strategies_table", "w": 12, "h": 6}]}', true, NOW()),
  (gen_random_uuid(), 'Overview Emergency Plan', 'bcm_emergency', 'bcms', '{"widgets": [{"type": "emergency_plans_table", "w": 12, "h": 6}]}', true, NOW()),
  (gen_random_uuid(), 'Emergency Drill Plan', 'bcm_drill', 'bcms', '{"widgets": [{"type": "drills_table", "w": 12, "h": 6}]}', true, NOW()),
  (gen_random_uuid(), 'Overview Finding BCM', 'bcm_finding', 'bcms', '{"widgets": [{"type": "findings_table", "w": 12, "h": 6}]}', true, NOW())
ON CONFLICT DO NOTHING;
