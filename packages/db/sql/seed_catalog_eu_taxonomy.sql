-- Seed: EU Taxonomy for Sustainable Activities
-- 6 Environmental Objectives + DNSH + Minimum Safeguards

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  gen_random_uuid(),
  'EU Taxonomy — Sustainable Activities',
  'EU Taxonomy Regulation: 6 environmental objectives with technical screening criteria, DNSH (Do No Significant Harm) criteria, and Minimum Safeguards. Mandatory for CSRD-reporting companies.',
  'control',
  'platform',
  'eu_taxonomy_2023',
  '2023',
  'en',
  true,
  ARRAY['esg']
) ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (id, catalog_id, code, name, name_de, description, level, sort_order, status)
SELECT gen_random_uuid(), c.id, e.code, e.name, e.name_de, e.description, e.level, e.sort_order, 'active'
FROM catalog c
CROSS JOIN (VALUES
  ('OBJ1', 'Climate Change Mitigation', 'Klimaschutz', 'Substantial contribution to stabilization of GHG concentrations consistent with Paris Agreement', 0, 1),
  ('OBJ2', 'Climate Change Adaptation', 'Anpassung an den Klimawandel', 'Substantial contribution to reducing or preventing adverse impact of current/expected climate', 0, 2),
  ('OBJ3', 'Sustainable Use of Water and Marine Resources', 'Nachhaltige Nutzung von Wasserressourcen', 'Substantial contribution to achieving good status of water bodies', 0, 3),
  ('OBJ4', 'Transition to Circular Economy', 'Übergang zur Kreislaufwirtschaft', 'Substantial contribution to circular economy including waste prevention and recycling', 0, 4),
  ('OBJ5', 'Pollution Prevention and Control', 'Vermeidung und Verminderung der Umweltverschmutzung', 'Substantial contribution to preventing or reducing pollutant emissions', 0, 5),
  ('OBJ6', 'Protection of Biodiversity and Ecosystems', 'Schutz der Biodiversität und Ökosysteme', 'Substantial contribution to protecting, conserving or restoring biodiversity', 0, 6),
  ('DNSH', 'Do No Significant Harm', 'Keine erhebliche Beeinträchtigung', 'Activity does not significantly harm any of the other 5 environmental objectives', 0, 7),
  ('MS', 'Minimum Safeguards', 'Mindestschutzmaßnahmen', 'Compliance with OECD Guidelines, UN Guiding Principles on Business and Human Rights, ILO Core Conventions', 0, 8),
  ('ART8', 'Article 8 Disclosure (Non-financial)', 'Artikel 8 Offenlegung', 'Taxonomy-eligible and taxonomy-aligned KPIs: turnover, CapEx, OpEx', 0, 9),
  ('KPI-T', 'Turnover KPI', 'Umsatz-KPI', 'Proportion of taxonomy-eligible and taxonomy-aligned turnover', 1, 10),
  ('KPI-C', 'CapEx KPI', 'CapEx-KPI', 'Proportion of taxonomy-eligible and taxonomy-aligned capital expenditure', 1, 11),
  ('KPI-O', 'OpEx KPI', 'OpEx-KPI', 'Proportion of taxonomy-eligible and taxonomy-aligned operating expenditure', 1, 12),
  ('TSC', 'Technical Screening Criteria', 'Technische Bewertungskriterien', 'Activity-specific criteria determining substantial contribution', 0, 13),
  ('NACE', 'NACE Activity Mapping', 'NACE-Aktivitätszuordnung', 'Mapping of eligible activities to NACE codes', 0, 14)
) AS e(code, name, name_de, description, level, sort_order)
WHERE c.source = 'eu_taxonomy_2023'
ON CONFLICT (catalog_id, code) DO NOTHING;
