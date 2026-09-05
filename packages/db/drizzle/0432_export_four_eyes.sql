-- 0432_export_four_eyes.sql
-- ARCTOS-FULL-2026-08-31 · WP8 · S07-14 (Medium) — Vier-Augen-Prinzip für
-- den Massenexport. Ergänzt `decideBulkExport()` aus WP3 (S02-07) um den
-- Teil, den eine reine Entscheidungsfunktion nicht leisten kann: die
-- Zustimmung eines ZWEITEN Menschen, nachweisbar und einmal verwendbar.
--
-- Befund: `POST /api/v1/export/bulk` lief unter `withAuth()` ohne
-- Rollenliste (jede authentifizierte Rolle, auch `viewer`), mit festem
-- Leerfilter über den vollständigen Bestand, ohne Vier-Augen-Prinzip, und
-- die Protokollierung nach `data_export_log` steckte in einem
-- `try { … } catch { console.error }` — schlug sie fehl, wurde der Export
-- trotzdem ausgeliefert. Das ist der klassische Insider-Exfiltrationspfad
-- ohne Nachweis.

CREATE TABLE IF NOT EXISTS export_approval (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organization(id),
  requested_by  uuid NOT NULL REFERENCES "user"(id),
  entity_types  text[] NOT NULL,
  reason        text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'consumed', 'expired')),
  approved_by   uuid REFERENCES "user"(id),
  approved_at   timestamptz,
  rejected_at   timestamptz,
  consumed_at   timestamptz,
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT export_approval_four_eyes CHECK (approved_by IS NULL OR approved_by <> requested_by)
);

CREATE INDEX IF NOT EXISTS export_approval_org_idx ON export_approval (org_id, status, created_at DESC);

COMMENT ON TABLE export_approval IS
  'S07-14 / S02-07: Freigabe eines Massenexports durch eine zweite Person. Einmal verwendbar, mit Ablauf, und der Genehmigende darf nicht der Antragsteller sein (CHECK-Constraint, nicht nur Anwendungslogik).';

ALTER TABLE export_approval ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_approval FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS export_approval_org ON export_approval;
CREATE POLICY export_approval_org ON export_approval
  USING (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)
  WITH CHECK (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT, INSERT, UPDATE ON export_approval TO grc_app;
  END IF;
END $g$;

-- Ein `pending`-Datensatz darf nur von jemand anderem genehmigt werden;
-- der CHECK oben deckt die Identität ab, dieser Trigger die Zustände.
CREATE OR REPLACE FUNCTION export_approval_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('consumed', 'rejected', 'expired')
       AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'export approval % is final (%), it cannot change state again',
        OLD.id, OLD.status USING ERRCODE = 'raise_exception';
    END IF;
    IF NEW.status = 'approved' AND NEW.approved_by IS NULL THEN
      RAISE EXCEPTION 'an approved export approval must name the approver';
    END IF;
    IF NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR NEW.entity_types IS DISTINCT FROM OLD.entity_types
       OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN
      RAISE EXCEPTION 'the scope of an export approval is immutable (id=%)', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS export_approval_guard_trg ON export_approval;
CREATE TRIGGER export_approval_guard_trg
  BEFORE UPDATE ON export_approval
  FOR EACH ROW EXECUTE FUNCTION export_approval_guard();

-- Prüfung + Verbrauch in einem Schritt, damit zwischen Prüfung und
-- Verwendung kein Fenster für eine zweite Verwendung entsteht.
CREATE OR REPLACE FUNCTION export_approval_consume(
  p_approval_id  uuid,
  p_org_id       uuid,
  p_actor_id     uuid,
  p_entity_types text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  a export_approval%ROWTYPE;
BEGIN
  IF p_approval_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO a FROM export_approval
   WHERE id = p_approval_id AND org_id = p_org_id
   FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;
  IF a.status <> 'approved' THEN RETURN false; END IF;
  IF a.expires_at < now() THEN
    UPDATE export_approval SET status = 'expired' WHERE id = a.id;
    RETURN false;
  END IF;
  IF a.requested_by IS DISTINCT FROM p_actor_id THEN RETURN false; END IF;
  IF a.approved_by IS NULL OR a.approved_by = p_actor_id THEN RETURN false; END IF;
  -- Jeder angeforderte Typ muss von der Freigabe gedeckt sein.
  IF NOT (p_entity_types <@ a.entity_types) THEN RETURN false; END IF;

  UPDATE export_approval
     SET status = 'consumed', consumed_at = now()
   WHERE id = a.id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION export_approval_consume(uuid, uuid, uuid, text[]) IS
  'S07-14: prüft und verbraucht eine Export-Freigabe atomar. Gibt false zurück, statt zu werfen — die Route wandelt das in ein 403 mit Begründung um.';

REVOKE ALL ON FUNCTION export_approval_consume(uuid, uuid, uuid, text[]) FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION export_approval_consume(uuid, uuid, uuid, text[]) TO grc_app;
  END IF;
END $g$;
