-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-01] In-place repariert.
-- Diese Migration ist gegen eine leere Datenbank nie erfolgreich gelaufen
-- (Audit-Finding S09-01) und gilt nach ADR-014 als nicht ausgeliefert; die
-- Änderung an der bestehenden Datei ist daher zulässig.
-- Änderung: Zieltabelle bc_process (existiert nicht) auf essential_process korrigiert (42P01).
-- Sprint 55, Migration 867: Add emergency_officer_id to bc_process

-- [ARCTOS-FULL-2026-08-31 / S09-01] Es gibt keine Tabelle `bc_process`
-- (42P01); die BCMS-Prozesstabelle heisst essential_process
-- (src/schema/bcms.ts).
ALTER TABLE essential_process ADD COLUMN IF NOT EXISTS emergency_officer_id UUID REFERENCES "user"(id);
