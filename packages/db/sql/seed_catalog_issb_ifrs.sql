-- Seed: ISSB / IFRS S1 + S2 Sustainability Disclosure Standards
-- IFRS S1: General Requirements for Disclosure of Sustainability-related Financial Information
-- IFRS S2: Climate-related Disclosures

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  gen_random_uuid(),
  'IFRS S1 & S2 — ISSB Sustainability Standards',
  'International Sustainability Standards Board: IFRS S1 (General Requirements) and IFRS S2 (Climate-related Disclosures). Effective from January 2024.',
  'control',
  'platform',
  'issb_ifrs_s1_s2',
  '2024',
  'en',
  true,
  ARRAY['esg']
) ON CONFLICT DO NOTHING;

-- IFRS S1 entries
INSERT INTO catalog_entry (id, catalog_id, code, name, name_de, description, level, sort_order, status)
SELECT gen_random_uuid(), c.id, e.code, e.name, e.name_de, e.description, e.level, e.sort_order, 'active'
FROM catalog c
CROSS JOIN (VALUES
  ('S1.1', 'Objective', 'Zielsetzung', 'Disclose sustainability-related financial information useful to users of general purpose financial reports', 0, 1),
  ('S1.2', 'Scope', 'Anwendungsbereich', 'Sustainability-related risks and opportunities that could reasonably be expected to affect cash flows, access to finance or cost of capital', 0, 2),
  ('S1.3', 'Core Content — Governance', 'Kerninhalt — Governance', 'Governance processes, controls and procedures used to monitor and manage sustainability-related risks and opportunities', 0, 3),
  ('S1.4', 'Core Content — Strategy', 'Kerninhalt — Strategie', 'Strategy for managing sustainability-related risks and opportunities', 0, 4),
  ('S1.5', 'Core Content — Risk Management', 'Kerninhalt — Risikomanagement', 'Processes used to identify, assess, prioritize and monitor sustainability-related risks and opportunities', 0, 5),
  ('S1.6', 'Core Content — Metrics and Targets', 'Kerninhalt — Metriken und Ziele', 'Performance metrics and targets for sustainability-related risks and opportunities', 0, 6),
  ('S1.7', 'Connected Information', 'Verbundene Informationen', 'Connections between sustainability-related financial disclosures and financial statements', 0, 7),
  ('S1.8', 'Materiality', 'Wesentlichkeit', 'Material sustainability-related financial information for primary users', 0, 8),
  ('S1.9', 'Comparative Information', 'Vergleichsinformationen', 'Comparative data from prior periods', 0, 9),
  ('S1.10', 'Sources of Estimation Uncertainty', 'Quellen der Schätzungsunsicherheit', 'Significant estimation uncertainties in sustainability disclosures', 0, 10),
  -- IFRS S2 Climate-specific entries
  ('S2.1', 'Climate Governance', 'Klima-Governance', 'Governance processes for climate-related risks and opportunities', 0, 11),
  ('S2.2', 'Climate Strategy', 'Klimastrategie', 'Climate-related transition plan, resilience assessment, scenario analysis', 0, 12),
  ('S2.3', 'Climate Risk Management', 'Klima-Risikomanagement', 'Processes for identifying, assessing, prioritizing climate-related risks', 0, 13),
  ('S2.4', 'GHG Emissions — Scope 1', 'THG-Emissionen — Scope 1', 'Absolute gross GHG emissions: Scope 1', 0, 14),
  ('S2.5', 'GHG Emissions — Scope 2', 'THG-Emissionen — Scope 2', 'Absolute gross GHG emissions: Scope 2', 0, 15),
  ('S2.6', 'GHG Emissions — Scope 3', 'THG-Emissionen — Scope 3', 'Absolute gross GHG emissions: Scope 3', 0, 16),
  ('S2.7', 'Climate Targets', 'Klimaziele', 'Climate-related targets including GHG emissions reduction targets', 0, 17),
  ('S2.8', 'Transition Plan', 'Transformationsplan', 'Current and anticipated effects of climate-related risks on business model and strategy', 0, 18),
  ('S2.9', 'Climate Resilience', 'Klimaresilienz', 'Assessment of climate resilience under different scenarios', 0, 19),
  ('S2.10', 'Carbon Pricing', 'CO2-Bepreisung', 'Internal carbon prices and how they are used in decision-making', 0, 20)
) AS e(code, name, name_de, description, level, sort_order)
WHERE c.source = 'issb_ifrs_s1_s2'
ON CONFLICT (catalog_id, code) DO NOTHING;
