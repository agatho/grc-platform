-- Migration 0398: SECURITY-DEFINER-Funktionen härten (search_path, EXECUTE, Org-Prüfung)
--
-- Migration: 0398_secdef_function_hardening
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP2 · S01-13]
--
-- Befund S01-13 (Medium): drei SECURITY-DEFINER-Funktionen laufen mit den
-- Rechten des Superusers `grc`, tragen KEIN `SET search_path` (proconfig = -)
-- und haben `EXECUTE` an PUBLIC (acl = default):
--
--     audit_trigger | tombstone_audit_entry | whistleblowing_audit_trigger
--
-- Die schwerste Folge ist `tombstone_audit_entry`: die Funktion sucht und
-- ändert `audit_log` allein über die ID, ohne jede Org-Prüfung. Ein Aufruf
--
--     SELECT tombstone_audit_entry('<UUID eines Fremdmandanten>', 'x');
--
-- redigiert unwiederbringlich E-Mail, Name, IP und die PII-Felder eines
-- fremden Audit-Eintrags — mandantenübergreifend, irreversibel, und ohne dass
-- die Hash-Kette es als Bruch meldet, weil der Tombstone-Pfad vorgesehen ist.
--
-- Drei Massnahmen:
--
-- 1. `SET search_path = pg_catalog, public` auf allen SECURITY-DEFINER-
--    Funktionen. Heute entschärft dadurch, dass `grc_app` in `public` nichts
--    anlegen darf (nspacl gibt PUBLIC nur USAGE) — das ist aber eine
--    Eigenschaft der Schemarechte, keine der Funktion, und sie kann sich
--    ändern. Die Fixierung ist eine Zeile.
--    `ALTER FUNCTION ... SET` ändert NUR die Ausführungsumgebung, nicht den
--    Rumpf — die Trigger-Funktionen selbst bleiben unangetastet (sie gehören
--    WP4 bzw. WP8).
--
-- 2. `REVOKE EXECUTE ... FROM PUBLIC`. Für die beiden Trigger-Funktionen ist
--    das folgenlos: PostgreSQL prüft die EXECUTE-Berechtigung einer
--    Trigger-Funktion bei CREATE TRIGGER, nicht beim Auslösen. Ein direkter
--    Aufruf durch `grc_app` — der einzige Weg, sie ausserhalb eines Triggers
--    zu missbrauchen — ist danach verboten.
--
-- 3. Org-Prüfung in `tombstone_audit_entry`. Die Funktion bleibt für
--    `grc_app` aufrufbar (die Route `dpms/audit-log-tombstone` braucht sie),
--    prüft aber jetzt selbst, dass der Eintrag zur aufrufenden Org gehört.
--    Der Rumpf ist ansonsten UNVERÄNDERT übernommen.
--
--    Abgrenzung: die Funktion gehört fachlich zu WP8 (S07-03,
--    Tombstone-Reversibilität) und wird dort möglicherweise neu geschrieben.
--    Der Guard darf dabei nicht verlorengehen —
--    `packages/db/tests/rls/tenant-isolation-systemtest.test.ts` prüft ihn
--    (`tombstone_audit_entry` auf einen fremden Eintrag muss scheitern) und
--    schlägt fehl, falls er entfernt wird.
--
--    Kontextloser Aufruf (Org-GUC nicht gesetzt) wird bewusst ERLAUBT: der
--    DSGVO-Löschlauf im Worker ruft die Funktion org-übergreifend auf und
--    läuft dort als Superuser. Der Guard greift also genau dort, wo ein
--    Mandantenkontext existiert — im HTTP-Pfad.

-- ---------------------------------------------------------------------------
-- 1./2. search_path + EXECUTE
-- ---------------------------------------------------------------------------
DO $harden$
DECLARE
  f RECORD;
  v_count int := 0;
BEGIN
  FOR f IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
     ORDER BY p.proname
  LOOP
    IF (SELECT proconfig FROM pg_proc WHERE oid = f.oid) IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM unnest((SELECT proconfig FROM pg_proc WHERE oid = f.oid)) c
          WHERE c LIKE 'search_path=%')
    THEN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = pg_catalog, public',
                     f.proname, f.args);
    END IF;

    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC',
                   f.proname, f.args);
    v_count := v_count + 1;
  END LOOP;

  -- Die Anwendung ruft genau eine dieser Funktionen direkt auf.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'tombstone_audit_entry')
  THEN
    GRANT EXECUTE ON FUNCTION public.tombstone_audit_entry(uuid, text) TO grc_app;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef AND p.proconfig IS NULL)
  THEN
    RAISE EXCEPTION 'S01-13: SECURITY-DEFINER-Funktion ohne search_path verblieben';
  END IF;

  RAISE NOTICE 'S01-13: % SECURITY-DEFINER-Funktionen gehärtet', v_count;
END
$harden$;

-- ---------------------------------------------------------------------------
-- 3. Org-Prüfung in tombstone_audit_entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tombstone_audit_entry(p_audit_log_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_existing audit_log%ROWTYPE;
  v_new_changes jsonb;
  v_email_hash text;
  v_name_hash text;
  v_ctx_org uuid;
BEGIN
  SELECT * INTO v_existing FROM audit_log WHERE id = p_audit_log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit log entry % does not exist', p_audit_log_id;
  END IF;

  -- [WP2 / S01-13] Mandantenprüfung. Die Funktion läuft als SECURITY DEFINER
  -- mit Superuser-Rechten und umgeht deshalb die RLS von audit_log; ohne
  -- diesen Guard ist sie eine mandantenübergreifende Manipulationsprimitive
  -- für jede Rolle mit SQL-Zugang. Ist KEIN Org-Kontext gesetzt (Worker-/
  -- Retention-Pfad, läuft ohnehin als Superuser), bleibt das Verhalten
  -- unverändert.
  v_ctx_org := (NULLIF(current_setting('app.current_org_id', true), ''))::uuid;
  IF v_ctx_org IS NOT NULL AND v_existing.org_id IS DISTINCT FROM v_ctx_org THEN
    RAISE EXCEPTION
      'Audit log entry % belongs to a different organization', p_audit_log_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_existing.pii_tombstoned_at IS NOT NULL THEN
    RAISE EXCEPTION 'Audit log entry % is already tombstoned (reason=%)',
      p_audit_log_id, v_existing.pii_tombstone_reason;
  END IF;

  -- Deterministic hashes using entry_hash as salt
  v_email_hash := encode(digest(COALESCE(v_existing.user_email, '') || '|' || v_existing.entry_hash, 'sha256'), 'hex');
  v_name_hash  := encode(digest(COALESCE(v_existing.user_name, '')  || '|' || v_existing.entry_hash, 'sha256'), 'hex');

  -- Redact PII from `changes` JSON
  v_new_changes := v_existing.changes;
  IF v_new_changes ? 'new' AND v_new_changes->'new' IS NOT NULL THEN
    v_new_changes := jsonb_set(v_new_changes, '{new}',
      redact_pii_jsonb(v_new_changes->'new', v_existing.entry_hash));
  END IF;
  IF v_new_changes ? 'old' AND v_new_changes->'old' IS NOT NULL THEN
    v_new_changes := jsonb_set(v_new_changes, '{old}',
      redact_pii_jsonb(v_new_changes->'old', v_existing.entry_hash));
  END IF;

  UPDATE audit_log SET
    user_email = '__tombstoned__:' || v_email_hash,
    user_name  = '__tombstoned__:' || v_name_hash,
    ip_address = NULL,
    changes    = v_new_changes,
    pii_tombstoned_at = now(),
    pii_tombstone_reason = p_reason
  WHERE id = p_audit_log_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.tombstone_audit_entry(uuid, text) FROM PUBLIC;

DO $regrant$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION public.tombstone_audit_entry(uuid, text) TO grc_app;
  END IF;
END $regrant$;
