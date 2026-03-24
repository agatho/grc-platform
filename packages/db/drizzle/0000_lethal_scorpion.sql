CREATE TYPE "public"."access_event_type" AS ENUM('login_success', 'login_failed', 'logout', 'token_refresh', 'password_change', 'mfa_challenge', 'mfa_success', 'mfa_failed', 'account_locked', 'sso_login', 'api_key_used', 'session_expired');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'restore', 'status_change', 'approve', 'reject', 'assign', 'unassign', 'upload_evidence', 'delete_evidence', 'acknowledge', 'export', 'bulk_update', 'comment', 'link', 'unlink');--> statement-breakpoint
CREATE TYPE "public"."auth_method" AS ENUM('password', 'sso_azure_ad', 'sso_oidc', 'api_key', 'mfa_totp', 'mfa_webauthn');--> statement-breakpoint
CREATE TYPE "public"."export_type" AS ENUM('pdf_report', 'excel_export', 'csv_export', 'evidence_download', 'bulk_export', 'api_extract', 'audit_report', 'emergency_handbook');--> statement-breakpoint
CREATE TYPE "public"."line_of_defense" AS ENUM('first', 'second', 'third');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'teams');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('task_assigned', 'deadline_approaching', 'escalation', 'approval_request', 'status_change');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('subsidiary', 'holding', 'joint_venture', 'branch');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'risk_manager', 'control_owner', 'auditor', 'dpo', 'process_owner', 'viewer');--> statement-breakpoint
CREATE TABLE "access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email_attempted" varchar(255),
	"event_type" "access_event_type" NOT NULL,
	"auth_method" "auth_method",
	"ip_address" "inet",
	"user_agent" varchar(500),
	"geo_location" varchar(255),
	"failure_reason" varchar(255),
	"session_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"user_id" uuid,
	"user_email" varchar(255),
	"user_name" varchar(255),
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"entity_title" varchar(500),
	"action" "audit_action" NOT NULL,
	"action_detail" varchar(500),
	"changes" jsonb,
	"metadata" jsonb,
	"ip_address" "inet",
	"user_agent" varchar(500),
	"session_id" varchar(255),
	"previous_hash" varchar(64),
	"entry_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_export_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"export_type" "export_type" NOT NULL,
	"entity_type" varchar(100),
	"entity_id" uuid,
	"description" varchar(500),
	"record_count" integer,
	"contains_personal_data" boolean DEFAULT false NOT NULL,
	"file_name" varchar(255),
	"file_size_bytes" bigint,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"entity_type" varchar(100),
	"entity_id" uuid,
	"title" varchar(500) NOT NULL,
	"message" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"short_name" varchar(50),
	"type" "org_type" DEFAULT 'subsidiary' NOT NULL,
	"country" varchar(3) DEFAULT 'DEU' NOT NULL,
	"is_eu" boolean DEFAULT true NOT NULL,
	"parent_org_id" uuid,
	"legal_form" varchar(100),
	"dpo_name" varchar(255),
	"dpo_email" varchar(255),
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"avatar_url" varchar(1000),
	"sso_provider_id" varchar(255),
	"language" varchar(5) DEFAULT 'de' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_organization_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"department" varchar(255),
	"line_of_defense" "line_of_defense",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_export_log" ADD CONSTRAINT "data_export_log_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_export_log" ADD CONSTRAINT "data_export_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_parent_org_id_organization_id_fk" FOREIGN KEY ("parent_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_role" ADD CONSTRAINT "user_organization_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_role" ADD CONSTRAINT "user_organization_role_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acl_user_idx" ON "access_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "acl_event_idx" ON "access_log" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "al_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "al_org_idx" ON "audit_log" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "al_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "del_org_idx" ON "data_export_log" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "del_user_idx" ON "data_export_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notif_user_unread_idx" ON "notification" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notif_org_idx" ON "notification" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_parent_idx" ON "organization" USING btree ("parent_org_id");--> statement-breakpoint
CREATE INDEX "uor_user_idx" ON "user_organization_role" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "uor_org_idx" ON "user_organization_role" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "uor_org_role_idx" ON "user_organization_role" USING btree ("org_id","role");--> statement-breakpoint

-- ============================================================
-- CUSTOM SQL: RLS Policies, Append-Only Rules, Audit Trigger
-- ADR-001 (RLS), ADR-011 (Audit Trail), PRD S1-03/S1-14
-- ============================================================

-- 1. AUTO-UPDATE updated_at TRIGGER
-- Fires on every business table to keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "organization"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "user"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "user_organization_role"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "notification"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- 2. APPEND-ONLY RULES on log tables (ADR-011)
-- Prevent UPDATE and DELETE on audit/log tables
CREATE RULE audit_log_no_update AS ON UPDATE TO "audit_log" DO INSTEAD NOTHING;--> statement-breakpoint
CREATE RULE audit_log_no_delete AS ON DELETE TO "audit_log" DO INSTEAD NOTHING;--> statement-breakpoint
CREATE RULE access_log_no_update AS ON UPDATE TO "access_log" DO INSTEAD NOTHING;--> statement-breakpoint
CREATE RULE access_log_no_delete AS ON DELETE TO "access_log" DO INSTEAD NOTHING;--> statement-breakpoint
CREATE RULE data_export_log_no_update AS ON UPDATE TO "data_export_log" DO INSTEAD NOTHING;--> statement-breakpoint
CREATE RULE data_export_log_no_delete AS ON DELETE TO "data_export_log" DO INSTEAD NOTHING;--> statement-breakpoint

-- 3. ROW-LEVEL SECURITY (ADR-001, PRD S1-03)
-- Pattern: USING (org_id = current_setting('app.current_org_id', true)::uuid)
-- The 'true' parameter returns '' when GUC is not set (safe default = no rows).
-- Bypass: SET LOCAL app.bypass_rls = 'true' for group admin aggregation.

ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_organization_role" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "data_export_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Organization: uses 'id' as discriminator (it IS the org)
CREATE POLICY org_isolation_select ON "organization"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint
CREATE POLICY org_isolation_modify ON "organization"
  FOR ALL USING (
    id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

-- Standard org_id policies for remaining tables
CREATE POLICY org_isolation ON "user_organization_role"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "audit_log"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "data_export_log"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

CREATE POLICY org_isolation ON "notification"
  FOR ALL USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR org_id = current_setting('app.current_org_id', true)::uuid
  );--> statement-breakpoint

-- 4. AUDIT TRIGGER with SHA-256 HASH CHAIN (ADR-011, PRD S1-14)
-- Generic trigger function registered on all business tables.
-- Reads TG_TABLE_NAME, computes JSONB diff, maintains hash chain via pgcrypto.

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_changes    jsonb;
  v_action     audit_action;
  v_entity_id  uuid;
  v_entity_title text;
  v_user_id    uuid;
  v_user_email text;
  v_user_name  text;
  v_org_id     uuid;
  v_prev_hash  varchar(64);
  v_entry_hash varchar(64);
  v_hash_input text;
  v_new        jsonb;
  v_old        jsonb;
  v_diff       jsonb := '{}'::jsonb;
  v_key        text;
BEGIN
  -- Convert records to JSONB for dynamic column access
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new := to_jsonb(NEW);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old := to_jsonb(OLD);
  END IF;

  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detect soft-delete (deleted_at set for the first time)
    IF (v_new->>'deleted_at') IS NOT NULL AND (v_old->>'deleted_at') IS NULL THEN
      v_action := 'delete';
    ELSE
      v_action := 'update';
    END IF;
  END IF;

  -- Extract entity_id
  IF TG_OP = 'DELETE' THEN
    v_entity_id := (v_old->>'id')::uuid;
  ELSE
    v_entity_id := (v_new->>'id')::uuid;
  END IF;

  -- Determine org_id per table
  IF TG_TABLE_NAME = 'organization' THEN
    v_org_id := v_entity_id;
  ELSIF TG_TABLE_NAME = 'user' THEN
    -- User has no org_id; use session context
    v_org_id := NULLIF(current_setting('app.current_org_id', true), '')::uuid;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_org_id := (v_old->>'org_id')::uuid;
    ELSE
      v_org_id := (v_new->>'org_id')::uuid;
    END IF;
  END IF;

  -- Compute structured changes
  IF TG_OP = 'INSERT' THEN
    v_changes := jsonb_build_object('new', v_new);
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := jsonb_build_object('old', v_old);
  ELSE
    -- Field-level diff: {"field": {"old": ..., "new": ...}}
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_new->v_key IS DISTINCT FROM v_old->v_key THEN
        v_diff := v_diff || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key)
        );
      END IF;
    END LOOP;
    v_changes := v_diff;
  END IF;

  -- Entity title snapshot (name > title > email)
  IF TG_OP = 'DELETE' THEN
    v_entity_title := COALESCE(v_old->>'name', v_old->>'title', v_old->>'email');
  ELSE
    v_entity_title := COALESCE(v_new->>'name', v_new->>'title', v_new->>'email');
  END IF;

  -- User snapshot from session settings
  v_user_id    := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  v_user_email := NULLIF(current_setting('app.current_user_email', true), '');
  v_user_name  := NULLIF(current_setting('app.current_user_name', true), '');

  -- Hash chain: get previous entry's hash
  SELECT entry_hash INTO v_prev_hash
  FROM audit_log
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- Compute SHA-256 hash over (previous_hash | org | user | table | id | action | changes | ts)
  v_hash_input := COALESCE(v_prev_hash, '0') || '|' ||
    COALESCE(v_org_id::text, '')   || '|' ||
    COALESCE(v_user_id::text, '')  || '|' ||
    TG_TABLE_NAME                  || '|' ||
    COALESCE(v_entity_id::text, '') || '|' ||
    v_action::text                 || '|' ||
    COALESCE(v_changes::text, '')  || '|' ||
    now()::text;

  v_entry_hash := encode(digest(v_hash_input, 'sha256'), 'hex');

  -- Insert audit log entry
  INSERT INTO audit_log (
    org_id, user_id, user_email, user_name,
    entity_type, entity_id, entity_title,
    action, changes,
    ip_address, session_id,
    previous_hash, entry_hash,
    created_at
  ) VALUES (
    v_org_id, v_user_id, v_user_email, v_user_name,
    TG_TABLE_NAME, v_entity_id, v_entity_title,
    v_action, v_changes,
    NULLIF(current_setting('app.current_ip', true), '')::inet,
    NULLIF(current_setting('app.current_session_id', true), ''),
    v_prev_hash, v_entry_hash,
    now()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;--> statement-breakpoint

-- Register audit trigger on all Sprint 1 business tables
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "organization"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "user"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "user_organization_role"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();--> statement-breakpoint
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "notification"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();