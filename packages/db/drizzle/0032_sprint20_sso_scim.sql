-- Sprint 20: SSO (SAML 2.0 + OIDC) + SCIM User Provisioning
-- Migrations 293-302: sso_config, scim_token, scim_sync_log,
-- ALTER user, RLS, audit triggers, indexes

-- ──────────────────────────────────────────────────────────────
-- 293: Enums for identity module
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "sso_provider_type" AS ENUM ('saml', 'oidc');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "identity_provider" AS ENUM ('local', 'saml', 'oidc', 'scim');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "scim_sync_action" AS ENUM ('create', 'update', 'deactivate', 'reactivate', 'group_assign', 'group_remove');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "scim_sync_status" AS ENUM ('success', 'error', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 294: sso_config — Per-org SSO configuration
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "sso_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "provider" "sso_provider_type" NOT NULL,
  "display_name" varchar(200),
  "saml_metadata_url" varchar(2000),
  "saml_entity_id" varchar(500),
  "saml_sso_url" varchar(2000),
  "saml_certificate" text,
  "saml_attribute_mapping" jsonb DEFAULT '{"email":"email","firstName":"givenName","lastName":"sn","groups":"memberOf"}',
  "oidc_discovery_url" varchar(2000),
  "oidc_client_id" varchar(500),
  "oidc_client_secret" text,
  "oidc_scopes" text DEFAULT 'openid profile email',
  "oidc_claim_mapping" jsonb DEFAULT '{"email":"email","firstName":"given_name","lastName":"family_name","groups":"groups"}',
  "is_active" boolean NOT NULL DEFAULT false,
  "enforce_sso" boolean NOT NULL DEFAULT false,
  "default_role" varchar(50) DEFAULT 'viewer',
  "group_role_mapping" jsonb DEFAULT '{}',
  "auto_provision" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamptz,
  "deleted_by" uuid
);--> statement-breakpoint

CREATE UNIQUE INDEX "sso_org_idx" ON "sso_config" USING btree ("org_id");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 295: scim_token — SCIM bearer tokens (hashed, org-scoped)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "scim_token" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "token_hash" varchar(128) NOT NULL,
  "description" varchar(200),
  "is_active" boolean NOT NULL DEFAULT true,
  "last_used_at" timestamptz,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz,
  "revoked_by" uuid REFERENCES "user"("id")
);--> statement-breakpoint

CREATE INDEX "st_org_idx" ON "scim_token" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "st_hash_idx" ON "scim_token" USING btree ("token_hash");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 296: scim_sync_log — Audit log for SCIM operations
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "scim_sync_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "action" "scim_sync_action" NOT NULL,
  "status" "scim_sync_status" NOT NULL,
  "scim_resource_id" varchar(255),
  "user_id" uuid REFERENCES "user"("id"),
  "user_email" varchar(255),
  "request_payload" jsonb,
  "response_payload" jsonb,
  "error_message" text,
  "token_id" uuid REFERENCES "scim_token"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX "ssl_org_idx" ON "scim_sync_log" USING btree ("org_id", "created_at");--> statement-breakpoint
CREATE INDEX "ssl_action_idx" ON "scim_sync_log" USING btree ("org_id", "action");--> statement-breakpoint
CREATE INDEX "ssl_user_idx" ON "scim_sync_log" USING btree ("user_id");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 297: ALTER user — Add identity provider fields
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "external_id" varchar(200);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "identity_provider" varchar(50) DEFAULT 'local';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamptz;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_external_id_idx" ON "user" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_identity_provider_idx" ON "user" USING btree ("identity_provider");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 298: RLS policies for sso_config
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "sso_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "sso_config_org_isolation" ON "sso_config"
  USING (org_id::text = current_setting('app.current_org_id', true));--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 299: RLS policies for scim_token
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "scim_token" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "scim_token_org_isolation" ON "scim_token"
  USING (org_id::text = current_setting('app.current_org_id', true));--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 300: RLS policies for scim_sync_log
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "scim_sync_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "scim_sync_log_org_isolation" ON "scim_sync_log"
  USING (org_id::text = current_setting('app.current_org_id', true));--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 301: Audit triggers for sso_config + scim_token
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    CREATE TRIGGER sso_config_audit AFTER INSERT OR UPDATE OR DELETE ON "sso_config"
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();

    CREATE TRIGGER scim_token_audit AFTER INSERT OR UPDATE OR DELETE ON "scim_token"
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────
-- 302: Seed identity module_definition (admin-only)
-- ──────────────────────────────────────────────────────────────

INSERT INTO "module_definition" ("key", "name", "description", "icon", "sort_order", "is_core", "license_tier", "nav_items")
VALUES (
  'identity',
  'Identity & SSO',
  'SSO (SAML 2.0/OIDC), SCIM user provisioning, and identity management',
  'KeyRound',
  95,
  true,
  'included',
  '[{"path":"/admin/sso","label":"SSO Configuration","icon":"Shield","roles":["admin"]},{"path":"/admin/scim","label":"SCIM Provisioning","icon":"Users","roles":["admin"]}]'
)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
