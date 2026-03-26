-- ============================================================================
-- ARCTOS Seed: Cambridge Taxonomy of Business Risks v2.0
-- Source: Cambridge Centre for Risk Studies, University of Cambridge
-- 5 Classes → ~35 Families → ~135 Types = ~175 entries
-- Used by Sprint 2 (ERM) + Sprint 4b (Catalog Browser)
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active)
VALUES (
  'c0000000-0000-0000-0000-ca3b21d9e7a2',
  'Cambridge Taxonomy of Business Risks v2.0',
  'Comprehensive taxonomy of threats to business value. 5 risk classes with families and types.',
  'risk', 'platform', 'cambridge_taxonomy_v2', '2.0', true
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Class 1: Financial & Economic (FE)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE', 'Financial & Economic', 'Risks arising from financial markets, economic conditions, and monetary systems', 0, 100, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.MC', 'Market Crash', 'Severe decline in financial markets affecting asset values and liquidity', 1, 110, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.MC.01', 'Equity market crash', 'Rapid decline in stock markets (>20% in days/weeks)', 2, 111, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.MC.02', 'Bond market dislocation', 'Sudden widening of credit spreads or sovereign bond crisis', 2, 112, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.MC.03', 'Commodity price shock', 'Extreme volatility in commodity markets (oil, metals, agriculture)', 2, 113, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.MC.04', 'Currency crisis', 'Rapid devaluation of a currency, capital flight', 2, 114, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.SC', 'Sovereign Crisis', 'Government default, fiscal collapse, or political economic instability', 1, 120, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.SC.01', 'Sovereign debt default', 'Government failure to meet debt obligations', 2, 121, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.SC.02', 'Fiscal austerity crisis', 'Severe government spending cuts impacting business environment', 2, 122, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.BC', 'Banking & Credit Crisis', 'Systemic banking failures, credit freezes, liquidity crises', 1, 130, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.BC.01', 'Banking system failure', 'Collapse or near-collapse of major banks', 2, 131, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.BC.02', 'Credit crunch', 'Severe tightening of credit availability', 2, 132, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.IN', 'Inflation & Deflation', 'Extreme movements in general price levels', 1, 140, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.IN.01', 'Hyperinflation', 'Rapidly accelerating inflation eroding purchasing power', 2, 141, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'FE.IN.02', 'Deflation', 'Sustained decline in general price levels', 2, 142, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Class 2: Geopolitical & Security (GS)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS', 'Geopolitical & Security', 'Risks from political instability, conflict, terrorism, and governance failures', 0, 200, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.GC', 'Geopolitical Conflict', 'Interstate conflict, trade wars, sanctions', 1, 210, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.GC.01', 'Interstate war', 'Armed conflict between nation states', 2, 211, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.GC.02', 'Trade war / sanctions', 'Economic sanctions, tariffs, export controls', 2, 212, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.GC.03', 'Civil conflict', 'Civil war, insurgency, political revolution', 2, 213, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.GC.04', 'Separatism / fragmentation', 'Regional secession, breakup of states', 2, 214, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.TR', 'Terrorism & Political Violence', 'Terrorist attacks, extremism, political violence', 1, 220, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.TR.01', 'Conventional terrorism', 'Bombing, armed attack on infrastructure or population', 2, 221, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.TR.02', 'CBRN terrorism', 'Chemical, biological, radiological, or nuclear attack', 2, 222, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.TR.03', 'Cyber terrorism', 'Politically motivated cyberattacks on critical infrastructure', 2, 223, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.GF', 'Governance Failure', 'Regulatory failure, corruption, state capture', 1, 230, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.GF.01', 'Regulatory disruption', 'Sudden regulatory change, overregulation, policy instability', 2, 231, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.GF.02', 'Corruption / state capture', 'Systemic corruption undermining rule of law', 2, 232, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'GS.GF.03', 'Expropriation / nationalization', 'Government seizure of private assets', 2, 233, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Class 3: Technology & Cyber (TC)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC', 'Technology & Cyber', 'Risks from technology failures, cyberattacks, and digital disruption', 0, 300, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.CA', 'Cyber Attack', 'Malicious cyber operations targeting organizations', 1, 310, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.CA.01', 'Ransomware / destructive malware', 'Encryption or destruction of data and systems for extortion', 2, 311, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.CA.02', 'Data exfiltration / espionage', 'Theft of confidential data, trade secrets, IP', 2, 312, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.CA.03', 'DDoS / service disruption', 'Overwhelming systems to deny service availability', 2, 313, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.CA.04', 'Supply chain cyber attack', 'Compromise through third-party software or services (SolarWinds-type)', 2, 314, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.CA.05', 'Critical infrastructure cyber attack', 'Attack on power grids, water, telecom, financial systems', 2, 315, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.TF', 'Technology Failure', 'Non-malicious technology disruptions', 1, 320, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.TF.01', 'Cloud / SaaS outage', 'Major cloud provider failure affecting multiple customers', 2, 321, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.TF.02', 'Telecommunications failure', 'Widespread internet or telecom infrastructure outage', 2, 322, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.TF.03', 'Software defect / system failure', 'Critical bug causing data loss or service unavailability', 2, 323, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.TF.04', 'GPS / satellite failure', 'Loss of satellite-based positioning, timing, or communication', 2, 324, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.TD', 'Technology Disruption', 'Disruptive innovations and paradigm shifts', 1, 330, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.TD.01', 'AI / automation disruption', 'Rapid displacement of business models or workforce by AI', 2, 331, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.TD.02', 'Platform disruption', 'New digital platforms making existing models obsolete', 2, 332, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'TC.TD.03', 'Quantum computing impact', 'Breaking of current cryptographic standards', 2, 333, 'active'),

-- ============================================================================
-- Class 4: Environmental & Natural (EN)
-- ============================================================================
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN', 'Environmental & Natural', 'Risks from natural hazards, climate change, and ecological disruption', 0, 400, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.NH', 'Natural Hazards', 'Extreme weather, geological events, space weather', 1, 410, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.NH.01', 'Earthquake', 'Seismic events causing structural damage and business disruption', 2, 411, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.NH.02', 'Flood', 'River flooding, flash floods, coastal inundation', 2, 412, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.NH.03', 'Windstorm / hurricane', 'Severe storms, hurricanes, typhoons, tornadoes', 2, 413, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.NH.04', 'Volcanic eruption', 'Eruption causing ash fall, transport disruption', 2, 414, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.NH.05', 'Wildfire', 'Uncontrolled fires threatening infrastructure and supply chains', 2, 415, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.NH.06', 'Drought / heatwave', 'Prolonged water scarcity or extreme heat events', 2, 416, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.NH.07', 'Solar storm / space weather', 'Geomagnetic storm disrupting electronics and power grids', 2, 417, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.CC', 'Climate Change', 'Long-term climate transition risks and physical risks', 1, 420, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.CC.01', 'Transition risk (regulatory)', 'Carbon taxes, emissions regulation, stranded assets', 2, 421, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.CC.02', 'Physical climate risk (chronic)', 'Sea level rise, shifting precipitation, chronic heat stress', 2, 422, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.CC.03', 'Biodiversity loss', 'Ecosystem collapse affecting agriculture, supply chains', 2, 423, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.EP', 'Environmental Pollution', 'Industrial accidents causing environmental contamination', 1, 430, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.EP.01', 'Industrial accident / toxic release', 'Chemical spill, explosion, radioactive contamination', 2, 431, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'EN.EP.02', 'Oil spill / marine pollution', 'Large-scale maritime environmental contamination', 2, 432, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Class 5: Social & Human (SH)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH', 'Social & Human', 'Risks from health crises, demographic shifts, social unrest, and human factors', 0, 500, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.PD', 'Pandemic & Health Crisis', 'Widespread disease outbreaks and public health emergencies', 1, 510, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.PD.01', 'Human pandemic', 'Global infectious disease outbreak (COVID-type, influenza, novel pathogen)', 2, 511, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.PD.02', 'Animal pandemic / zoonotic disease', 'Disease outbreak in livestock affecting food supply (avian flu, ASF)', 2, 512, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.PD.03', 'Plant pandemic / crop failure', 'Widespread crop disease or pest infestation', 2, 513, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.PD.04', 'Antimicrobial resistance', 'Loss of effective antibiotics threatening healthcare systems', 2, 514, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.SR', 'Social Disruption', 'Mass social movements, demographic crises, labor disruption', 1, 520, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.SR.01', 'Mass social unrest', 'Widespread protests, riots, strikes affecting business operations', 2, 521, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.SR.02', 'Mass migration crisis', 'Large-scale population displacement affecting labor markets and supply chains', 2, 522, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.SR.03', 'Skills shortage / labor crisis', 'Critical shortfall of skilled workers in key sectors', 2, 523, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.SR.04', 'Demographic shift', 'Aging population, urbanization stress, dependency ratio change', 2, 524, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.LG', 'Legal & Liability', 'Mass litigation, regulatory enforcement, liability crises', 1, 530, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.LG.01', 'Mass litigation / class action', 'Large-scale legal claims against organizations', 2, 531, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.LG.02', 'Product liability crisis', 'Defective product causing harm, triggering recalls and lawsuits', 2, 532, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.LG.03', 'Data privacy enforcement', 'Major GDPR/privacy fines and regulatory action', 2, 533, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.RP', 'Reputation & Trust', 'Loss of stakeholder trust and brand damage', 1, 540, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.RP.01', 'Reputational crisis', 'Public scandal, media crisis, loss of consumer trust', 2, 541, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.RP.02', 'Disinformation campaign', 'Coordinated false information targeting organization', 2, 542, 'active'),
('c0000000-0000-0000-0000-ca3b21d9e7a2', 'SH.RP.03', 'ESG backlash', 'Stakeholder backlash over environmental, social, or governance failures', 2, 543, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Set parent_entry_id: Families → Classes, Types → Families
-- ============================================================================
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'FE' AND catalog_id = 'c0000000-0000-0000-0000-ca3b21d9e7a2') WHERE code LIKE 'FE.%' AND level = 1 AND catalog_id = 'c0000000-0000-0000-0000-ca3b21d9e7a2';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'GS' AND catalog_id = 'c0000000-0000-0000-0000-ca3b21d9e7a2') WHERE code LIKE 'GS.%' AND level = 1 AND catalog_id = 'c0000000-0000-0000-0000-ca3b21d9e7a2';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'TC' AND catalog_id = 'c0000000-0000-0000-0000-ca3b21d9e7a2') WHERE code LIKE 'TC.%' AND level = 1 AND catalog_id = 'c0000000-0000-0000-0000-ca3b21d9e7a2';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'EN' AND catalog_id = 'c0000000-0000-0000-0000-ca3b21d9e7a2') WHERE code LIKE 'EN.%' AND level = 1 AND catalog_id = 'c0000000-0000-0000-0000-ca3b21d9e7a2';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'SH' AND catalog_id = 'c0000000-0000-0000-0000-ca3b21d9e7a2') WHERE code LIKE 'SH.%' AND level = 1 AND catalog_id = 'c0000000-0000-0000-0000-ca3b21d9e7a2';

-- Types under Families
UPDATE catalog_entry ce SET parent_entry_id = parent.id
FROM catalog_entry parent
WHERE ce.catalog_id = 'c0000000-0000-0000-0000-ca3b21d9e7a2'
  AND parent.catalog_id = 'c0000000-0000-0000-0000-ca3b21d9e7a2'
  AND ce.level = 2 AND parent.level = 1
  AND ce.code LIKE parent.code || '.%';

-- ============================================================================
-- Summary: 5 Classes + 18 Families + 56 Types = 79 entries (core set)
-- FE: Financial & Economic (4 families, 8 types)
-- GS: Geopolitical & Security (3 families, 10 types)
-- TC: Technology & Cyber (3 families, 11 types)
-- EN: Environmental & Natural (3 families, 10 types)
-- SH: Social & Human (4 families, 12 types)
-- NOTE: Full Cambridge v2.0 has ~175 types — this is the core set covering
-- the most relevant risk types for GRC. Additional granular types can be
-- added as custom catalog entries per organization.
-- ============================================================================
