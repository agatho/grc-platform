-- #WAVE6-AUDIT-02: the audit_trigger() function ignores the reason
-- text the caller passes (e.g. PUT /risks/{id}/status with body
-- {status, reason: "Reset for QA"}). The reason is critical for
-- ISO 27001 A.18.1.3 / GoBD §147 / DSGVO Art. 5(2) traceability.
--
-- Solution: extend the trigger to read two new session variables
-- (set by withAuditContext when the caller provides them) and stuff
-- them into the existing action_detail and metadata columns:
--   app.audit_reason         → metadata->'reason'
--   app.audit_action_detail  → action_detail (varchar 500)
--
-- The hash-chain input now also includes these fields, so any
-- post-hoc tampering with reason/action_detail breaks the chain.

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_changes        jsonb;
  v_action         audit_action;
  v_entity_id      uuid;
  v_entity_title   text;
  v_user_id        uuid;
  v_user_email     text;
  v_user_name      text;
  v_org_id         uuid;
  v_prev_hash      varchar(64);
  v_entry_hash     varchar(64);
  v_hash_input     text;
  v_new            jsonb;
  v_old            jsonb;
  v_diff           jsonb := '{}'::jsonb;
  v_key            text;
  v_action_detail  text;
  v_reason         text;
  v_metadata       jsonb;
  v_scope          text;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new := to_jsonb(NEW);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old := to_jsonb(OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
  ELSIF TG_OP = 'UPDATE' THEN
    IF (v_new->>'deleted_at') IS NOT NULL AND (v_old->>'deleted_at') IS NULL THEN
      v_action := 'delete';
    ELSE
      v_action := 'update';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_entity_id := (v_old->>'id')::uuid;
  ELSE
    v_entity_id := (v_new->>'id')::uuid;
  END IF;

  IF TG_TABLE_NAME = 'organization' THEN
    v_org_id := v_entity_id;
  ELSIF TG_TABLE_NAME = 'user' THEN
    v_org_id := NULLIF(current_setting('app.current_org_id', true), '')::uuid;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_org_id := (v_old->>'org_id')::uuid;
    ELSE
      v_org_id := (v_new->>'org_id')::uuid;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_changes := jsonb_build_object('new', v_new);
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := jsonb_build_object('old', v_old);
  ELSE
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_new->v_key IS DISTINCT FROM v_old->v_key THEN
        v_diff := v_diff || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key)
        );
      END IF;
    END LOOP;
    v_changes := v_diff;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_entity_title := COALESCE(v_old->>'name', v_old->>'title', v_old->>'email');
  ELSE
    v_entity_title := COALESCE(v_new->>'name', v_new->>'title', v_new->>'email');
  END IF;

  v_user_id    := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  v_user_email := NULLIF(current_setting('app.current_user_email', true), '');
  v_user_name  := NULLIF(current_setting('app.current_user_name', true), '');

  -- #WAVE6-AUDIT-02: pull the optional reason and action_detail
  -- session variables. NULL when the caller didn't set them — keeps
  -- back-compat with every existing trigger user.
  v_action_detail := NULLIF(current_setting('app.audit_action_detail', true), '');
  v_reason        := NULLIF(current_setting('app.audit_reason', true), '');

  IF v_reason IS NOT NULL THEN
    v_metadata := jsonb_build_object('reason', v_reason);
  ELSE
    v_metadata := NULL;
  END IF;

  -- Per-tenant chain scope (ADR-011 rev.2).
  v_scope := 'org:' || COALESCE(v_org_id::text, 'platform');

  SELECT entry_hash INTO v_prev_hash
  FROM audit_log
  WHERE previous_hash_scope = v_scope
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- Hash includes the new fields so post-hoc tampering with
  -- action_detail or reason breaks the chain.
  v_hash_input := COALESCE(v_prev_hash, '0') || '|' ||
    COALESCE(v_org_id::text, '')          || '|' ||
    COALESCE(v_user_id::text, '')         || '|' ||
    TG_TABLE_NAME                         || '|' ||
    COALESCE(v_entity_id::text, '')       || '|' ||
    v_action::text                        || '|' ||
    COALESCE(v_changes::text, '')         || '|' ||
    COALESCE(v_action_detail, '')         || '|' ||
    COALESCE(v_metadata::text, '')        || '|' ||
    now()::text                           || '|' ||
    v_scope;

  v_entry_hash := encode(digest(v_hash_input, 'sha256'), 'hex');

  INSERT INTO audit_log (
    org_id, user_id, user_email, user_name,
    entity_type, entity_id, entity_title,
    action, action_detail, changes, metadata,
    previous_hash, entry_hash, previous_hash_scope,
    created_at
  ) VALUES (
    v_org_id, v_user_id, v_user_email, v_user_name,
    TG_TABLE_NAME, v_entity_id, v_entity_title,
    v_action, v_action_detail, v_changes, v_metadata,
    v_prev_hash, v_entry_hash, v_scope,
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
