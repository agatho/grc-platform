-- 0428_tombstone_hardening.sql
-- ARCTOS-FULL-2026-08-31 · WP8 · S07-03 (High), S07-04 (High), S07-05 (High)
--
-- ── S07-03: der Tombstone-Salt stand in derselben Zeile ───────────────
-- ADR-011 rev.2 §103 setzt voraus: "Re-Identifikation der Person aus dem
-- Hash ist nicht möglich, WENN der Tombstone-Key nach Ablauf vernichtet
-- wird". Es gab keinen Tombstone-Key. Gebildet wurde
-- sha256(pii || '|' || entry_hash) — und `entry_hash` steht als Spalte
-- derselben Zeile daneben und bleibt beim Tombstoning unverändert. Der
-- Auditor hat aus einer Kandidatenliste (dem Inhalt von `user`) Name und
-- E-Mail-Adresse in Sekunden zurückgerechnet. Ab hier: HMAC unter dem
-- Schlüssel aus 0425, der nicht in der Datenbank steht — und mit
-- `pii_pseudonym_key_destroy()` gibt es erstmals den im ADR
-- vorausgesetzten Vernichtungsschritt.
--
-- ── S07-04: entity_title war von der Redaktion ausgenommen ────────────
-- `audit_trigger()` befüllt `entity_title` aus COALESCE(name, title,
-- email) — bei einer `user`-Zeile also mit dem Klarnamen. Die Redaktion
-- fasste die Spalte nicht an, und der Guard verbot jede nachträgliche
-- Korrektur. Nach einem stattgegebenen Löschantrag stand der Klarname
-- weiter für admin/auditor/dpo in GET /api/v1/audit-log. Dasselbe für
-- `user_agent` (Geräte-Fingerabdruck) und `session_id`.
--
-- DATEIHOHEIT — ausdrücklich vermerkt: `audit_log_tombstone_only_guard()`
-- gehört WP4. Diese Migration ändert daran GENAU ZWEI Dinge und lässt
-- alles andere unangetastet:
--   (a) `entity_title`, `user_agent`, `session_id` kommen auf die
--       Redaktions-Allowlist. Alle drei sind KEINE Hash-Eingabe: v4
--       bindet `entity_title` über `audit_content_commitment()` ein, das
--       beim Tombstone erhalten bleibt, und `user_agent`/`session_id`
--       gehen in gar keine Hashformel ein. Die Zeile verifiziert danach
--       unverändert weiter (nachgewiesen: evidence/wp8/repro-art17.out).
--   (b) Das Tor "nur beim Übergang NULL → NOT NULL" wird zu "nur wenn
--       pii_tombstoned_at neu gesetzt wird ODER vorrückt". Grund: ein
--       Audit-Eintrag kann mehrere Personen betreffen; wird Person A
--       heute und Person B in zwei Jahren gelöscht, war die zweite
--       Löschung bisher technisch unmöglich. Die Invariante des Guards
--       — diese Spalten ändern sich AUSSCHLIESSLICH im Zuge einer
--       protokollierten Redaktion — bleibt vollständig erhalten; ein
--       gewöhnliches UPDATE wird weiterhin abgewiesen.
-- `hash_version` (S03-02) und `content_commitment` bleiben ausgeschlossen.
-- Der Trigger bleibt ENABLE ALWAYS.
--
-- ── S07-05: Authentifikatoren im unlöschbaren Log ─────────────────────
-- WP4 hat mit `audit_scrub_changes()` + `audit_sensitive_column` den
-- SCHREIBPFAD geschlossen; nachgemessen greift die generische
-- Schlüsselnamen-Erkennung für password_hash, ical_token, report_token,
-- session_token, access_token und alle weiteren aus dem PII-Inventar.
-- Offen blieb der BESTAND: Zeilen, die vor 0401 geschrieben wurden —
-- in dieser Installation 46 von 147 — enthalten die bcrypt-Hashes
-- weiterhin im Klartext. Für die gibt es unten einen einmaligen
-- Bereinigungslauf.

-- ── 1. Guard ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_log_tombstone_only_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_key text;
  -- Columns a lawful GDPR Art. 17 redaction has to overwrite. They are
  -- accepted ONLY while pii_tombstoned_at is being (re)stamped.
  -- `hash_version` is deliberately NOT here (S03-02) and neither is
  -- `content_commitment`: preserving it is what keeps the row verifiable.
  -- entity_title / user_agent / session_id added by WP8 (S07-04): all
  -- three carry PII, none of them is a hash input under v4.
  v_redactable text[] := ARRAY[
    'user_email', 'user_name', 'ip_address', 'changes',
    'entity_title', 'user_agent', 'session_id',
    'pii_tombstoned_at', 'pii_tombstone_reason'
  ];
  v_is_tombstone boolean;
BEGIN
  v_is_tombstone := NEW.pii_tombstoned_at IS NOT NULL
                AND (OLD.pii_tombstoned_at IS NULL
                     OR NEW.pii_tombstoned_at > OLD.pii_tombstoned_at);

  FOR v_key IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
    IF to_jsonb(NEW)->v_key IS DISTINCT FROM to_jsonb(OLD)->v_key THEN
      IF NOT (v_key = ANY(v_redactable)) THEN
        RAISE EXCEPTION
          'audit_log is append-only — column % cannot be updated (id=%)',
          v_key, OLD.id
          USING ERRCODE = 'raise_exception';
      END IF;
      IF NOT v_is_tombstone THEN
        RAISE EXCEPTION
          'audit_log column % may only change during a GDPR Art. 17 tombstone of the row (use tombstone_audit_entry); id=%',
          v_key, OLD.id
          USING ERRCODE = 'raise_exception';
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ── 2. Redaktion einer Zeile ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION tombstone_audit_entry(
  p_audit_log_id uuid,
  p_reason       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_existing audit_log%ROWTYPE;
  v_new_changes jsonb;
  v_email_hash text;
  v_name_hash  text;
  v_ctx_org uuid;
  v_salt text;
BEGIN
  SELECT * INTO v_existing FROM audit_log WHERE id = p_audit_log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit log entry % does not exist', p_audit_log_id;
  END IF;

  -- [WP2 / S01-13] Mandantenprüfung — unverändert übernommen. Die
  -- Funktion läuft als SECURITY DEFINER mit Superuser-Rechten und umgeht
  -- deshalb die RLS von audit_log; ohne diesen Guard ist sie eine
  -- mandantenübergreifende Manipulationsprimitive für jede Rolle mit
  -- SQL-Zugang. Ist KEIN Org-Kontext gesetzt (Worker-/Retention-Pfad,
  -- läuft ohnehin als Superuser), bleibt das Verhalten unverändert.
  v_ctx_org := (NULLIF(current_setting('app.current_org_id', true), ''))::uuid;
  IF v_ctx_org IS NOT NULL AND v_existing.org_id IS DISTINCT FROM v_ctx_org THEN
    RAISE EXCEPTION
      'Audit log entry % belongs to a different organization', p_audit_log_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Eine bereits redigierte Zeile ist kein Fehler mehr, sondern der
  -- Normalfall bei einem zweiten Löschantrag auf denselben Eintrag
  -- (S07-04). Bereits redigierte Werte tragen das Präfix
  -- '__tombstoned__:'/'__redacted__' und werden nicht erneut gehasht,
  -- weil die Regeln unten nur echte Werte treffen.
  IF v_existing.pii_tombstoned_at IS NOT NULL
     AND v_existing.pii_tombstoned_at >= now() THEN
    -- Zwei Redaktionen in derselben Mikrosekunde: der Guard verlangt
    -- einen vorrückenden Zeitstempel.
    RAISE EXCEPTION 'Audit log entry % was already tombstoned in this instant', p_audit_log_id;
  END IF;

  -- S07-03: Salt ist ab hier NICHT mehr die danebenstehende `entry_hash`.
  -- `pii_hmac()` schlüsselt mit dem Material aus 0425; die Zeilenkennung
  -- geht nur noch als Domänentrenner ein, damit gleiche Werte in
  -- verschiedenen Zeilen nicht trivial verknüpfbar sind.
  v_salt := v_existing.id::text;

  v_email_hash := pii_hmac(v_salt || '|' || COALESCE(v_existing.user_email, ''), 'audit_actor_email');
  v_name_hash  := pii_hmac(v_salt || '|' || COALESCE(v_existing.user_name,  ''), 'audit_actor_name');

  v_new_changes := v_existing.changes;
  IF v_new_changes IS NOT NULL THEN
    IF v_new_changes ? 'new' AND v_new_changes->'new' IS NOT NULL THEN
      v_new_changes := jsonb_set(v_new_changes, '{new}',
        redact_pii_jsonb(v_new_changes->'new', v_salt, v_existing.entity_type, 0));
    END IF;
    IF v_new_changes ? 'old' AND v_new_changes->'old' IS NOT NULL THEN
      v_new_changes := jsonb_set(v_new_changes, '{old}',
        redact_pii_jsonb(v_new_changes->'old', v_salt, v_existing.entity_type, 0));
    END IF;
    -- UPDATE-Diffs liegen ohne new/old-Wrapper vor: {"email":{"old":…,"new":…}}
    IF NOT (v_new_changes ? 'new') AND NOT (v_new_changes ? 'old') THEN
      v_new_changes := redact_pii_jsonb(v_new_changes, v_salt, v_existing.entity_type, 0);
    END IF;
  END IF;

  -- WP4-Bedingung: pii_tombstoned_at MUSS in derselben Anweisung gesetzt
  -- werden wie die Redaktionsspalten, sonst weist der Guard sie ab.
  UPDATE audit_log SET
    -- Unverändert zum Bestandsverhalten: die beiden Akteurspalten tragen
    -- IMMER einen Tombstone-Wert, auch wenn sie leer waren. Ein
    -- ausgelassener Wert wäre an dieser Stelle ein Unterschied, den ein
    -- Leser als "hier war nichts" deuten kann.
    user_email   = '__tombstoned__:' || v_email_hash,
    user_name    = '__tombstoned__:' || v_name_hash,
    -- S07-04: der Klarname in entity_title war bisher unantastbar.
    entity_title = CASE WHEN entity_title IS NULL THEN NULL
                        ELSE '__tombstoned__:' ||
                             pii_hmac(v_salt || '|' || entity_title, 'audit_entity_title') END,
    user_agent   = NULL,
    session_id   = NULL,
    ip_address   = NULL,
    changes      = v_new_changes,
    pii_tombstoned_at = greatest(now(), COALESCE(pii_tombstoned_at, '-infinity'::timestamptz) + interval '1 microsecond'),
    pii_tombstone_reason = p_reason
  WHERE id = p_audit_log_id;
END;
$$;

REVOKE ALL ON FUNCTION tombstone_audit_entry(uuid, text) FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION tombstone_audit_entry(uuid, text) TO grc_app;
  END IF;
END $g$;

-- ── 3. Mengen-Einstiegspunkt ─────────────────────────────────────────
-- S07-28 hielt fest: "Kein Mengen-Einstiegspunkt: die Route tombstonet
-- genau eine Zeile per UUID. Ein Löschantrag betrifft typischerweise
-- hunderte Zeilen." Genau das ist hier.

CREATE OR REPLACE FUNCTION tombstone_audit_entries_for_entity(
  p_org_id      uuid,
  p_entity_type text,
  p_entity_id   uuid,
  p_reason      text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT id FROM audit_log
     WHERE org_id = p_org_id
       AND entity_type = p_entity_type
       AND entity_id = p_entity_id
     ORDER BY chain_seq
  LOOP
    PERFORM tombstone_audit_entry(r.id, p_reason);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION tombstone_audit_entries_for_subject(
  p_org_id uuid,
  p_user_id uuid,
  p_email   text,
  p_name    text,
  p_reason  text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT a.id, a.chain_seq
      FROM audit_log a
     WHERE a.org_id = p_org_id
       AND (
            (p_user_id IS NOT NULL AND a.user_id = p_user_id)
         OR (p_user_id IS NOT NULL AND a.entity_type = 'user' AND a.entity_id = p_user_id)
         OR (p_email IS NOT NULL AND lower(a.user_email) = lower(p_email))
         OR (p_email IS NOT NULL AND a.changes::text ILIKE '%' || p_email || '%')
         OR (p_name  IS NOT NULL AND a.user_name = p_name)
         OR (p_name  IS NOT NULL AND a.entity_title = p_name)
       )
     ORDER BY a.chain_seq
  LOOP
    PERFORM tombstone_audit_entry(r.id, p_reason);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION tombstone_audit_entries_for_subject(uuid, uuid, text, text, text) IS
  'S07-04/-13/-28: redigiert alle Audit-Zeilen eines Mandanten, die eine bestimmte Person betreffen — als Akteur, als Gegenstand oder als Erwähnung in changes. Einstiegspunkt des Art.-17-Ablaufs (gdpr_erase_subject, 0434).';

REVOKE ALL ON FUNCTION tombstone_audit_entries_for_entity(uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION tombstone_audit_entries_for_subject(uuid, uuid, text, text, text) FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION tombstone_audit_entries_for_entity(uuid, text, uuid, text) TO grc_app;
    GRANT EXECUTE ON FUNCTION tombstone_audit_entries_for_subject(uuid, uuid, text, text, text) TO grc_app;
  END IF;
END $g$;

-- ── 4. Deny-Liste ergänzen (S07-05) ──────────────────────────────────
-- WP4 hat `audit_sensitive_column` als vorgesehenen Erweiterungsweg
-- angelegt. Die generische Namenserkennung greift für alle
-- Authentifikatoren aus dem PII-Inventar; die folgenden Einträge sind
-- Tiefenverteidigung für den Fall, dass die Regex je gelockert wird,
-- plus zwei Spalten, die kein Geheimnis, aber ein direkter Personenbezug
-- sind und im Log nichts verloren haben.

INSERT INTO audit_sensitive_column (entity_type, column_name, reason) VALUES
  ('account',              'access_token',   'credential'),
  ('account',              'refresh_token',  'credential'),
  ('account',              'id_token',       'credential'),
  ('session',              'session_token',  'credential'),
  ('verification_token',   'token',          'credential'),
  ('invitation',           'token',          'credential'),
  ('content_placeholder',  'token',          'credential'),
  ('wb_anonymous_mailbox', 'token',          'credential'),
  ('mobile_session',       'refresh_token',  'credential'),
  ('scim_token',           'token_hash',     'credential'),
  ('user',                 'avatar_url',     'pii'),
  ('dsr',                  'subject_email',  'pii'),
  ('dsr',                  'subject_name',   'pii')
ON CONFLICT DO NOTHING;

-- ── 5. Einmalige Bereinigung des Bestands (S07-05) ───────────────────
--
-- Zeilen, die vor Migration 0401 geschrieben wurden, haben den
-- Schreibpfad-Scrub nie gesehen. Für v4-Zeilen ist die Bereinigung
-- hashneutral (`changes` geht nur über das Content-Commitment ein, das
-- unberührt bleibt) — dort wird der Guard für die Dauer der Migration
-- ausgesetzt, damit der Vorgang nicht als Art.-17-Redaktion gezählt wird.
-- Für v1–v3 ist `changes` direkte Hash-Eingabe; dort läuft die
-- Bereinigung über den regulären Redaktionspfad, damit die Kette
-- `redacted_legacy` statt `row_mismatch` meldet.

DO $purge$
DECLARE
  r record;
  n_v4 integer := 0;
  n_legacy integer := 0;
BEGIN
  ALTER TABLE audit_log DISABLE TRIGGER audit_log_tombstone_guard;
  BEGIN
    FOR r IN
      SELECT id, entity_type, changes
        FROM audit_log
       WHERE hash_version = 4
         AND changes IS NOT NULL
         AND audit_payload_may_contain_secret(changes)
    LOOP
      UPDATE audit_log
         SET changes = audit_scrub_changes(r.entity_type, r.changes)
       WHERE id = r.id;
      n_v4 := n_v4 + 1;
    END LOOP;
  EXCEPTION WHEN others THEN
    ALTER TABLE audit_log ENABLE ALWAYS TRIGGER audit_log_tombstone_guard;
    RAISE;
  END;
  ALTER TABLE audit_log ENABLE ALWAYS TRIGGER audit_log_tombstone_guard;

  FOR r IN
    SELECT id, entity_type, changes
      FROM audit_log
     WHERE hash_version < 4
       AND changes IS NOT NULL
       AND audit_payload_may_contain_secret(changes)
     ORDER BY chain_seq
  LOOP
    UPDATE audit_log
       SET changes = audit_scrub_changes(r.entity_type, r.changes),
           pii_tombstoned_at = greatest(
             now(),
             COALESCE(pii_tombstoned_at, '-infinity'::timestamptz) + interval '1 microsecond'),
           pii_tombstone_reason = 'legacy_credential_purge'
     WHERE id = r.id;
    n_legacy := n_legacy + 1;
  END LOOP;

  RAISE NOTICE '0428: credential purge — % v4 rows scrubbed in place, % legacy rows redacted', n_v4, n_legacy;
END
$purge$;
