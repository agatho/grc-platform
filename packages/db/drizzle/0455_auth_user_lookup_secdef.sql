-- Migration 0455: Anmeldeabfrage auf `user` über SECURITY DEFINER
--
-- Migration: 0455_auth_user_lookup_secdef
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: none
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 · OP-083]  (Vorlauf zu 0456)
--
-- Befund: die `user`-Policies aus 0392 tragen eine dritte Disjunktion
--
--     ODER die Verbindung trägt WEDER app.current_org_id NOCH app.current_user_id
--
-- Sie steht dort, weil der Anmeldepfad `user` per E-Mail lesen muss, BEVOR
-- eine Identität feststeht. Der Preis dafür ist das gesamte Nutzerverzeichnis
-- aller Mandanten auf jeder kontextlosen Verbindung. Gemessen auf einer frisch
-- migrierten Datenbank als `grc_app`:
--
--     -- ohne jeden Kontext
--     SELECT count(*) FROM "user";                      -> 36
--     SELECT email, left(password_hash,12) FROM "user";  -> alle Mandanten
--     -- mit app.current_org_id des eigenen Mandanten
--     SELECT count(*) FROM "user";                      ->  1
--
-- Der Basis-Pool ist genau die Verbindungsklasse, auf der Login, `admin-login`
-- und die SCIM-Endpunkte arbeiten. Die Disjunktion ist damit keine theoretische
-- Restlücke: sie ist die einzige Policy im Schema, deren Wirkung davon abhängt,
-- ob der Aufrufer vergessen hat, einen Kontext zu setzen.
--
-- WP2 hat den sauberen Weg benannt und an WP3 übergeben (S02-05): die
-- Anmeldeabfrage über eine SECURITY-DEFINER-Funktion führen. Diese Migration
-- legt sie an; `0456` entfernt danach die Disjunktion. Zwei Migrationen, weil
-- die Funktion vorhanden sein MUSS, bevor die Policy fällt — sonst gäbe es
-- zwischen beiden einen Stand, in dem sich niemand mehr anmelden kann.
--
-- Warum SECURITY DEFINER hier sicher ist — dieselbe Begründung wie bei
-- `app_current_org_scope()` (0396) und den Token-Auflösern (0412):
--   * die Funktion nimmt eine E-Mail-Adresse entgegen und gibt HÖCHSTENS EINE
--     Zeile zurück. Es gibt keine Listenform, kein LIKE, kein Präfix — wer die
--     Adresse nicht schon kennt, bekommt nichts;
--   * sie gibt nur die Felder zurück, die der Anmeldepfad tatsächlich braucht.
--     `ical_token`, `ical_token_hash`, `external_id`, `sso_provider_id` und
--     alles Weitere bleiben draußen;
--   * `search_path` ist fixiert, `EXECUTE` ist PUBLIC entzogen und nur
--     `grc_app` erteilt (S01-13);
--   * `password_hash` IST enthalten — der Vergleich findet in der Anwendung
--     statt (bcrypt, mit Timing-Angleichung, S02-17). Ihn in der Datenbank zu
--     vergleichen hieße, das Klartextpasswort über die Verbindung zu schicken
--     und in `pg_stat_activity`/`log_statement` sichtbar zu machen. Der Hash
--     verlässt die Funktion, das Passwort betritt sie nie.

-- ── 1. Anmeldeabfrage per E-Mail ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_lookup_user_by_email(p_email text)
RETURNS TABLE (
  id                   uuid,
  email                varchar,
  name                 varchar,
  language             varchar,
  password_hash        varchar,
  is_active            boolean,
  must_change_password boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT u.id, u.email, u.name, u.language, u.password_hash,
         u.is_active, u.must_change_password
    FROM public."user" u
   WHERE lower(u.email) = lower(p_email)
     AND u.deleted_at IS NULL
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.auth_lookup_user_by_email(text) IS
  'OP-083: Anmeldeabfrage auf "user" ohne Request-Kontext. Genau eine Zeile, '
  'nur die Anmeldefelder. Ersetzt die kontextlose Disjunktion der user-Policy.';

-- ── 2. Anmeldebuchführung des SSO-Pfades ────────────────────────────
-- `jitProvisionSsoUser` setzt bei einem bereits vorhandenen Nutzer
-- `last_login_at`, verknüpft die SSO-Provider-ID und reaktiviert das Konto.
-- Das ist ein UPDATE auf `user` aus demselben kontextlosen Pfad; ohne die
-- Disjunktion greift keine UPDATE-Policy mehr. Gekapselt statt aufgeweicht.
--
-- Bewusst eng: die Funktion kann NUR diese drei Felder setzen, nur an einer
-- Zeile, die über ihre id benannt ist. Sie kann keine Rolle vergeben, kein
-- Passwort ändern und keine fremde Zeile anfassen, die der Aufrufer nicht
-- ohnehin schon identifiziert hat.
CREATE OR REPLACE FUNCTION public.auth_sso_touch_login(
  p_user_id uuid, p_sso_provider_id text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path = pg_catalog, public
AS $$
  UPDATE public."user"
     SET last_login_at   = now(),
         sso_provider_id = COALESCE(sso_provider_id, p_sso_provider_id),
         is_active       = true
   WHERE id = p_user_id
     AND deleted_at IS NULL;
$$;

COMMENT ON FUNCTION public.auth_sso_touch_login(uuid, text) IS
  'OP-083: SSO-JIT-Buchführung (last_login_at, sso_provider_id, is_active) '
  'ohne Request-Kontext. Setzt nur diese drei Felder an genau einer Zeile.';

-- ── 3. Neuanlage aus dem SSO-Pfad ───────────────────────────────────
-- Die INSERT-Policy auf `user` ist permissiv (`WITH CHECK true`) und bleibt es
-- auch nach 0456 — eine `user`-Zeile ohne Mitgliedschaft ist kein
-- Mandantendatum. Das `RETURNING` des Drizzle-INSERT läuft aber gegen die
-- SELECT-Policy, und die trifft ohne Kontext nach 0456 nicht mehr. Deshalb
-- auch hier eine Kapsel: anlegen und die Anmeldefelder zurückgeben.
CREATE OR REPLACE FUNCTION public.auth_sso_provision_user(
  p_email text, p_name text, p_sso_provider_id text, p_language text
)
RETURNS TABLE (id uuid, email varchar, name varchar, language varchar)
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path = pg_catalog, public
AS $$
  INSERT INTO public."user" (email, name, sso_provider_id, email_verified,
                             is_active, language, last_login_at)
  VALUES (lower(p_email), p_name, p_sso_provider_id, now(),
          true, COALESCE(p_language, 'de'), now())
  RETURNING public."user".id, public."user".email, public."user".name,
            public."user".language;
$$;

COMMENT ON FUNCTION public.auth_sso_provision_user(text, text, text, text) IS
  'OP-083: SSO-Just-in-time-Anlage ohne Request-Kontext. Legt ausschliesslich '
  'eine user-Zeile OHNE Rollen an — die Mitgliedschaft vergibt ein Administrator.';

-- ── 4. Rechtevergabe (S01-13-Muster) ────────────────────────────────
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.auth_lookup_user_by_email(text)',
    'public.auth_sso_touch_login(uuid, text)',
    'public.auth_sso_provision_user(text, text, text, text)'
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

-- ── 5. Endzustand prüfen ────────────────────────────────────────────
-- Eine Migration, die stillschweigend nichts bewirkt, ist der Placebo-Fix,
-- den ADR-023 und dieser Audit ausdrücklich verbieten.
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(f, ', ') INTO v_missing
    FROM unnest(ARRAY['auth_lookup_user_by_email',
                      'auth_sso_touch_login',
                      'auth_sso_provision_user']) AS f
   WHERE to_regprocedure('public.' || f || '(' ||
           CASE f
             WHEN 'auth_lookup_user_by_email' THEN 'text'
             WHEN 'auth_sso_touch_login'      THEN 'uuid, text'
             ELSE 'text, text, text, text'
           END || ')') IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'OP-083: Funktion(en) nicht angelegt: %', v_missing;
  END IF;
  RAISE NOTICE 'OP-083: drei SECURITY-DEFINER-Kapseln für den kontextlosen Anmeldepfad angelegt';
END
$$;
