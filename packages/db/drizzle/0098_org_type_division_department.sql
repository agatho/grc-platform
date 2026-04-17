-- Migration 0098: Organization types 'division' (Bereich) + 'department' (Abteilung)
-- Ermoeglicht feingranulare Organisationshierarchie:
-- holding → subsidiary → branch → division → department

ALTER TYPE org_type ADD VALUE IF NOT EXISTS 'division';
ALTER TYPE org_type ADD VALUE IF NOT EXISTS 'department';
