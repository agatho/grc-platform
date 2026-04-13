-- Seed: TCFD Recommendations (Task Force on Climate-Related Financial Disclosures)
-- 4 pillars, 11 recommendations

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  gen_random_uuid(),
  'TCFD Recommendations',
  'Task Force on Climate-Related Financial Disclosures: 4 pillars (Governance, Strategy, Risk Management, Metrics & Targets) with 11 recommendations. Widely adopted globally, integrated into ISSB.',
  'control',
  'platform',
  'tcfd_2017',
  '2017',
  'en',
  true,
  ARRAY['esg', 'erm']
) ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (id, catalog_id, code, name, name_de, description, level, sort_order, status)
SELECT gen_random_uuid(), c.id, e.code, e.name, e.name_de, e.description, e.level, e.sort_order, 'active'
FROM catalog c
CROSS JOIN (VALUES
  ('GOV', 'Governance', 'Governance', 'Board oversight and management role in climate-related risks and opportunities', 0, 1),
  ('GOV-a', 'Board Oversight', 'Aufsicht des Vorstands', 'Board oversight of climate-related risks and opportunities', 1, 2),
  ('GOV-b', 'Management Role', 'Rolle des Managements', 'Management role in assessing and managing climate-related risks and opportunities', 1, 3),
  ('STR', 'Strategy', 'Strategie', 'Actual and potential impacts of climate-related risks and opportunities', 0, 4),
  ('STR-a', 'Climate Risks & Opportunities', 'Klimarisiken und -chancen', 'Climate-related risks and opportunities identified over short, medium, and long term', 1, 5),
  ('STR-b', 'Impact on Business', 'Auswirkungen auf Geschäft', 'Impact on business, strategy, and financial planning', 1, 6),
  ('STR-c', 'Resilience of Strategy', 'Resilienz der Strategie', 'Resilience of strategy under different climate scenarios including 2°C or lower', 1, 7),
  ('RM', 'Risk Management', 'Risikomanagement', 'Processes for identifying, assessing, and managing climate-related risks', 0, 8),
  ('RM-a', 'Risk Identification & Assessment', 'Risikoidentifikation und -bewertung', 'Processes for identifying and assessing climate-related risks', 1, 9),
  ('RM-b', 'Risk Management Processes', 'Risikomanagementprozesse', 'Processes for managing climate-related risks', 1, 10),
  ('RM-c', 'Integration into ERM', 'Integration in ERM', 'How processes for identifying, assessing, and managing climate-related risks are integrated into overall risk management', 1, 11),
  ('MT', 'Metrics & Targets', 'Metriken und Ziele', 'Metrics and targets used to assess and manage relevant climate-related risks and opportunities', 0, 12),
  ('MT-a', 'Climate Metrics', 'Klimametriken', 'Metrics used to assess climate-related risks and opportunities', 1, 13),
  ('MT-b', 'GHG Emissions', 'THG-Emissionen', 'Scope 1, Scope 2, and Scope 3 greenhouse gas emissions', 1, 14),
  ('MT-c', 'Climate Targets', 'Klimaziele', 'Targets used to manage climate-related risks and opportunities and performance against targets', 1, 15)
) AS e(code, name, name_de, description, level, sort_order)
WHERE c.source = 'tcfd_2017'
ON CONFLICT (catalog_id, code) DO NOTHING;
