-- ============================================================================
-- ARCTOS Seed: WEF Global Risks Report 2025
-- Source: World Economic Forum Global Risks Report
-- 5 Categories with top risks per category
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active)
VALUES ('c0000000-0000-0000-0000-aef910ba1250', 'WEF Global Risks 2025', 'World Economic Forum Global Risks Report — Top global risks by category', 'risk', 'platform', 'wef_global_risks', '2025', true)
ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
-- Categories
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-ENV', 'Environmental', 'Climate and ecological risks', 0, 100, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-GEO', 'Geopolitical', 'Interstate and governance risks', 0, 200, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-SOC', 'Societal', 'Social cohesion and public health risks', 0, 300, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-TEC', 'Technological', 'Technology-related risks', 0, 400, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-ECO', 'Economic', 'Financial and economic risks', 0, 500, 'active'),
-- Environmental
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-ENV-01', 'Extreme weather events', 'Increasing frequency and severity of floods, storms, heatwaves, and wildfires', 1, 101, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-ENV-02', 'Biodiversity loss and ecosystem collapse', 'Irreversible loss of species and ecosystem services', 1, 102, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-ENV-03', 'Critical change to Earth systems', 'Tipping points in climate, ocean circulation, ice sheets', 1, 103, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-ENV-04', 'Natural resource crises', 'Water scarcity, soil degradation, deforestation', 1, 104, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-ENV-05', 'Pollution', 'Air, water, soil contamination from industrial activities', 1, 105, 'active'),
-- Geopolitical
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-GEO-01', 'Interstate armed conflict', 'Military confrontation between nation states', 1, 201, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-GEO-02', 'Geoeconomic confrontation', 'Trade wars, sanctions, economic decoupling', 1, 202, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-GEO-03', 'State collapse or instability', 'Failed states, governance breakdown', 1, 203, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-GEO-04', 'Weapons of mass destruction', 'Nuclear, biological, chemical weapon proliferation', 1, 204, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
-- Societal
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-SOC-01', 'Misinformation and disinformation', 'Deliberate spread of false information undermining trust', 1, 301, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-SOC-02', 'Involuntary migration', 'Large-scale forced displacement due to conflict or climate', 1, 302, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-SOC-03', 'Erosion of social cohesion', 'Polarization, inequality, loss of trust in institutions', 1, 303, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-SOC-04', 'Infectious diseases', 'Pandemic risk, antimicrobial resistance, zoonotic spillover', 1, 304, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-SOC-05', 'Cost of living crisis', 'Sustained increase in living costs affecting workforce and demand', 1, 305, 'active'),
-- Technological
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-TEC-01', 'Adverse outcomes of AI technologies', 'Uncontrolled AI causing economic disruption, bias, or safety risks', 1, 401, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-TEC-02', 'Cyber insecurity', 'Growing sophistication and scale of cyber threats', 1, 402, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-TEC-03', 'Concentration of technological power', 'Monopolistic control over digital infrastructure and data', 1, 403, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-TEC-04', 'Digital inequality', 'Unequal access to digital infrastructure and skills', 1, 404, 'active'),
-- Economic
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-ECO-01', 'Debt crises', 'Sovereign and corporate debt sustainability concerns', 1, 501, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-ECO-02', 'Economic downturn / recession', 'Prolonged economic contraction affecting global trade', 1, 502, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-ECO-03', 'Asset bubble burst', 'Collapse of overvalued asset markets (real estate, equities)', 1, 503, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-ECO-04', 'Supply chain disruption', 'Persistent disruption to global supply chains', 1, 504, 'active'),
('c0000000-0000-0000-0000-aef910ba1250', 'WEF-ECO-05', 'Energy supply crisis', 'Severe shortage or price spike in energy markets', 1, 505, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Parent linkage
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'WEF-ENV' AND catalog_id = 'c0000000-0000-0000-0000-aef910ba1250') WHERE code LIKE 'WEF-ENV-%' AND catalog_id = 'c0000000-0000-0000-0000-aef910ba1250';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'WEF-GEO' AND catalog_id = 'c0000000-0000-0000-0000-aef910ba1250') WHERE code LIKE 'WEF-GEO-%' AND catalog_id = 'c0000000-0000-0000-0000-aef910ba1250';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'WEF-SOC' AND catalog_id = 'c0000000-0000-0000-0000-aef910ba1250') WHERE code LIKE 'WEF-SOC-%' AND catalog_id = 'c0000000-0000-0000-0000-aef910ba1250';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'WEF-TEC' AND catalog_id = 'c0000000-0000-0000-0000-aef910ba1250') WHERE code LIKE 'WEF-TEC-%' AND catalog_id = 'c0000000-0000-0000-0000-aef910ba1250';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'WEF-ECO' AND catalog_id = 'c0000000-0000-0000-0000-aef910ba1250') WHERE code LIKE 'WEF-ECO-%' AND catalog_id = 'c0000000-0000-0000-0000-aef910ba1250';

-- Summary: 5 categories + 23 risks = 28 entries
