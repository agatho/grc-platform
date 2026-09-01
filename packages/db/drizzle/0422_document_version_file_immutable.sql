-- Migration 0422: Dateisnapshot einer Version ist unveraenderlich
--
-- Migration: 0422_document_version_file_immutable
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: none
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP7 · S06-01]
--
-- `POST /documents/:id/upload` überschrieb file_name / file_path / file_size /
-- mime_type / file_sha256 der AKTUELLEN, ggf. freigegebenen Version in-place.
-- Die Version behielt valid_from, Freigabe-Historie und alle Acknowledgments,
-- hinter ihr stand aber eine andere Datei. Der Applikationsfix liegt in
-- apps/web/src/app/api/v1/documents/[id]/upload/route.ts; dieser Trigger ist
-- die zweite Linie: er gilt für JEDEN Schreibpfad, auch künftige.
--
-- Erlaubt bleiben genau zwei Übergänge:
--   NULL  → Wert   Die Version wird gerade befuellt (Entwurf bekommt seine
--                  erste Datei). Das ueberschreibt keine Historie.
--   Wert  → NULL   Die referenzierte Datei wurde geloescht (DELETE
--                  /documents/:id/files/:fileId, Retention-Purge). Die
--                  baumelnde Referenz wird sichtbar aufgeloest statt still
--                  stehen zu bleiben (S06-19).
-- Verboten ist Wert → anderer Wert.
--
-- ENABLE ALWAYS (Muster 0401/WP4), damit der Guard auch unter
-- session_replication_role = 'replica' greift.

CREATE OR REPLACE FUNCTION document_version_file_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.file_path IS NOT NULL
     AND NEW.file_path IS NOT NULL
     AND NEW.file_path IS DISTINCT FROM OLD.file_path
  THEN
    RAISE EXCEPTION
      'document_version %: der Dateisnapshot einer bestehenden Version darf nicht ersetzt werden — neue Version anlegen (S06-01)',
      OLD.id
      USING ERRCODE = '42501';
  END IF;

  IF OLD.file_sha256 IS NOT NULL
     AND NEW.file_sha256 IS NOT NULL
     AND NEW.file_sha256 IS DISTINCT FROM OLD.file_sha256
  THEN
    RAISE EXCEPTION
      'document_version %: der Datei-Hash einer bestehenden Version darf nicht ersetzt werden — neue Version anlegen (S06-01)',
      OLD.id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_version_file_immutable_trg ON document_version;
CREATE TRIGGER document_version_file_immutable_trg
  BEFORE UPDATE ON document_version
  FOR EACH ROW EXECUTE FUNCTION document_version_file_immutable();
ALTER TABLE document_version
  ENABLE ALWAYS TRIGGER document_version_file_immutable_trg;

COMMENT ON FUNCTION document_version_file_immutable() IS
  'S06-01: verhindert das In-place-Ueberschreiben des Dateisnapshots einer bestehenden Dokumentversion. NULL->Wert (Befuellen) und Wert->NULL (Dateiloeschung) bleiben erlaubt.';
