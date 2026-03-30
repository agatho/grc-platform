-- Migration: sidebar navigation preferences
-- Stores per-user, per-org pinned routes and collapsed sidebar groups

CREATE TABLE IF NOT EXISTS "user_nav_preference" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "user"("id"),
  "org_id" uuid NOT NULL REFERENCES "organization"("id"),
  "pinned_routes" text[] DEFAULT '{}',
  "collapsed_groups" text[] DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "unp_user_org_idx"
  ON "user_nav_preference" ("user_id", "org_id");

-- RLS policy: users can only access their own preferences
ALTER TABLE "user_nav_preference" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_nav_preference_isolation" ON "user_nav_preference"
  USING (
    org_id::text = current_setting('app.current_org_id', true)
    AND user_id::text = current_setting('app.current_user_id', true)
  );

-- Audit trigger
CREATE TRIGGER "user_nav_preference_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "user_nav_preference"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Grant access to the application role
GRANT SELECT, INSERT, UPDATE, DELETE ON "user_nav_preference" TO grc;
