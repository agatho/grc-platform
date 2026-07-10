-- Migration 0368: DMS full-text search over extracted file contents.
--
-- 1. document.file_text — plain text extracted from the newest file
--    attachment at upload time (best effort: text/JSON/XML/CSV direct,
--    DOCX via word/document.xml; capped at 500KB). NULL for documents
--    without extractable file content.
-- 2. search_vector — a GENERATED column's expression cannot be
--    altered, so the 0356 column is dropped and recreated with
--    file_text included (weights: title A, content B, file_text C,
--    'simple' config — same pattern as 0356). The GIN index is
--    recreated afterwards; /api/v1/documents?q=… keeps working
--    unchanged because it references search_vector via raw SQL.

BEGIN;

ALTER TABLE document ADD COLUMN IF NOT EXISTS file_text text;

DROP INDEX IF EXISTS document_search_vector_gin;
ALTER TABLE document DROP COLUMN IF EXISTS search_vector;

ALTER TABLE document ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(file_text, '')), 'C')
  ) STORED;

CREATE INDEX document_search_vector_gin
  ON document USING GIN(search_vector);

COMMIT;
