-- Migration 0074: Expand document_category enum with 10 new types

ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'risk_assessment';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'audit_report';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'contract';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'training_material';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'process_description';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'evidence';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'meeting_minutes';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'management_review';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'certificate';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'regulation';
