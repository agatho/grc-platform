-- #NIGHT-035: generic entity_comment table so resource-nested comments
-- routes (/risks/{id}/comments, /controls/{id}/comments, etc.) can land
-- without per-domain schema duplication.
--
-- Polymorphic via (entity_type, entity_id) — the same pattern as
-- audit_log and document_entity_link, both of which already use it.
-- RLS via org_id, soft delete via deleted_at, audit via created_by/at.

CREATE TABLE IF NOT EXISTS entity_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  body TEXT NOT NULL,
  -- Optional thread parent for replies.
  parent_comment_id UUID REFERENCES entity_comment(id) ON DELETE CASCADE,
  -- Edit tracking — body changes increment this and stamp edited_at.
  edit_count INTEGER NOT NULL DEFAULT 0,
  edited_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES "user"(id)
);

-- Hot-path index: read all comments for a given entity, newest first.
CREATE INDEX IF NOT EXISTS ec_entity_idx
  ON entity_comment(org_id, entity_type, entity_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ec_parent_idx
  ON entity_comment(parent_comment_id)
  WHERE parent_comment_id IS NOT NULL AND deleted_at IS NULL;

-- RLS: filter by current_org_id session var (matches the platform
-- pattern). Inserts checked via WITH CHECK clause so a user can't
-- create a comment for another org.
ALTER TABLE entity_comment ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_comment_org_isolation ON entity_comment
  USING (org_id::text = current_setting('app.current_org_id', true))
  WITH CHECK (org_id::text = current_setting('app.current_org_id', true));
