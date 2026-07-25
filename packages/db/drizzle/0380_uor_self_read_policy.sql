-- ============================================================================
-- Migration 0380: Self-Read-Policy auf user_organization_role (Auth-Bootstrap-Fix)
--
-- KONTEXT (Prod-Testserver, seit Umstellung der Web-Runtime auf grc_app)
-- ---------------------------------------------------------------------------
-- Seit die Web-App als Nicht-Superuser `grc_app` läuft (Pentest F-01, RLS
-- wirksam), ist JEDER FRISCHE LOGIN kaputt:
--
--   1. authorize() (packages/auth/src/providers.ts) ruft loadRoles(userId)
--      auf und liest `user_organization_role` über das globale `db`-Pool
--      (= grc_app) OHNE gesetzten RLS-Kontext.
--   2. `user_organization_role` hat RLS ENABLED + FORCED. Die einzige (bzw.
--      auf prod: die org-scoped) Policy filtert auf
--      `org_id = current_setting('app.current_org_id')`. Beim Login steht die
--      Org noch NICHT fest → kein Kontext → 0 Zeilen.
--   3. loadRoles liefert [] → JWT bekommt leeres `roles` → getCurrentOrgId
--      liefert null → jeder Daten-Endpoint antwortet 400 no-org-selected,
--      switch-org 403.
--
-- Henne-Ei: Man braucht die Org-Rollen, um den Org-Kontext zu setzen, aber das
-- Lesen der Rollen ist org-RLS-blockiert.
--
-- FIX (Weg 1 — isolationserhaltend)
-- ---------------------------------------------------------------------------
-- Ein User darf SEINE EIGENEN Rollen-Zeilen lesen — anhand von
-- `app.current_user_id`, das der Auth-Bootstrap (loadRoles /
-- resolveAccessLogOrgId, s. providers.ts) jetzt in einer Transaktion setzt.
-- Kein Fremd-Read, keine Voll-Ausnahme.
--
-- PERMISSIVE-vs-RESTRICTIVE-ANALYSE (Voraussetzung für Weg 1)
-- ---------------------------------------------------------------------------
-- Auf der Dev-DB (verifiziert am 2026-07-25) trägt user_organization_role
-- genau die Policy `org_isolation` mit polpermissive = t (FOR ALL). Auf prod
-- kommen die vier `user_organization_role_tenant_{select,insert,update,delete}`
-- aus dem 0336-Sweep hinzu — ebenfalls PERMISSIVE (CREATE POLICY ohne das
-- Schlüsselwort RESTRICTIVE erzeugt eine PERMISSIVE Policy). PostgreSQL ORt
-- alle PERMISSIVE Policies eines Kommandos: eine ZUSÄTZLICHE permissive
-- Self-Read-Policy für SELECT schaltet das Eigen-Lesen frei (org_id-Match ODER
-- user_id-Match), OHNE die Org-Isolation der bestehenden Policies zu schwächen
-- (fremde Zeilen matchen weder über org_id noch über user_id). Es existieren
-- KEINE RESTRICTIVE Policies, die das per AND wieder zunichte machen würden —
-- daher ist Weg 1 anwendbar (kein Rückfall auf den privilegierten Weg 2).
--
-- SICHERHEIT
-- ---------------------------------------------------------------------------
--   * Nur SELECT, nur eigene Zeilen (user_id = app.current_user_id).
--   * NULLIF(..., '')::uuid: current_setting mit missing_ok=true liefert NULL
--     (nie gesetzt) bzw. '' (auf einer zuvor benutzten Connection). Beides →
--     NULL → user_id = NULL → kein Match → sicher, KEIN ''::uuid-Fehler.
--   * TO PUBLIC (Default): gilt für grc_app; der Superuser grc umgeht RLS ohnehin.
--
-- Idempotent: to_regclass-Guard, DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================================

DO $BODY$
BEGIN
  IF to_regclass('public.user_organization_role') IS NULL THEN
    RAISE NOTICE '[0380] Überspringe — user_organization_role existiert nicht';
    RETURN;
  END IF;

  -- RLS muss aktiv sein, damit die Policy überhaupt greift. Auf der prod-DB
  -- ist sie es bereits (ENABLED + FORCED); der Aufruf ist ein No-op, falls schon so.
  EXECUTE 'ALTER TABLE public.user_organization_role ENABLE ROW LEVEL SECURITY';

  DROP POLICY IF EXISTS uor_self_read ON public.user_organization_role;

  -- Permissive Self-Read: ein User sieht SEINE EIGENEN Rollen-Zeilen, sobald
  -- app.current_user_id gesetzt ist (Auth-Bootstrap + Request-Kontext). ORt
  -- mit den bestehenden org-scoped Policies — schwächt deren Isolation nicht.
  CREATE POLICY uor_self_read ON public.user_organization_role
    FOR SELECT
    USING (
      user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    );

  RAISE NOTICE '[0380] Policy uor_self_read auf user_organization_role angelegt';
END
$BODY$;
