-- Migration 0456: kontextlose Disjunktion aus den `user`-Policies entfernen
--
-- Migration: 0456_user_policy_drop_contextless
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 · OP-083]  (setzt 0455 voraus)
--
-- Migration 0392 hat `user` mitgliedschaftsskaliert und dabei bewusst eine
-- dritte Disjunktion stehen lassen:
--
--     sichtbar, wenn (a) es die eigene Zeile ist
--                 ODER (b) Mitgliedschaft in der aktuellen Org
--                 ODER (c) die Verbindung traegt GAR KEINEN Kontext
--
-- (c) war der Preis dafuer, dass der Anmeldepfad `user` per E-Mail lesen muss,
-- bevor eine Identitaet feststeht. WP2 hat den Rest ausdruecklich als offene
-- Luecke benannt und den sauberen Weg an WP3 uebergeben (S02-05).
--
-- Reproduktion vor dieser Migration, als `grc_app` gegen eine frisch
-- migrierte Datenbank:
--
--     -- ohne jeden Kontext (Basis-Pool: Login, admin-login, SCIM)
--     SELECT count(*) FROM "user";                       -> 36
--     SELECT email, left(password_hash,12) FROM "user";   -> alle Mandanten
--     -- mit app.current_org_id des eigenen Mandanten
--     SELECT count(*) FROM "user";                       ->  1
--
-- (c) faellt jetzt weg. Alle Pfade, die sie gebraucht haben, sind vorher
-- umgestellt:
--
--   * `providers.ts` credentials-`authorize`      -> auth_lookup_user_by_email (0455)
--   * `providers.ts` jitProvisionSsoUser          -> auth_lookup_user_by_email,
--                                                    auth_sso_touch_login,
--                                                    auth_sso_provision_user (0455)
--   * `api/v1/auth/admin-login`                   -> auth_lookup_user_by_email (0455)
--   * `api/v1/scim/v2/**` (10 Handler)            -> runWithRequestContext(orgId)
--   * `apps/web/src/auth.ts` fetchFreshRoles      -> withUserReadContext (unveraendert)
--   * SSO-Callbacks, invitations/accept           -> withOrgReadContext (unveraendert)
--   * Login-Lockout, Token-Aufloeser              -> SECURITY DEFINER (0411/0412)
--   * Seeds/Migrationen (grc), Worker (grc_worker) -> RLS-frei bzw. BYPASSRLS
--
-- Die Ausfallrichtung ist damit geschlossen: wer kuenftig VERGISST, einen
-- Kontext zu setzen, sieht NICHTS statt ALLES. Genau das ist der Unterschied,
-- den S01-21 fuer die uebrigen Tabellen bereits durchgesetzt hat.
--
-- INSERT bleibt permissiv (`WITH CHECK true`) — eine `user`-Zeile ohne
-- Mitgliedschaft ist kein Mandantendatum; die Mandantenbindung entsteht in
-- `user_organization_role`, und die traegt eigene RLS. DELETE war schon vorher
-- strikt org-gebunden und bleibt unveraendert.

DO $user_noctx$
DECLARE
  v_org  CONSTANT text :=
    '(NULLIF(current_setting(''app.current_org_id'', true), ''''))::uuid';
  v_uid  CONSTANT text :=
    '(NULLIF(current_setting(''app.current_user_id'', true), ''''))::uuid';
  v_member text;
  v_left   integer;
BEGIN
  IF to_regclass('public.user') IS NULL THEN
    RAISE EXCEPTION 'OP-083: Tabelle public."user" fehlt';
  END IF;

  -- Voraussetzung aus 0455. Ohne die Kapsel wuerde diese Migration den Login
  -- abschalten; lieber laut abbrechen als still ausschliessen.
  IF to_regprocedure('public.auth_lookup_user_by_email(text)') IS NULL THEN
    RAISE EXCEPTION
      'OP-083: auth_lookup_user_by_email fehlt — Migration 0455 zuerst einspielen';
  END IF;

  v_member := format(
    'EXISTS (SELECT 1 FROM public.user_organization_role r
              WHERE r.user_id = public."user".id AND r.org_id = %s)',
    v_org);

  EXECUTE 'DROP POLICY IF EXISTS user_tenant_select ON public."user"';
  EXECUTE format(
    'CREATE POLICY user_tenant_select ON public."user" FOR SELECT
       USING (public."user".id = %s OR %s)',
    v_uid, v_member);

  EXECUTE 'DROP POLICY IF EXISTS user_tenant_update ON public."user"';
  EXECUTE format(
    'CREATE POLICY user_tenant_update ON public."user" FOR UPDATE
       USING (public."user".id = %s OR %s)
       WITH CHECK (public."user".id = %s OR %s)',
    v_uid, v_member, v_uid, v_member);

  -- Endzustand pruefen: keine `user`-Policy darf noch auf die Abwesenheit
  -- eines Kontexts abstellen. Eine Migration, die stillschweigend nichts
  -- bewirkt, waere hier besonders teuer — sie wuerde eine geschlossene Luecke
  -- behaupten.
  --
  -- Das Muster ist bewusst am NORMALISIERTEN Ausdruck festgemacht, den
  -- `pg_policies` zurueckgibt, nicht an dem, den diese Datei schreibt.
  -- PostgreSQL klammert beim Speichern um: aus
  --     ... IS NULL AND ... IS NULL
  -- wird
  --     ((...) IS NULL) AND ((...) IS NULL)
  -- Ein erster Entwurf dieser Pruefung suchte nach 'IS NULL AND' und lief
  -- deshalb auch dann durch, wenn die Disjunktion noch stand — gegengeprueft,
  -- indem die alte Policy wiederhergestellt wurde. Gesucht wird jetzt die
  -- Signatur "das Ergebnis eines GUC-NULLIF wird mit NULL verglichen", und die
  -- ueberlebt jede Umklammerung.
  SELECT count(*) INTO v_left
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  = 'user'
     AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
           ~ $re$current_setting\('app\.current_(org|user)_id'::text, true\), ''::text\) IS NULL$re$;

  IF v_left > 0 THEN
    RAISE EXCEPTION
      'OP-083: % user-Policy(s) stellen weiterhin auf einen fehlenden Kontext ab', v_left;
  END IF;

  RAISE NOTICE 'OP-083: kontextlose Disjunktion aus user_tenant_select/_update entfernt';
END
$user_noctx$;
