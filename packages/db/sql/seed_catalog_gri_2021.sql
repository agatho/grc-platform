-- Seed: GRI Standards 2021 (Global Reporting Initiative)
-- Universal, Sector, and Topic Standards

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  gen_random_uuid(),
  'GRI Standards 2021',
  'Global Reporting Initiative: Universal Standards (GRI 1-3), Topic Standards (200-400 series). The most widely used sustainability reporting standards globally.',
  'control',
  'platform',
  'gri_standards_2021',
  '2021',
  'en',
  true,
  ARRAY['esg']
) ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (id, catalog_id, code, name, name_de, description, level, sort_order, status)
SELECT gen_random_uuid(), c.id, e.code, e.name, e.name_de, e.description, e.level, e.sort_order, 'active'
FROM catalog c
CROSS JOIN (VALUES
  -- Universal Standards
  ('GRI 1', 'Foundation 2021', 'Grundlagen 2021', 'Purpose, system of standards, key concepts, requirements', 0, 1),
  ('GRI 2', 'General Disclosures 2021', 'Allgemeine Angaben 2021', 'Organization profile, governance, strategy, stakeholder engagement', 0, 2),
  ('GRI 3', 'Material Topics 2021', 'Wesentliche Themen 2021', 'Process to determine material topics and list of material topics', 0, 3),
  -- Economic (200 series)
  ('GRI 201', 'Economic Performance', 'Wirtschaftliche Leistung', 'Direct economic value generated and distributed', 0, 10),
  ('GRI 202', 'Market Presence', 'Marktpräsenz', 'Ratios of standard entry level wage, proportion of senior management from local community', 0, 11),
  ('GRI 203', 'Indirect Economic Impacts', 'Indirekte wirtschaftliche Auswirkungen', 'Significant indirect economic impacts', 0, 12),
  ('GRI 204', 'Procurement Practices', 'Beschaffungspraktiken', 'Proportion of spending on local suppliers', 0, 13),
  ('GRI 205', 'Anti-corruption', 'Korruptionsbekämpfung', 'Operations assessed for risks related to corruption', 0, 14),
  ('GRI 206', 'Anti-competitive Behavior', 'Wettbewerbswidriges Verhalten', 'Legal actions for anti-competitive behavior', 0, 15),
  ('GRI 207', 'Tax', 'Steuern', 'Tax strategy, tax governance, stakeholder engagement, country-by-country reporting', 0, 16),
  -- Environmental (300 series)
  ('GRI 301', 'Materials', 'Materialien', 'Materials used by weight or volume, recycled input materials', 0, 20),
  ('GRI 302', 'Energy', 'Energie', 'Energy consumption, intensity, reduction', 0, 21),
  ('GRI 303', 'Water and Effluents', 'Wasser und Abwasser', 'Water withdrawal, consumption, discharge', 0, 22),
  ('GRI 304', 'Biodiversity', 'Biodiversität', 'Operational sites in protected areas, significant impacts on biodiversity', 0, 23),
  ('GRI 305', 'Emissions', 'Emissionen', 'Direct (Scope 1), indirect (Scope 2), other indirect (Scope 3) GHG emissions', 0, 24),
  ('GRI 306', 'Waste', 'Abfall', 'Waste generation, significant waste-related impacts', 0, 25),
  ('GRI 308', 'Supplier Environmental Assessment', 'Umweltbewertung der Lieferanten', 'New suppliers screened using environmental criteria', 0, 26),
  -- Social (400 series)
  ('GRI 401', 'Employment', 'Beschäftigung', 'New employee hires, turnover, benefits', 0, 30),
  ('GRI 402', 'Labor/Management Relations', 'Arbeitnehmer-Arbeitgeber-Beziehungen', 'Minimum notice periods for operational changes', 0, 31),
  ('GRI 403', 'Occupational Health and Safety', 'Arbeitssicherheit und Gesundheitsschutz', 'Work-related injuries, ill health, hazard identification', 0, 32),
  ('GRI 404', 'Training and Education', 'Aus- und Weiterbildung', 'Average hours of training, programs for skills management', 0, 33),
  ('GRI 405', 'Diversity and Equal Opportunity', 'Diversität und Chancengleichheit', 'Diversity of governance bodies and employees', 0, 34),
  ('GRI 406', 'Non-discrimination', 'Nichtdiskriminierung', 'Incidents of discrimination and corrective actions', 0, 35),
  ('GRI 407', 'Freedom of Association', 'Vereinigungsfreiheit', 'Operations where right to freedom of association may be at risk', 0, 36),
  ('GRI 408', 'Child Labor', 'Kinderarbeit', 'Operations and suppliers at significant risk for child labor', 0, 37),
  ('GRI 409', 'Forced or Compulsory Labor', 'Zwangs- oder Pflichtarbeit', 'Operations and suppliers at significant risk for forced labor', 0, 38),
  ('GRI 410', 'Security Practices', 'Sicherheitspraktiken', 'Security personnel trained in human rights policies', 0, 39),
  ('GRI 411', 'Rights of Indigenous Peoples', 'Rechte der indigenen Völker', 'Incidents of violations involving rights of indigenous peoples', 0, 40),
  ('GRI 413', 'Local Communities', 'Lokale Gemeinschaften', 'Operations with local community engagement', 0, 41),
  ('GRI 414', 'Supplier Social Assessment', 'Soziale Bewertung der Lieferanten', 'New suppliers screened using social criteria', 0, 42),
  ('GRI 415', 'Public Policy', 'Politische Einflussnahme', 'Political contributions', 0, 43),
  ('GRI 416', 'Customer Health and Safety', 'Kundengesundheit und -sicherheit', 'Assessment of health and safety impacts of products', 0, 44),
  ('GRI 417', 'Marketing and Labeling', 'Marketing und Kennzeichnung', 'Requirements for product and service information and labeling', 0, 45),
  ('GRI 418', 'Customer Privacy', 'Schutz der Kundendaten', 'Substantiated complaints concerning customer privacy breaches', 0, 46)
) AS e(code, name, name_de, description, level, sort_order)
WHERE c.source = 'gri_standards_2021'
ON CONFLICT (catalog_id, code) DO NOTHING;
