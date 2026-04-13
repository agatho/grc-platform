-- Seed common tag definitions for all organizations
-- Run after seed.ts to populate predefined tags

INSERT INTO tag_definition (org_id, name, color, category, description)
SELECT o.id, t.name, t.color, t.category, t.description
FROM organization o
CROSS JOIN (VALUES
  ('kritisch', '#EF4444', 'Priorität', 'Höchste Priorität'),
  ('hoch', '#F59E0B', 'Priorität', 'Hohe Priorität'),
  ('mittel', '#3B82F6', 'Priorität', 'Mittlere Priorität'),
  ('niedrig', '#10B981', 'Priorität', 'Niedrige Priorität'),
  ('audit-finding', '#8B5CF6', 'Quelle', 'Aus Audit-Feststellung'),
  ('nis2', '#3B82F6', 'Regulierung', 'NIS2-relevant'),
  ('dora', '#3B82F6', 'Regulierung', 'DORA-relevant'),
  ('dsgvo', '#8B5CF6', 'Regulierung', 'DSGVO-relevant'),
  ('iso27001', '#6B7280', 'Framework', 'ISO 27001 Annex A'),
  ('bsi', '#6B7280', 'Framework', 'BSI IT-Grundschutz'),
  ('cloud', '#3B82F6', 'Technologie', 'Cloud-bezogen'),
  ('on-premise', '#6B7280', 'Technologie', 'On-Premise-bezogen'),
  ('lieferkette', '#F59E0B', 'Bereich', 'Lieferketten-bezogen'),
  ('personal', '#EC4899', 'Bereich', 'Personal-bezogen'),
  ('it-sicherheit', '#EF4444', 'Bereich', 'IT-Sicherheit'),
  ('datenschutz', '#8B5CF6', 'Bereich', 'Datenschutz-bezogen'),
  ('management-review', '#F59E0B', 'Prozess', 'Management-Review vorgemerkt'),
  ('in-bearbeitung', '#F59E0B', 'Status', 'Wird gerade bearbeitet'),
  ('abgeschlossen', '#10B981', 'Status', 'Vollständig bearbeitet')
) AS t(name, color, category, description)
WHERE o.deleted_at IS NULL
ON CONFLICT (org_id, name) DO NOTHING;
