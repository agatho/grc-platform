-- Migration 0412: Auflösung anonymer Zugangstoken unter `grc_app` (RLS-Henne-Ei)
--
-- Migration: 0412_anonymous_token_resolution
-- Breaking: no
-- Estimated-Duration: 2
-- Locking: none
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP3 · S02-05, S02-09, S02-23]
--
-- Befund S02-05 (per SQL reproduziert): Alle anonymen Token-Endpunkte lesen
-- ihre Zugangstabelle OHNE etablierten Request-Kontext — es kann keinen geben,
-- weil die Organisation erst AUS dem Token folgt. Unter der Produktions-Rolle
-- `grc_app` (rolsuper=f, rolbypassrls=f) greifen die FORCE-RLS-Policies:
--
--   grc_app OHNE app.current_org_id → 0 Zeilen
--   grc_app MIT  app.current_org_id → 1 Zeile
--
-- Fachliche Wirkung: Einladungen konnten nie angenommen werden, SCIM
-- antwortete auf jedes gültige Bearer-Token mit 401 (Deprovisioning von
-- Ausgeschiedenen lief also nicht), das Lieferantenportal und der
-- HinSchG-Meldekanal waren tot.
--
-- LÖSUNG (bewusst eng begrenzt):
-- Statt die RLS-Policies aufzuweichen — die gehören WP2 — kapselt diese
-- Migration GENAU die Token-Auflösung in SECURITY-DEFINER-Funktionen:
--   * jede Funktion nimmt ein Token bzw. einen Token-Hash entgegen und gibt
--     ausschließlich die Felder zurück, die der Aufrufer zur Ermittlung des
--     Org-Kontexts braucht — nie den ganzen Datensatz, nie eine Liste;
--   * `SET search_path = pg_catalog, public` gegen Search-Path-Hijacking
--     (S01-13);
--   * `REVOKE ... FROM PUBLIC` + gezielter `GRANT` an `grc_app`;
--   * die Anwendung setzt danach den Org-Kontext über `withOrgReadContext`
--     und führt ALLE weiteren Abfragen wieder unter voller RLS aus.
--
-- Hinweis an WP2 (Policy-Seite, NICHT hier geändert): sollte WP2 die
-- Token-Auflösung stattdessen policy-seitig lösen wollen, wären dafür je
-- Tabelle eine SELECT-Policy nötig, die auf einen gesetzten Token-GUC prüft
-- (z. B. `token = NULLIF(current_setting('app.presented_token', true), '')`).
-- Solange es die nicht gibt, sind diese Funktionen der einzige Weg, unter
-- `grc_app` überhaupt an die Zeile zu kommen. Siehe /work/audit/remediation/WP3.md.

-- ── Einladung ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_resolve_invitation_token(p_token text)
RETURNS TABLE (
  id uuid, org_id uuid, email varchar, role user_role,
  line_of_defense line_of_defense, status invitation_status,
  expires_at timestamptz, invited_by uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT i.id, i.org_id, i.email, i.role, i.line_of_defense,
         i.status, i.expires_at, i.invited_by
    FROM public.invitation i
   WHERE i.token = p_token
   LIMIT 1;
$$;

-- ── SCIM-Bearer-Token ───────────────────────────────────────────────
-- Nimmt den HASH entgegen, nie das Klartext-Token: die Anwendung hasht
-- weiterhin selbst, die Funktion sieht das Geheimnis nicht.
CREATE OR REPLACE FUNCTION public.auth_resolve_scim_token(p_token_hash text)
RETURNS TABLE (
  id uuid, org_id uuid, is_active boolean,
  expires_at timestamptz, revoked_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT t.id, t.org_id, t.is_active, t.expires_at, t.revoked_at
    FROM public.scim_token t
   WHERE t.token_hash = p_token_hash
   LIMIT 1;
$$;

-- `last_used_at` lief bisher als nacktes UPDATE ohne try/catch und scheiterte
-- unter `grc_app` an derselben FORCE-RLS-Policy — die Authentifizierung konnte
-- also NACH erfolgreicher Tokenprüfung noch mit 500 abbrechen (S02-15).
CREATE OR REPLACE FUNCTION public.auth_touch_scim_token(p_token_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path = pg_catalog, public
AS $$
  UPDATE public.scim_token SET last_used_at = now() WHERE id = p_token_id;
$$;

-- ── Lieferantenportal (Due Diligence) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_resolve_dd_session_token(p_token_hash text)
RETURNS TABLE (id uuid, org_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT s.id, s.org_id
    FROM public.dd_session s
   WHERE s.access_token_hash = p_token_hash
   LIMIT 1;
$$;

-- ── Anonymes Hinweisgeber-Postfach ──────────────────────────────────
-- `wb_anonymous_mailbox` hat kein eigenes `org_id`; die Org hängt am
-- `wb_report`. Genau dieser Join ist der Grund, warum die Auflösung ohne
-- Org-Kontext unter `grc_app` nie funktionieren konnte.
CREATE OR REPLACE FUNCTION public.auth_resolve_wb_mailbox_token(p_token text)
RETURNS TABLE (id uuid, report_id uuid, org_id uuid, expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT m.id, m.report_id, r.org_id, m.expires_at
    FROM public.wb_anonymous_mailbox m
    JOIN public.wb_report r ON r.id = m.report_id
   WHERE m.token = p_token
   LIMIT 1;
$$;

-- ── Organisation über den öffentlichen orgCode (HinSchG-Meldeportal) ─
CREATE OR REPLACE FUNCTION public.auth_resolve_org_by_code(p_org_code text)
RETURNS TABLE (id uuid, name varchar, short_name varchar)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT o.id, o.name, o.short_name
    FROM public.organization o
   WHERE o.org_code = p_org_code
     AND o.deleted_at IS NULL
   LIMIT 1;
$$;

-- ── iCal-Feed-Token ─────────────────────────────────────────────────
-- Löst Token → (user_id, org_id) auf. Der Handler setzte den Org-Kontext
-- bisher per `set_config(..., false)` auf einer Pool-Verbindung (S02-08).
CREATE OR REPLACE FUNCTION public.auth_resolve_ical_token(p_token_hash text)
RETURNS TABLE (user_id uuid, org_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT u.id AS user_id, r.org_id
    FROM public."user" u
    JOIN public.user_organization_role r ON r.user_id = u.id
   WHERE u.ical_token_hash = p_token_hash
     AND u.is_active = true
     AND u.deleted_at IS NULL
     AND r.deleted_at IS NULL
   ORDER BY r.created_at ASC
   LIMIT 1;
$$;

-- ── SAML-Replay-Verbrauch (instanzübergreifend, S02-23) ─────────────
-- Gibt true zurück, wenn die Assertion-ID NEU war (also verbraucht werden
-- durfte), und false bei einem Replay.
CREATE OR REPLACE FUNCTION public.auth_consume_saml_assertion(
  p_assertion_id text, p_org_id uuid, p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  DELETE FROM public.saml_assertion_replay WHERE expires_at < now();
  INSERT INTO public.saml_assertion_replay (assertion_id, org_id, expires_at)
  VALUES (p_assertion_id, p_org_id, p_expires_at)
  ON CONFLICT (assertion_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted = 1;
END;
$$;

-- ── Login-Lockout (S02-09) ──────────────────────────────────────────
-- Der Credentials-Provider läuft ebenfalls ohne Request-Kontext (die Org ist
-- vor dem Login unbekannt) und kann `user` unter `grc_app` daher weder lesen
-- noch zählen. Diese beiden Funktionen kapseln GENAU den Zähler.
CREATE OR REPLACE FUNCTION public.auth_check_login_lock(p_email text)
RETURNS TABLE (out_locked boolean, out_locked_until timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT (u.locked_until IS NOT NULL AND u.locked_until > now()) AS out_locked,
         u.locked_until AS out_locked_until
    FROM public."user" u
   WHERE lower(u.email) = lower(p_email)
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_register_login_failure(
  p_email text, p_max_attempts integer, p_lock_minutes integer
)
RETURNS TABLE (out_attempts integer, out_locked_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public."user" u
     SET failed_login_attempts = u.failed_login_attempts + 1,
         last_failed_login_at  = now(),
         locked_until = CASE
           WHEN u.failed_login_attempts + 1 >= p_max_attempts
             THEN now() + make_interval(mins => p_lock_minutes)
           ELSE u.locked_until
         END
   WHERE lower(u.email) = lower(p_email)
  RETURNING u.failed_login_attempts, u.locked_until;
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_register_login_success(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path = pg_catalog, public
AS $$
  UPDATE public."user"
     SET failed_login_attempts = 0,
         locked_until = NULL,
         last_login_at = now()
   WHERE id = p_user_id;
$$;

-- ── Plattform-Admin-Prüfung (S02-03) ────────────────────────────────
-- Selbstauskunft; funktioniert auch ohne gesetzten `app.current_user_id`.
CREATE OR REPLACE FUNCTION public.auth_is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admin
     WHERE user_id = p_user_id AND revoked_at IS NULL
  );
$$;

-- ── Rechtevergabe ───────────────────────────────────────────────────
-- S01-13: SECURITY-DEFINER-Funktionen dürfen NICHT mit EXECUTE an PUBLIC
-- stehen. Erst entziehen, dann gezielt an die Laufzeitrolle geben.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.auth_resolve_invitation_token(text)',
    'public.auth_resolve_scim_token(text)',
    'public.auth_touch_scim_token(uuid)',
    'public.auth_resolve_dd_session_token(text)',
    'public.auth_resolve_wb_mailbox_token(text)',
    'public.auth_resolve_org_by_code(text)',
    'public.auth_resolve_ical_token(text)',
    'public.auth_consume_saml_assertion(text, uuid, timestamptz)',
    'public.auth_check_login_lock(text)',
    'public.auth_register_login_failure(text, integer, integer)',
    'public.auth_register_login_success(uuid)',
    'public.auth_is_platform_admin(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO grc_app', fn);
    END IF;
  END LOOP;
END
$$;
