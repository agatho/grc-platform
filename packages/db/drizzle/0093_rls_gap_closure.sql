-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-04] In-place repariert.
-- Diese Migration ist gegen eine leere Datenbank nie erfolgreich gelaufen
-- (Audit-Finding S09-01/S09-04) und gilt nach ADR-014 als nicht
-- ausgeliefert; die Änderung an der bestehenden Datei ist daher zulässig.
-- Änderung: Zieltabelle grc_report_template (existiert nicht, 42P01) auf report_template korrigiert; alle ALTER TABLE auf IF EXISTS umgestellt und die 35 CREATE-POLICY-Anweisungen in pro-Tabelle-Guards (to_regclass + org_id-Spalte + pg_policies) gekapselt, damit eine fehlende Relation nicht alle folgenden RLS-Aktivierungen verhindert.
-- Migration 0093: Close all remaining RLS gaps
-- 30 tables with org_id but no RLS + 5 tables with RLS enabled but no policy
-- Security-critical: prevents cross-org data leakage

-- ============================================================
-- Part 1: Tables with org_id that need RLS enabled + policy
-- ============================================================

-- attestation_campaign
ALTER TABLE IF EXISTS attestation_campaign ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.attestation_campaign') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='attestation_campaign'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='attestation_campaign' AND policyname='attestation_campaign_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY attestation_campaign_org_isolation ON attestation_campaign
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- audit_sample
ALTER TABLE IF EXISTS audit_sample ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.audit_sample') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='audit_sample'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='audit_sample' AND policyname='audit_sample_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY audit_sample_org_isolation ON audit_sample
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- board_report
ALTER TABLE IF EXISTS board_report ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.board_report') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='board_report'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='board_report' AND policyname='board_report_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY board_report_org_isolation ON board_report
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- checklist_instance
ALTER TABLE IF EXISTS checklist_instance ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.checklist_instance') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='checklist_instance'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='checklist_instance' AND policyname='checklist_instance_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY checklist_instance_org_isolation ON checklist_instance
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- checklist_template
ALTER TABLE IF EXISTS checklist_template ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.checklist_template') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='checklist_template'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='checklist_template' AND policyname='checklist_template_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY checklist_template_org_isolation ON checklist_template
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- connector_instance
ALTER TABLE IF EXISTS connector_instance ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.connector_instance') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='connector_instance'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='connector_instance' AND policyname='connector_instance_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY connector_instance_org_isolation ON connector_instance
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- connector_sync_log
ALTER TABLE IF EXISTS connector_sync_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.connector_sync_log') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='connector_sync_log'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='connector_sync_log' AND policyname='connector_sync_log_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY connector_sync_log_org_isolation ON connector_sync_log
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- consolidation_entry
ALTER TABLE IF EXISTS consolidation_entry ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.consolidation_entry') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='consolidation_entry'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='consolidation_entry' AND policyname='consolidation_entry_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY consolidation_entry_org_isolation ON consolidation_entry
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- consolidation_group
ALTER TABLE IF EXISTS consolidation_group ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.consolidation_group') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='consolidation_group'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='consolidation_group' AND policyname='consolidation_group_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY consolidation_group_org_isolation ON consolidation_group
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- content_placeholder
ALTER TABLE IF EXISTS content_placeholder ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.content_placeholder') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='content_placeholder'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='content_placeholder' AND policyname='content_placeholder_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY content_placeholder_org_isolation ON content_placeholder
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- content_request
ALTER TABLE IF EXISTS content_request ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.content_request') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='content_request'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='content_request' AND policyname='content_request_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY content_request_org_isolation ON content_request
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- control_monitoring_result
ALTER TABLE IF EXISTS control_monitoring_result ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.control_monitoring_result') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='control_monitoring_result'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='control_monitoring_result' AND policyname='control_monitoring_result_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY control_monitoring_result_org_isolation ON control_monitoring_result
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- control_monitoring_rule
ALTER TABLE IF EXISTS control_monitoring_rule ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.control_monitoring_rule') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='control_monitoring_rule'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='control_monitoring_rule' AND policyname='control_monitoring_rule_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY control_monitoring_rule_org_isolation ON control_monitoring_rule
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- data_lineage_entry
ALTER TABLE IF EXISTS data_lineage_entry ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.data_lineage_entry') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='data_lineage_entry'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='data_lineage_entry' AND policyname='data_lineage_entry_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY data_lineage_entry_org_isolation ON data_lineage_entry
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- data_lineage_source
ALTER TABLE IF EXISTS data_lineage_source ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.data_lineage_source') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='data_lineage_source'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='data_lineage_source' AND policyname='data_lineage_source_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY data_lineage_source_org_isolation ON data_lineage_source
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- data_link
ALTER TABLE IF EXISTS data_link ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.data_link') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='data_link'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='data_link' AND policyname='data_link_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY data_link_org_isolation ON data_link
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- data_validation_result
ALTER TABLE IF EXISTS data_validation_result ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.data_validation_result') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='data_validation_result'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='data_validation_result' AND policyname='data_validation_result_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY data_validation_result_org_isolation ON data_validation_result
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- data_validation_rule
ALTER TABLE IF EXISTS data_validation_rule ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.data_validation_rule') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='data_validation_rule'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='data_validation_rule' AND policyname='data_validation_rule_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY data_validation_rule_org_isolation ON data_validation_rule
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- esef_filing
ALTER TABLE IF EXISTS esef_filing ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.esef_filing') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='esef_filing'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='esef_filing' AND policyname='esef_filing_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY esef_filing_org_isolation ON esef_filing
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- evidence_request
ALTER TABLE IF EXISTS evidence_request ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.evidence_request') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='evidence_request'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='evidence_request' AND policyname='evidence_request_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY evidence_request_org_isolation ON evidence_request
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- report_template
-- [ARCTOS-FULL-2026-08-31 / S09-01] hiess faelschlich report_template;
-- diese Relation existiert nirgends (42P01) und brach die Datei ab.
ALTER TABLE IF EXISTS report_template ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.report_template') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='report_template'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='report_template' AND policyname='report_template_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY report_template_org_isolation ON report_template
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- inline_comment
ALTER TABLE IF EXISTS inline_comment ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.inline_comment') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='inline_comment'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='inline_comment' AND policyname='inline_comment_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY inline_comment_org_isolation ON inline_comment
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- messaging_integration
ALTER TABLE IF EXISTS messaging_integration ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.messaging_integration') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='messaging_integration'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='messaging_integration' AND policyname='messaging_integration_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY messaging_integration_org_isolation ON messaging_integration
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- narrative_instance
ALTER TABLE IF EXISTS narrative_instance ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.narrative_instance') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='narrative_instance'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='narrative_instance' AND policyname='narrative_instance_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY narrative_instance_org_isolation ON narrative_instance
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- narrative_template
ALTER TABLE IF EXISTS narrative_template ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.narrative_template') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='narrative_template'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='narrative_template' AND policyname='narrative_template_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY narrative_template_org_isolation ON narrative_template
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- reminder_rule
ALTER TABLE IF EXISTS reminder_rule ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.reminder_rule') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='reminder_rule'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='reminder_rule' AND policyname='reminder_rule_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY reminder_rule_org_isolation ON reminder_rule
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- review_cycle
ALTER TABLE IF EXISTS review_cycle ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.review_cycle') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='review_cycle'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='review_cycle' AND policyname='review_cycle_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY review_cycle_org_isolation ON review_cycle
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- sox_scoping
ALTER TABLE IF EXISTS sox_scoping ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.sox_scoping') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='sox_scoping'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='sox_scoping' AND policyname='sox_scoping_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY sox_scoping_org_isolation ON sox_scoping
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- tag_definition
ALTER TABLE IF EXISTS tag_definition ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.tag_definition') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='tag_definition'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='tag_definition' AND policyname='tag_definition_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY tag_definition_org_isolation ON tag_definition
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- xbrl_tagging_instance
ALTER TABLE IF EXISTS xbrl_tagging_instance ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF to_regclass('public.xbrl_tagging_instance') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='xbrl_tagging_instance'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='xbrl_tagging_instance' AND policyname='xbrl_tagging_instance_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY xbrl_tagging_instance_org_isolation ON xbrl_tagging_instance
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- ============================================================
-- Part 2: Tables with RLS enabled but MISSING policy (deny-all!)
-- ============================================================

-- notification_preference
DO $$ BEGIN
  IF to_regclass('public.notification_preference') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='notification_preference'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='notification_preference' AND policyname='notification_preference_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY notification_preference_org_isolation ON notification_preference
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- rcsa_assignment
DO $$ BEGIN
  IF to_regclass('public.rcsa_assignment') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='rcsa_assignment'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='rcsa_assignment' AND policyname='rcsa_assignment_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY rcsa_assignment_org_isolation ON rcsa_assignment
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- rcsa_campaign
DO $$ BEGIN
  IF to_regclass('public.rcsa_campaign') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='rcsa_campaign'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='rcsa_campaign' AND policyname='rcsa_campaign_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY rcsa_campaign_org_isolation ON rcsa_campaign
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- rcsa_response
DO $$ BEGIN
  IF to_regclass('public.rcsa_response') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='rcsa_response'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='rcsa_response' AND policyname='rcsa_response_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY rcsa_response_org_isolation ON rcsa_response
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;

-- rcsa_result
DO $$ BEGIN
  IF to_regclass('public.rcsa_result') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='rcsa_result'
                      AND column_name='org_id')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                AND tablename='rcsa_result' AND policyname='rcsa_result_org_isolation') THEN
    RETURN;
  END IF;
  CREATE POLICY rcsa_result_org_isolation ON rcsa_result
    USING (org_id = current_setting('app.current_org_id', true)::uuid);
END $$;
