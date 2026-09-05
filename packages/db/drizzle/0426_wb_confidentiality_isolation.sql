-- 0426_wb_confidentiality_isolation.sql
-- ARCTOS-FULL-2026-08-31 · WP8 · S07-01 (Critical), S07-08 (High), S07-09 (High)
--
-- ── Ausgangslage nach WP4 ─────────────────────────────────────────────
-- WP4 hat den generischen `audit_trigger()` so geändert, dass er für
-- wb_case, wb_case_message, wb_case_evidence und wb_report nur noch einen
-- identitätsfreien Existenzeintrag schreibt, und hat mit
-- `audit_scrub_changes()` eine Deny-Liste eingeführt, die Schlüsselnamen
-- wie `token` generisch entfernt. Nachgemessen (evidence/wp8/
-- repro-01-before.out): der Mailbox-Token, `category` und `ip_hash` stehen
-- damit tatsächlich nicht mehr im org-weiten `audit_log`.
--
-- ── Was offen blieb ───────────────────────────────────────────────────
-- Neun der dreizehn wb-Tabellen sind von WP4s Liste nicht erfasst und
-- schreiben weiterhin ihre VOLLSTÄNDIGE Zeile in den org-weiten Log:
--
--   wb_anonymous_mailbox        report_id, Zugriffszähler, Ablauf
--   wb_investigation            case_id, Ermittler, Entscheidung
--   wb_investigation_log        description (Art.-9-/Art.-10-Freitext)
--   wb_interview                interviewee_reference, responses, observations
--   wb_evidence                 title, description, file_url
--   wb_protection_case          reporter_reference, reporter_user_id  ← Identität
--   wb_protection_event         description, review_notes
--   wb_ombudsperson_assignment  ombudsperson_user_id, case_id
--   wb_ombudsperson_activity    ombudsperson_user_id, case_id, detail
--
-- `wb_protection_case.reporter_user_id` ist eine direkte Referenz auf die
-- hinweisgebende Person; sie stand über GET /api/v1/audit-log jeder
-- `admin`-, `auditor`- und `dpo`-Rolle offen — also genau den Rollen, die
-- `whistleblowing/cases/route.ts` unter Verweis auf HinSchG §8 ausschließt.
-- Die Deny-Liste greift dort nicht, weil eine Nutzer-UUID kein Geheimnis
-- im Sinne von `audit_key_is_secret()` ist.
--
-- ── Fix ───────────────────────────────────────────────────────────────
-- 1. Der generische Trigger verschwindet von ALLEN wb-Tabellen. Der
--    org-weite Log verliert damit auch den Existenzeintrag; das ist
--    beabsichtigt — HinSchG §8 kennt kein "aber die Metadaten sind doch
--    harmlos", und ein Existenzeintrag je Fallnachricht ist ein
--    Aktivitätsprofil. Die Nachvollziehbarkeit liegt vollständig im
--    `whistleblowing_audit_log`.
-- 2. Der dedizierte `whistleblowing_audit_trigger()` liegt jetzt auf allen
--    dreizehn Tabellen statt auf dreien. Die Fall-Zuordnung erfolgt über
--    `wb_case_scope_of()`, weil neun der Tabellen keine eigene `case_id`
--    haben.
-- 3. `actor_hash` wird mit `pii_hmac()` unter einem Schlüssel außerhalb der
--    Datenbank gebildet (S07-08) statt mit der danebenstehenden `case_id`
--    als Salt.
-- 4. `whistleblowing_audit_log` bekommt `org_id` und eine Mandantenpolicy,
--    die nicht mehr über einen Join auf `wb_case` geht (der für
--    report-skopierte Zeilen leer läuft) — und `admin` fliegt aus der
--    Leserolle, wie ADR-011 rev.2 §82-83 es vorschreibt (S07-09).
--
-- Der Kettenanteil (compute_wb_audit_hash_v2, Advisory-Lock, Tiebreak über
-- entry_hash, audit_scrub_changes, hash_version=2) ist unverändert aus
-- WP4/0406 übernommen.

-- ── 1. Generischen Audit-Trigger von allen wb-Tabellen entfernen ──────

DO $drop_generic$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, t.tgname AS trg
      FROM pg_trigger t
      JOIN pg_class   c ON c.oid = t.tgrelid
      JOIN pg_proc    p ON p.oid = t.tgfoid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE NOT t.tgisinternal
       AND n.nspname = 'public'
       AND c.relname LIKE 'wb\_%'
       AND p.proname = 'audit_trigger'
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.%I', r.trg, r.tbl);
    RAISE NOTICE '0426: removed generic audit_trigger %.%', r.tbl, r.trg;
  END LOOP;
END
$drop_generic$;

-- ── 2. whistleblowing_audit_log: Mandant + Schlüsselkennung ──────────

ALTER TABLE whistleblowing_audit_log
  ADD COLUMN IF NOT EXISTS org_id       uuid,
  ADD COLUMN IF NOT EXISTS actor_key_id text;

COMMENT ON COLUMN whistleblowing_audit_log.org_id IS
  'S07-09: Mandantengrenze. Vorher hatte die Tabelle keine; die Policy behalf sich mit einem Join auf wb_case, der für report-skopierte Zeilen ins Leere lief.';
COMMENT ON COLUMN whistleblowing_audit_log.actor_key_id IS
  'S07-08: Kennung des Schlüssels, unter dem actor_hash gebildet wurde. "db-local" = Installationsschlüssel, "env:*" = Schlüssel aus der Prozessumgebung, "destroyed" = nicht mehr auflösbar.';

CREATE INDEX IF NOT EXISTS wb_audit_log_org_idx
  ON whistleblowing_audit_log (org_id, created_at);

-- Bestandszeilen: org aus dem Fall nachziehen, soweit auflösbar.
UPDATE whistleblowing_audit_log l
   SET org_id = c.org_id
  FROM wb_case c
 WHERE l.org_id IS NULL AND c.id = l.case_id;

-- ── 3. Fall-Zuordnung für alle dreizehn Tabellen ─────────────────────
--
-- Rückgabe ist bewusst KEIN "case_id or null": die Kette in
-- whistleblowing_audit_log ist per NOT NULL an einen Skopus gebunden. Für
-- Vorgänge, die zeitlich vor der Fallanlage liegen (eine eingehende
-- Meldung, das dazu erzeugte Postfach), ist der Skopus die Report-UUID.
-- Sobald der Fall existiert, verweist wb_case.report_id auf dieselbe UUID,
-- die beiden Kettenabschnitte sind also verknüpfbar, ohne dass ein
-- Vorgang unprotokolliert bleibt.

CREATE OR REPLACE FUNCTION wb_case_scope_of(p_table text, p_row jsonb)
RETURNS TABLE (case_id uuid, org_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_case uuid;
  v_org  uuid;
BEGIN
  CASE p_table
    WHEN 'wb_case' THEN
      v_case := (p_row->>'id')::uuid;
      v_org  := (p_row->>'org_id')::uuid;

    WHEN 'wb_report' THEN
      v_case := (p_row->>'id')::uuid;
      v_org  := (p_row->>'org_id')::uuid;
      SELECT c.id, c.org_id INTO v_case, v_org
        FROM wb_case c WHERE c.report_id = (p_row->>'id')::uuid LIMIT 1;
      IF v_case IS NULL THEN
        v_case := (p_row->>'id')::uuid;      -- Report-Skopus
        v_org  := (p_row->>'org_id')::uuid;
      END IF;

    WHEN 'wb_anonymous_mailbox' THEN
      SELECT COALESCE(c.id, r.id), r.org_id INTO v_case, v_org
        FROM wb_report r
        LEFT JOIN wb_case c ON c.report_id = r.id
       WHERE r.id = (p_row->>'report_id')::uuid
       LIMIT 1;

    WHEN 'wb_evidence', 'wb_interview', 'wb_investigation_log' THEN
      SELECT i.case_id, i.org_id INTO v_case, v_org
        FROM wb_investigation i
       WHERE i.id = (p_row->>'investigation_id')::uuid
       LIMIT 1;

    WHEN 'wb_protection_event' THEN
      SELECT pc.case_id, pc.org_id INTO v_case, v_org
        FROM wb_protection_case pc
       WHERE pc.id = (p_row->>'protection_case_id')::uuid
       LIMIT 1;

    ELSE
      -- wb_case_message, wb_case_evidence, wb_investigation,
      -- wb_protection_case, wb_ombudsperson_assignment,
      -- wb_ombudsperson_activity — alle tragen case_id selbst.
      v_case := NULLIF(p_row->>'case_id', '')::uuid;
      v_org  := NULLIF(p_row->>'org_id', '')::uuid;
  END CASE;

  IF v_org IS NULL THEN
    v_org := NULLIF(current_setting('app.current_org_id', true), '')::uuid;
  END IF;
  IF v_org IS NULL AND v_case IS NOT NULL THEN
    SELECT c.org_id INTO v_org FROM wb_case c WHERE c.id = v_case;
  END IF;

  RETURN QUERY SELECT v_case, v_org;
END;
$$;

COMMENT ON FUNCTION wb_case_scope_of(text, jsonb) IS
  'S07-01: löst zu jeder wb-Zeile den Fall- und Mandantenskopus auf. Neun der dreizehn wb-Tabellen haben keine eigene case_id; ohne diese Auflösung könnte der vertrauliche Trigger sie nicht führen und sie blieben beim generischen Trigger.';

REVOKE ALL ON FUNCTION wb_case_scope_of(text, jsonb) FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION wb_case_scope_of(text, jsonb) TO grc_app;
  END IF;
END $g$;

-- ── 4. Vertraulicher Trigger, jetzt für alle wb-Tabellen ─────────────

CREATE OR REPLACE FUNCTION whistleblowing_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_changes    jsonb;
  v_action     audit_action;
  v_case_id    uuid;
  v_org_id     uuid;
  v_entity_id  uuid;
  v_actor_hash text;
  v_key_id     text;
  v_user_id    uuid;
  v_prev_hash  varchar(64);
  v_entry_hash varchar(64);
  v_new        jsonb;
  v_old        jsonb;
  v_diff       jsonb := '{}'::jsonb;
  v_key        text;
  v_created_at timestamptz;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW); END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD); END IF;

  v_action := CASE TG_OP
    WHEN 'INSERT' THEN 'create'::audit_action
    WHEN 'DELETE' THEN 'delete'::audit_action
    ELSE 'update'::audit_action
  END;

  SELECT s.case_id, s.org_id INTO v_case_id, v_org_id
    FROM wb_case_scope_of(TG_TABLE_NAME, COALESCE(v_new, v_old)) s;

  -- Ein Vorgang ohne auflösbaren Skopus darf nicht unprotokolliert
  -- bleiben; die Entität selbst ist der Skopus (Fallback, greift nur bei
  -- verwaisten Zeilen).
  v_entity_id := COALESCE((v_new->>'id')::uuid, (v_old->>'id')::uuid);
  v_case_id   := COALESCE(v_case_id, v_entity_id);

  -- S07-08: Der Akteur wird mit einem Schlüssel pseudonymisiert, der nicht
  -- in derselben Zeile (und nicht in derselben Datenbank) steht. Vorher:
  -- sha256(user_id || '|' || case_id) — case_id ist eine Nachbarspalte,
  -- die Kandidatenmenge sind die UUIDs aus `user`; der Auditor hat die
  -- handelnde Person daraus in Sekunden benannt.
  v_user_id    := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  v_actor_hash := pii_hmac(
    COALESCE(v_user_id::text, 'system') || '|' || v_case_id::text,
    'wb_actor');
  v_key_id     := pii_pseudonym_key_id();

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

  -- S03-14 (WP4): Token und andere Geheimnisse auch hier heraus.
  v_changes := audit_scrub_changes(TG_TABLE_NAME, v_changes);

  PERFORM pg_advisory_xact_lock(hashtext('wb_audit:' || v_case_id::text));

  v_created_at := clock_timestamp();

  SELECT entry_hash INTO v_prev_hash
  FROM whistleblowing_audit_log
  WHERE case_id = v_case_id
  ORDER BY created_at DESC, entry_hash DESC
  LIMIT 1;

  v_entry_hash := compute_wb_audit_hash_v2(
    v_prev_hash, v_case_id, v_actor_hash, TG_TABLE_NAME,
    v_entity_id, v_action::text, v_changes, v_created_at
  );

  INSERT INTO whistleblowing_audit_log (
    case_id, org_id, actor_role, actor_hash, actor_key_id,
    entity_type, entity_id, action, changes,
    previous_hash, entry_hash, created_at, hash_version
  ) VALUES (
    v_case_id,
    v_org_id,
    NULLIF(current_setting('app.current_user_role', true), ''),
    v_actor_hash,
    v_key_id,
    TG_TABLE_NAME, v_entity_id, v_action, v_changes,
    v_prev_hash, v_entry_hash, v_created_at, 2
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ── 5. Trigger auf alle dreizehn wb-Tabellen ─────────────────────────

DO $attach$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wb_report', 'wb_anonymous_mailbox', 'wb_case', 'wb_case_message',
    'wb_case_evidence', 'wb_investigation', 'wb_investigation_log',
    'wb_interview', 'wb_evidence', 'wb_protection_case',
    'wb_protection_event', 'wb_ombudsperson_assignment',
    'wb_ombudsperson_activity'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE WARNING '0426: table % does not exist', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
                   'whistleblowing_audit_trigger_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION whistleblowing_audit_trigger()',
      'whistleblowing_audit_trigger_' || t, t);
  END LOOP;
END
$attach$;

-- ── 6. Mandantengrenze und Rollenschnitt (S07-09) ────────────────────

DROP POLICY IF EXISTS wb_audit_log_officer_read ON whistleblowing_audit_log;
CREATE POLICY wb_audit_log_officer_read ON whistleblowing_audit_log
  FOR SELECT
  USING (
    org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid
    AND current_setting('app.current_user_role', true)
        = ANY (ARRAY['whistleblowing_officer', 'ombudsperson'])
  );

COMMENT ON POLICY wb_audit_log_officer_read ON whistleblowing_audit_log IS
  'ADR-011 rev.2 §82-83 / S07-09: nur whistleblowing_officer und ombudsperson, und nur im eigenen Mandanten. admin stand hier entgegen der eigenen Spezifikation in der Allowlist.';
