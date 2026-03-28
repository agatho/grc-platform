-- Sprint 22: Where-Used Tracking + Webhook/Event-Bus
-- Migrations 316–328: CREATE 4 tables, RLS, audit triggers,
-- entity_reference sync triggers, backfill, webhook template seeds

-- ──────────────────────────────────────────────────────────────
-- 316: CREATE entity_reference
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "entity_reference" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "source_type" varchar(50) NOT NULL,
  "source_id" uuid NOT NULL,
  "target_type" varchar(50) NOT NULL,
  "target_id" uuid NOT NULL,
  "relationship" varchar(50) NOT NULL,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "er_source_idx" ON "entity_reference" ("source_type", "source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "er_target_idx" ON "entity_reference" ("target_type", "target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "er_org_idx" ON "entity_reference" ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "er_unique_idx" ON "entity_reference" ("org_id", "source_type", "source_id", "target_type", "target_id", "relationship");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 317: CREATE webhook_registration
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "webhook_registration" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "name" varchar(200) NOT NULL,
  "url" varchar(2000) NOT NULL,
  "secret_hash" varchar(256) NOT NULL,
  "secret_last4" varchar(4) NOT NULL,
  "event_filter" jsonb NOT NULL,
  "headers" jsonb DEFAULT '{}',
  "is_active" boolean NOT NULL DEFAULT true,
  "template_type" varchar(20),
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "wr_org_idx" ON "webhook_registration" ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wr_active_idx" ON "webhook_registration" ("org_id", "is_active");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 318: CREATE webhook_delivery_log
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "webhook_delivery_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "webhook_id" uuid NOT NULL REFERENCES "webhook_registration"("id") ON DELETE CASCADE,
  "event_type" varchar(50) NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" uuid NOT NULL,
  "payload" jsonb NOT NULL,
  "response_status" integer,
  "response_body" text,
  "delivered_at" timestamptz,
  "retry_count" integer NOT NULL DEFAULT 0,
  "next_retry_at" timestamptz,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "wdl_webhook_idx" ON "webhook_delivery_log" ("webhook_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wdl_status_idx" ON "webhook_delivery_log" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wdl_created_idx" ON "webhook_delivery_log" ("created_at");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 319: CREATE event_log
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "event_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL,
  "event_type" varchar(50) NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" uuid NOT NULL,
  "user_id" uuid,
  "payload" jsonb NOT NULL,
  "emitted_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "el_org_idx" ON "event_log" ("org_id", "emitted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "el_entity_idx" ON "event_log" ("entity_type", "entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "el_event_type_idx" ON "event_log" ("event_type");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 320: RLS on all 4 Sprint 22 tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "entity_reference" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "entity_reference_org_isolation" ON "entity_reference"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "webhook_registration" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "webhook_registration_org_isolation" ON "webhook_registration"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "webhook_delivery_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "webhook_delivery_log_org_isolation" ON "webhook_delivery_log"
  USING ("webhook_id" IN (
    SELECT "id" FROM "webhook_registration"
    WHERE "org_id" = current_setting('app.current_org_id', true)::uuid
  ));--> statement-breakpoint

ALTER TABLE "event_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "event_log_org_isolation" ON "event_log"
  USING ("org_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 321: Audit triggers on Sprint 22 tables
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER "audit_entity_reference"
  AFTER INSERT OR UPDATE OR DELETE ON "entity_reference"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

CREATE TRIGGER "audit_webhook_registration"
  AFTER INSERT OR UPDATE OR DELETE ON "webhook_registration"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint

-- webhook_delivery_log: no audit trigger (high-volume operational log)
-- event_log: no audit trigger (is itself an audit/event store)

-- ──────────────────────────────────────────────────────────────
-- 322: Trigger function for entity_reference sync (risk_asset)
-- Generic sync function — called with column-name args per table
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_entity_ref_risk_asset()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
    VALUES (NEW.org_id, 'risk', NEW.risk_id, 'asset', NEW.asset_id, 'affects')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM entity_reference
    WHERE org_id = OLD.org_id
      AND source_type = 'risk' AND source_id = OLD.risk_id
      AND target_type = 'asset' AND target_id = OLD.asset_id
      AND relationship = 'affects';
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "sync_er_risk_asset"
  AFTER INSERT OR DELETE ON "risk_asset"
  FOR EACH ROW EXECUTE FUNCTION sync_entity_ref_risk_asset();--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 323: Trigger for risk_control (risk ↔ control)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_entity_ref_risk_control()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
    VALUES (NEW.org_id, 'control', NEW.control_id, 'risk', NEW.risk_id, 'mitigates')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM entity_reference
    WHERE org_id = OLD.org_id
      AND source_type = 'control' AND source_id = OLD.control_id
      AND target_type = 'risk' AND target_id = OLD.risk_id
      AND relationship = 'mitigates';
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "sync_er_risk_control"
  AFTER INSERT OR DELETE ON "risk_control"
  FOR EACH ROW EXECUTE FUNCTION sync_entity_ref_risk_control();--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 324: Trigger for process_control (control ↔ process)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_entity_ref_process_control()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
    VALUES (NEW.org_id, 'control', NEW.control_id, 'process', NEW.process_id, 'implemented_in')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM entity_reference
    WHERE org_id = OLD.org_id
      AND source_type = 'control' AND source_id = OLD.control_id
      AND target_type = 'process' AND target_id = OLD.process_id
      AND relationship = 'implemented_in';
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "sync_er_process_control"
  AFTER INSERT OR DELETE ON "process_control"
  FOR EACH ROW EXECUTE FUNCTION sync_entity_ref_process_control();--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 325: Trigger for process_step_control (control ↔ process_step)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_entity_ref_process_step_control()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
    VALUES (NEW.org_id, 'control', NEW.control_id, 'process_step', NEW.process_step_id, 'implemented_in')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM entity_reference
    WHERE org_id = OLD.org_id
      AND source_type = 'control' AND source_id = OLD.control_id
      AND target_type = 'process_step' AND target_id = OLD.process_step_id
      AND relationship = 'implemented_in';
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "sync_er_process_step_control"
  AFTER INSERT OR DELETE ON "process_step_control"
  FOR EACH ROW EXECUTE FUNCTION sync_entity_ref_process_step_control();--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 326: Triggers for document_entity_link, finding→control, security_incident→asset
-- ──────────────────────────────────────────────────────────────

-- document_entity_link (polymorphic: source=document, target=entityType)
CREATE OR REPLACE FUNCTION sync_entity_ref_document_link()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
    VALUES (NEW.org_id, 'document', NEW.document_id, NEW.entity_type, NEW.entity_id, 'documented_in')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM entity_reference
    WHERE org_id = OLD.org_id
      AND source_type = 'document' AND source_id = OLD.document_id
      AND target_type = OLD.entity_type AND target_id = OLD.entity_id
      AND relationship = 'documented_in';
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "sync_er_document_link"
  AFTER INSERT OR DELETE ON "document_entity_link"
  FOR EACH ROW EXECUTE FUNCTION sync_entity_ref_document_link();--> statement-breakpoint

-- finding → control (finding.control_id)
CREATE OR REPLACE FUNCTION sync_entity_ref_finding_control()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.control_id IS NOT NULL THEN
    INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
    VALUES (NEW.org_id, 'finding', NEW.id, 'control', NEW.control_id, 'found_in')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Remove old reference if control changed
    IF OLD.control_id IS NOT NULL AND (NEW.control_id IS NULL OR OLD.control_id <> NEW.control_id) THEN
      DELETE FROM entity_reference
      WHERE org_id = OLD.org_id
        AND source_type = 'finding' AND source_id = OLD.id
        AND target_type = 'control' AND target_id = OLD.control_id
        AND relationship = 'found_in';
    END IF;
    -- Add new reference
    IF NEW.control_id IS NOT NULL AND (OLD.control_id IS NULL OR OLD.control_id <> NEW.control_id) THEN
      INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
      VALUES (NEW.org_id, 'finding', NEW.id, 'control', NEW.control_id, 'found_in')
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.control_id IS NOT NULL THEN
    DELETE FROM entity_reference
    WHERE org_id = OLD.org_id
      AND source_type = 'finding' AND source_id = OLD.id
      AND target_type = 'control' AND target_id = OLD.control_id
      AND relationship = 'found_in';
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "sync_er_finding_control"
  AFTER INSERT OR UPDATE OF control_id OR DELETE ON "finding"
  FOR EACH ROW EXECUTE FUNCTION sync_entity_ref_finding_control();--> statement-breakpoint

-- security_incident → affected assets (array column, uses unnest)
CREATE OR REPLACE FUNCTION sync_entity_ref_incident_assets()
RETURNS TRIGGER AS $$
DECLARE
  asset_id uuid;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- On update, remove old refs first
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM entity_reference
      WHERE org_id = OLD.org_id
        AND source_type = 'incident' AND source_id = OLD.id
        AND target_type = 'asset' AND relationship = 'affected';
    END IF;
    -- Insert new refs
    IF NEW.affected_asset_ids IS NOT NULL THEN
      FOREACH asset_id IN ARRAY NEW.affected_asset_ids LOOP
        INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
        VALUES (NEW.org_id, 'incident', NEW.id, 'asset', asset_id, 'affected')
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM entity_reference
    WHERE org_id = OLD.org_id
      AND source_type = 'incident' AND source_id = OLD.id
      AND target_type = 'asset' AND relationship = 'affected';
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "sync_er_incident_assets"
  AFTER INSERT OR UPDATE OF affected_asset_ids OR DELETE ON "security_incident"
  FOR EACH ROW EXECUTE FUNCTION sync_entity_ref_incident_assets();--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 327: Backfill entity_reference from ALL existing data
-- ──────────────────────────────────────────────────────────────

-- Backfill risk_asset → entity_reference
INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
SELECT org_id, 'risk', risk_id, 'asset', asset_id, 'affects'
FROM risk_asset
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Backfill risk_control → entity_reference
INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
SELECT org_id, 'control', control_id, 'risk', risk_id, 'mitigates'
FROM risk_control
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Backfill process_control → entity_reference
INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
SELECT org_id, 'control', control_id, 'process', process_id, 'implemented_in'
FROM process_control
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Backfill process_step_control → entity_reference
INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
SELECT org_id, 'control', control_id, 'process_step', process_step_id, 'implemented_in'
FROM process_step_control
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Backfill document_entity_link → entity_reference
INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
SELECT org_id, 'document', document_id, entity_type, entity_id, 'documented_in'
FROM document_entity_link
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Backfill finding → control references
INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
SELECT org_id, 'finding', id, 'control', control_id, 'found_in'
FROM finding
WHERE control_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Backfill security_incident → asset references
INSERT INTO entity_reference (org_id, source_type, source_id, target_type, target_id, relationship)
SELECT si.org_id, 'incident', si.id, 'asset', unnest(si.affected_asset_ids), 'affected'
FROM security_incident si
WHERE si.affected_asset_ids IS NOT NULL
  AND array_length(si.affected_asset_ids, 1) > 0
  AND si.deleted_at IS NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 328: Seed webhook payload templates (stored as metadata reference)
-- Using event_log for template storage is not appropriate;
-- we store templates as a system config pattern instead.
-- ──────────────────────────────────────────────────────────────

-- No additional tables needed. Template types ('slack', 'teams', 'generic')
-- are handled in application code by the webhook delivery worker.
-- The template_type column on webhook_registration drives format selection.
