-- Migration 0073: Add file storage columns to document and document_version
-- Supports file upload/download feature for the DMS module

ALTER TABLE document ADD COLUMN IF NOT EXISTS file_name VARCHAR(500);
ALTER TABLE document ADD COLUMN IF NOT EXISTS file_path VARCHAR(1000);
ALTER TABLE document ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE document ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255);

ALTER TABLE document_version ADD COLUMN IF NOT EXISTS file_name VARCHAR(500);
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS file_path VARCHAR(1000);
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255);
