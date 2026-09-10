-- Migration 0390: globalen RLS-Escape-Hatch `app.bypass_rls` entfernen
--
-- Migration: 0390_rls_remove_bypass_hatch
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP2 · S01-02, S01-23]
--
-- Befund S01-02 (High): 55 Policies auf 33 Kerntabellen (risk, control,
-- document, evidence, finding, asset, work_item, organization,
-- user_organization_role, ...) tragen die Klausel
--
--     current_setting('app.bypass_rls', true) = 'true'  OR  org_id = ...
--
-- `app.bypass_rls` ist ein benutzerdefinierter GUC. PostgreSQL kennt für
-- solche Parameter KEINEN Rechteschutz — `GRANT SET ON PARAMETER` gilt nur für
-- Systemparameter. Jede Rolle, auch die absichtlich unprivilegierte Runtime-
-- Rolle `grc_app`, darf ihn setzen. Ein einziges `SET app.bypass_rls='true'`
-- — aus einer SQL-Injection (S04), einem versehentlich mitgeschleppten Seed-
-- Aufruf oder einem Debug-Pfad — hebt die Mandantentrennung auf 33 Kern-
-- tabellen vollständig auf, lesend UND schreibend (26 der Policies sind
-- FOR ALL, PostgreSQL nutzt USING dort auch als WITH CHECK).
--
-- Praktisch belegt (evidence/S01_bypass_rls_probe.txt, Rolle ohne BYPASSRLS):
--   risk  bypass OFF -> visible 1, foreign 0 | bypass ON -> visible 2, foreign 1
--   DELETE FROM risk   WHERE org_id = <Fremd-Org>  -> DELETE 1
--   UPDATE evidence    WHERE org_id = <Fremd-Org>  -> UPDATE 1
--
-- Entscheidung: Der Hatch wird ERSATZLOS entfernt statt an eine Rolle
-- gebunden. Begründung:
--   (a) Der einzige dokumentierte Zweck ("group admin aggregation",
--       0000_lethal_scorpion.sql:193) hat im Produktivcode keine einzige
--       Fundstelle — die Volltextsuche über apps/** und packages/** findet
--       nur die beiden Seed-Skripte, die als Superuser `grc` laufen und den
--       GUC deshalb gar nicht brauchen.
--   (b) Eine Bindung an eine Rolle (`pg_has_role(current_user, 'grc_report',
--       'member')`) würde eine zweite privilegierte Rolle einführen, die
--       niemand benutzt — also eine Angriffsfläche ohne Nutzen.
--
-- Zwei Policy-Formen sind betroffen:
--   1. `org_isolation` / `org_isolation_select` (FOR ALL bzw. FOR SELECT):
--      `bypass OR <org-Prädikat>` -> die Bypass-Disjunktion wird per
--      ALTER POLICY entfernt, das org-Prädikat bleibt unverändert erhalten.
--   2. `reporting_bypass` (FOR SELECT): der Ausdruck besteht AUSSCHLIESSLICH
--      aus der Bypass-Prüfung. Da alle Policies PERMISSIVE sind (es gibt
--      keine einzige RESTRICTIVE Policy im Schema), kann diese Policy nur
--      erweitern — sie wird gelöscht.
--
-- Die Migration arbeitet katalog-getrieben (pg_policies), nicht über eine
-- fest verdrahtete Tabellenliste, damit sie auch Policies erfasst, die in
-- einer bereits laufenden Datenbank aus späteren Hotfixes stammen. Am Ende
-- prüft sie das Ergebnis und BRICHT AB, wenn auch nur eine Policy den GUC
-- noch nennt — ein stillschweigend verbleibender Hatch wäre schlimmer als
-- gar keine Migration.

DO $bypass$
DECLARE
  pol           RECORD;
  v_qual        text;
  v_check       text;
  v_dropped     int := 0;
  v_altered     int := 0;
  v_remaining   int;
  -- Exakt so rendert pg_get_expr() die Bypass-Prüfung.
  c_bypass_expr CONSTANT text :=
    '(current_setting(''app.bypass_rls''::text, true) = ''true''::text)';
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual, '') LIKE '%app.bypass_rls%'
         OR coalesce(with_check, '') LIKE '%app.bypass_rls%')
     ORDER BY tablename, policyname
  LOOP
    -- Form 2: der gesamte USING-Ausdruck IST die Bypass-Prüfung.
    IF btrim(coalesce(pol.qual, '')) = c_bypass_expr
       AND pol.with_check IS NULL
    THEN
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
      v_dropped := v_dropped + 1;
      CONTINUE;
    END IF;

    -- Form 1: Bypass-Disjunktion aus USING / WITH CHECK herausschneiden.
    v_qual  := pol.qual;
    v_check := pol.with_check;

    IF v_qual IS NOT NULL THEN
      v_qual := replace(v_qual, c_bypass_expr || ' OR ', '');
      v_qual := replace(v_qual, ' OR ' || c_bypass_expr, '');
    END IF;
    IF v_check IS NOT NULL THEN
      v_check := replace(v_check, c_bypass_expr || ' OR ', '');
      v_check := replace(v_check, ' OR ' || c_bypass_expr, '');
    END IF;

    -- Fail-loud: wenn das Textmuster nicht griff, darf die Migration NICHT
    -- so tun, als sei der Hatch weg.
    IF coalesce(v_qual, '') LIKE '%app.bypass_rls%'
       OR coalesce(v_check, '') LIKE '%app.bypass_rls%'
    THEN
      RAISE EXCEPTION
        'S01-02: Policy %.% enthält app.bypass_rls in einer unerwarteten Form: using=% check=%',
        pol.tablename, pol.policyname, pol.qual, pol.with_check;
    END IF;

    IF v_qual IS NOT NULL AND v_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
                     pol.policyname, pol.tablename, v_qual, v_check);
    ELSIF v_qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',
                     pol.policyname, pol.tablename, v_qual);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',
                     pol.policyname, pol.tablename, v_check);
    END IF;
    v_altered := v_altered + 1;
  END LOOP;

  SELECT count(*) INTO v_remaining
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (coalesce(qual, '') LIKE '%app.bypass_rls%'
       OR coalesce(with_check, '') LIKE '%app.bypass_rls%');

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'S01-02: % Policies nennen app.bypass_rls immer noch', v_remaining;
  END IF;

  RAISE NOTICE 'S01-02: % Policies bereinigt, % Bypass-Policies gelöscht',
    v_altered, v_dropped;
END
$bypass$;
