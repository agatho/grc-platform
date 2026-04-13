-- Seed: CDP Questionnaire Structure (Carbon Disclosure Project)
-- Climate Change Questionnaire 2024 — Key Modules

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  gen_random_uuid(),
  'CDP Climate Change Questionnaire 2024',
  'Carbon Disclosure Project: Climate Change Questionnaire structure with 12 modules. Used by 23,000+ companies worldwide to disclose environmental data to investors.',
  'control',
  'platform',
  'cdp_climate_2024',
  '2024',
  'en',
  true,
  ARRAY['esg']
) ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (id, catalog_id, code, name, name_de, description, level, sort_order, status)
SELECT gen_random_uuid(), c.id, e.code, e.name, e.name_de, e.description, e.level, e.sort_order, 'active'
FROM catalog c
CROSS JOIN (VALUES
  ('C0', 'Introduction', 'Einführung', 'Company profile, reporting year, organizational boundaries', 0, 1),
  ('C1', 'Governance', 'Governance', 'Board-level oversight and management responsibility for climate issues', 0, 2),
  ('C2', 'Risks and Opportunities', 'Risiken und Chancen', 'Climate-related risks and opportunities identification and management', 0, 3),
  ('C3', 'Business Strategy', 'Geschäftsstrategie', 'Climate-related scenarios, transition plan, financial planning', 0, 4),
  ('C4', 'Targets and Performance', 'Ziele und Leistung', 'Emission reduction targets, progress against targets', 0, 5),
  ('C5', 'Emissions Methodology', 'Emissionsmethodik', 'Base year, methodology, exclusions, GWP values', 0, 6),
  ('C6', 'Emissions Data', 'Emissionsdaten', 'Scope 1, 2, 3 emissions, biogenic emissions, intensity metrics', 0, 7),
  ('C7', 'Emissions Breakdown', 'Emissionsaufschlüsselung', 'Emissions by country/region, business division, facility, activity', 0, 8),
  ('C8', 'Energy', 'Energie', 'Energy consumption, generation, fuel sources, renewable energy', 0, 9),
  ('C9', 'Additional Metrics', 'Zusätzliche Metriken', 'Low-carbon products, R&D expenditure, internal carbon pricing', 0, 10),
  ('C10', 'Verification', 'Verifizierung', 'Third-party verification of Scope 1, 2, 3 emissions', 0, 11),
  ('C11', 'Carbon Pricing', 'CO2-Bepreisung', 'Internal carbon pricing mechanisms, ETS participation', 0, 12),
  ('C12', 'Engagement', 'Engagement', 'Value chain engagement, policy engagement, trade associations', 0, 13),
  ('C13', 'Other Land Management', 'Landnutzungsmanagement', 'Land management impacts on emissions (for relevant sectors)', 0, 14),
  ('C14', 'Signoff', 'Freigabe', 'Submission sign-off and contact information', 0, 15)
) AS e(code, name, name_de, description, level, sort_order)
WHERE c.source = 'cdp_climate_2024'
ON CONFLICT (catalog_id, code) DO NOTHING;
