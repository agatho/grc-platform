-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-01] In-place repariert.
-- Diese Migration ist gegen eine leere Datenbank nie erfolgreich gelaufen
-- (Audit-Finding S09-01) und gilt nach ADR-014 als nicht ausgeliefert; die
-- Änderung an der bestehenden Datei ist daher zulässig.
-- Änderung: Seed auf die nirgends existierende Tabelle dashboard_widget_config (42P01) mit to_regclass-Guard versehen; Zielmodell ist fachlich offen.
-- Sprint 55, Migration 861: Seed 13 dashboard configs (7 ISMS + 6 BCM)
-- Uses existing dashboard_widget_config table from Sprint 18

-- [ARCTOS-FULL-2026-08-31 / S09-01] Der Kopfkommentar behauptet eine
-- "existing dashboard_widget_config table from Sprint 18". Diese Tabelle
-- existiert in keiner Migration, keiner pgTable-Definition und keiner
-- Umgebung; real vorhanden sind custom_dashboard, custom_dashboard_widget,
-- role_dashboard_config und user_dashboard_layout — alle vier sind
-- org-gebunden (org_id NOT NULL) und damit keine Ablage fuer die hier
-- gemeinten plattformweiten System-Dashboards (is_system = true).
-- Eine Zuordnung waere fachliche Spekulation, deshalb wird der Seed
-- geguarded statt umgebogen: die Migration ist damit anwendbar, und
-- sobald das Zielmodell geklaert ist, greift der Seed automatisch.
-- Offener Punkt fuer die Fachklaerung, siehe /work/audit/remediation/WP1.md.
DO $seed$
BEGIN
  IF to_regclass('public.dashboard_widget_config') IS NULL THEN
    RAISE NOTICE '0124: dashboard_widget_config nicht vorhanden - System-Dashboards uebersprungen';
  ELSE
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
  END IF;
END
$seed$;
