-- ============================================================================
-- ARCTOS Seed: ESRS / CSRD — European Sustainability Reporting Standards
-- Source: EFRAG ESRS Set 1 (Delegated Regulation EU 2023/2772)
-- Structure: Standards (Level 0) -> Disclosure requirements (Level 1)
-- Target Modules: esg
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-e525c52d0000',
  'ESRS / CSRD',
  'European Sustainability Reporting Standards — Disclosure requirements under the Corporate Sustainability Reporting Directive (CSRD). Cross-cutting standards (ESRS 1-2), environmental (E1-E5), social (S1-S4), and governance (G1).',
  'control', 'platform', 'esrs_csrd', '2023', true, '{esg}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- ESRS 1: General requirements
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 1', 'General requirements', 'General principles, structure and conventions for sustainability reporting under ESRS', 0, 100, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 1-GP', 'General principles', 'Materiality, due diligence, value chain, time horizons, preparation and presentation of sustainability information', 1, 101, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- ESRS 2: General disclosures
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2', 'General disclosures', 'General disclosures applicable to all undertakings regardless of materiality assessment', 0, 200, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 BP-1', 'General basis for preparation of sustainability statements', 'Scope of consolidation, information about upstream and downstream value chain, and any exemptions used', 1, 201, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 BP-2', 'Disclosures in relation to specific circumstances', 'Information on changes in preparation and presentation, errors in prior periods, and disclosures stemming from other legislation', 1, 202, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 GOV-1', 'The role of the administrative, management and supervisory bodies', 'Composition, roles and responsibilities of governance bodies with regard to sustainability matters', 1, 203, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 GOV-2', 'Information provided to and sustainability matters addressed by the undertaking''s administrative, management and supervisory bodies', 'How governance bodies are informed about sustainability matters and how these matters are addressed', 1, 204, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 GOV-3', 'Integration of sustainability-related performance in incentive schemes', 'Whether and how sustainability-related performance is integrated into incentive schemes', 1, 205, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 GOV-4', 'Statement on due diligence', 'Mapping of information provided in sustainability statements to the due diligence process steps', 1, 206, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 GOV-5', 'Risk management and internal controls over sustainability reporting', 'Main features of the risk management and internal control system in relation to sustainability reporting', 1, 207, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 SBM-1', 'Strategy, business model and value chain', 'Key elements of strategy, business model and value chain, including sustainability-related aspects', 1, 208, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 SBM-2', 'Interests and views of stakeholders', 'How interests and views of stakeholders are taken into account by the undertaking''s strategy and business model', 1, 209, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 SBM-3', 'Material impacts, risks and opportunities and their interaction with strategy and business model', 'Description of material impacts, risks and opportunities and how they interact with strategy and business model', 1, 210, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 IRO-1', 'Description of the processes to identify and assess material impacts, risks and opportunities', 'Methodologies and processes used to identify material sustainability impacts, risks and opportunities', 1, 211, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 IRO-2', 'Disclosure requirements in ESRS covered by the undertaking''s sustainability statements', 'List of sustainability matters assessed to be material and the related ESRS disclosure requirements reported', 1, 212, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS 2 MDR', 'Minimum disclosure requirements for policies, actions, targets and metrics', 'Minimum disclosure requirement structure applicable to each topical ESRS', 1, 213, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- ESRS E1: Climate change
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E1', 'Climate change', 'Disclosure requirements related to climate change mitigation and adaptation', 0, 300, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E1-1', 'Transition plan for climate change mitigation', 'The undertaking''s transition plan for climate change mitigation, including targets, actions and resources', 1, 301, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E1-2', 'Policies related to climate change mitigation and adaptation', 'Policies adopted to manage material impacts, risks and opportunities related to climate change', 1, 302, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E1-3', 'Actions and resources in relation to climate change policies', 'Key actions taken and resources allocated to implement climate change policies and achieve targets', 1, 303, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E1-4', 'Targets related to climate change mitigation and adaptation', 'Climate-related targets set by the undertaking, including GHG emission reduction targets', 1, 304, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E1-5', 'Energy consumption and mix', 'Information on energy consumption and energy mix, including the share of renewable energy', 1, 305, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E1-6', 'Gross Scopes 1, 2, 3 and Total GHG emissions', 'Gross GHG emissions in Scope 1, 2, 3, and total, in metric tons of CO2 equivalent', 1, 306, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E1-7', 'GHG removals and GHG mitigation projects financed through carbon credits', 'GHG removals from own operations, and GHG emission reductions or removals from carbon credits', 1, 307, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E1-8', 'Internal carbon pricing', 'Whether the undertaking applies internal carbon pricing schemes and the related details', 1, 308, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E1-9', 'Anticipated financial effects from material physical and transition risks and potential climate-related opportunities', 'Anticipated financial effects of material physical risks, transition risks and climate-related opportunities', 1, 309, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- ESRS E2: Pollution
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E2', 'Pollution', 'Disclosure requirements related to pollution of air, water and soil', 0, 400, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E2-1', 'Policies related to pollution', 'Policies adopted to manage material impacts, risks and opportunities related to pollution prevention and control', 1, 401, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E2-2', 'Actions and resources related to pollution', 'Key actions taken and resources allocated to implement pollution-related policies and achieve targets', 1, 402, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E2-3', 'Targets related to pollution', 'Pollution-related targets set by the undertaking', 1, 403, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E2-4', 'Pollution of air, water and soil', 'Amounts of pollutants emitted to air, water and soil, including microplastics', 1, 404, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E2-5', 'Substances of concern and substances of very high concern', 'Information on substances of concern and SVHC produced or used', 1, 405, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E2-6', 'Anticipated financial effects from material pollution-related risks and opportunities', 'Anticipated financial effects of material pollution-related risks and opportunities', 1, 406, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- ESRS E3: Water and marine resources
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E3', 'Water and marine resources', 'Disclosure requirements related to water and marine resources', 0, 500, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E3-1', 'Policies related to water and marine resources', 'Policies adopted to manage material impacts, risks and opportunities related to water and marine resources', 1, 501, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E3-2', 'Actions and resources related to water and marine resources', 'Key actions taken and resources allocated to implement water and marine resources policies', 1, 502, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E3-3', 'Targets related to water and marine resources', 'Water and marine resources-related targets set by the undertaking', 1, 503, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E3-4', 'Water consumption', 'Information on water consumption including total water consumption and water consumption in areas at risk', 1, 504, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E3-5', 'Anticipated financial effects from material water and marine resources-related risks and opportunities', 'Anticipated financial effects of material water and marine resources-related risks and opportunities', 1, 505, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- ESRS E4: Biodiversity and ecosystems
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E4', 'Biodiversity and ecosystems', 'Disclosure requirements related to biodiversity and ecosystems', 0, 600, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E4-1', 'Transition plan on biodiversity and ecosystems', 'Transition plan and consideration of biodiversity and ecosystems in strategy and business model', 1, 601, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E4-2', 'Policies related to biodiversity and ecosystems', 'Policies adopted to manage material impacts, risks and opportunities related to biodiversity and ecosystems', 1, 602, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E4-3', 'Actions and resources related to biodiversity and ecosystems', 'Key actions taken and resources allocated to implement biodiversity and ecosystems policies', 1, 603, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E4-4', 'Targets related to biodiversity and ecosystems', 'Biodiversity and ecosystems-related targets set by the undertaking', 1, 604, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E4-5', 'Impact metrics related to biodiversity and ecosystems change', 'Information on material impact drivers and metrics related to biodiversity and ecosystems change', 1, 605, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E4-6', 'Anticipated financial effects from material biodiversity and ecosystem-related risks and opportunities', 'Anticipated financial effects of material biodiversity and ecosystem-related risks and opportunities', 1, 606, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- ESRS E5: Resource use and circular economy
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E5', 'Resource use and circular economy', 'Disclosure requirements related to resource use and circular economy', 0, 700, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E5-1', 'Policies related to resource use and circular economy', 'Policies adopted to manage material impacts, risks and opportunities related to resource use and circular economy', 1, 701, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E5-2', 'Actions and resources related to resource use and circular economy', 'Key actions taken and resources allocated to implement resource use and circular economy policies', 1, 702, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E5-3', 'Targets related to resource use and circular economy', 'Resource use and circular economy-related targets set by the undertaking', 1, 703, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E5-4', 'Resource inflows', 'Information on material resource inflows including the circularity of material resource inflows', 1, 704, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E5-5', 'Resource outflows', 'Information on resource outflows including products, materials, and waste', 1, 705, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS E5-6', 'Anticipated financial effects from material resource use and circular economy-related risks and opportunities', 'Anticipated financial effects of material resource use and circular economy-related risks and opportunities', 1, 706, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- ESRS S1: Own workforce
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1', 'Own workforce', 'Disclosure requirements related to the undertaking''s own workforce', 0, 800, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-1', 'Policies related to own workforce', 'Policies to manage material impacts, risks and opportunities related to own workforce', 1, 801, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-2', 'Processes for engaging with own workers and workers'' representatives about impacts', 'General and specific processes for engaging with own workforce and their representatives', 1, 802, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-3', 'Processes to remediate negative impacts and channels for own workers to raise concerns', 'Processes to remediate negative impacts and channels for own workers to raise grievances', 1, 803, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-4', 'Taking action on material impacts on own workforce, and approaches to managing material risks and pursuing material opportunities related to own workforce, and effectiveness of those actions', 'Actions taken, planned or underway to prevent, mitigate or remediate material negative impacts on own workforce', 1, 804, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-5', 'Targets related to managing material negative impacts, advancing positive impacts, and managing material risks and opportunities', 'Time-bound and outcome-oriented targets related to own workforce', 1, 805, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-6', 'Characteristics of the undertaking''s employees', 'Key characteristics of employees including headcount, gender breakdown, country breakdown and employment type', 1, 806, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-7', 'Characteristics of non-employee workers in the undertaking''s own workforce', 'Key characteristics of non-employee workers in the own workforce including type of engagement and headcount', 1, 807, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-8', 'Collective bargaining coverage and social dialogue', 'Extent to which employment terms are determined or influenced by collective bargaining agreements and extent of social dialogue', 1, 808, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-9', 'Diversity metrics', 'Gender distribution at top management and age distribution of employees', 1, 809, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-10', 'Adequate wages', 'Whether all employees are paid an adequate wage and the methodology used', 1, 810, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-11', 'Social protection', 'Whether all employees are covered by social protection against loss of income', 1, 811, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-12', 'Persons with disabilities', 'Percentage of employees with disabilities', 1, 812, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-13', 'Training and skills development metrics', 'Extent to which training and skills development is provided to own workforce', 1, 813, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-14', 'Health and safety metrics', 'Information on work-related injuries, ill health and fatalities', 1, 814, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-15', 'Work-life balance metrics', 'Percentage of employees entitled to and taking family-related leave', 1, 815, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-16', 'Compensation metrics (pay gap and total compensation)', 'Gender pay gap and ratio of CEO total compensation to median employee compensation', 1, 816, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S1-17', 'Incidents, complaints and severe human rights impacts', 'Work-related incidents, complaints and severe human rights impacts connected to own workforce', 1, 817, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- ESRS S2: Workers in the value chain
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S2', 'Workers in the value chain', 'Disclosure requirements related to workers in the value chain', 0, 900, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S2-1', 'Policies related to value chain workers', 'Policies to manage material impacts, risks and opportunities related to workers in the value chain', 1, 901, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S2-2', 'Processes for engaging with value chain workers about impacts', 'General and specific processes for engaging with value chain workers about actual and potential impacts', 1, 902, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S2-3', 'Processes to remediate negative impacts and channels for value chain workers to raise concerns', 'Processes to remediate negative impacts and grievance mechanisms for value chain workers', 1, 903, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S2-4', 'Taking action on material impacts on value chain workers', 'Actions taken, planned or underway to prevent, mitigate or remediate negative impacts on value chain workers', 1, 904, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S2-5', 'Targets related to managing material negative impacts, advancing positive impacts, and managing material risks and opportunities', 'Time-bound and outcome-oriented targets related to value chain workers', 1, 905, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- ESRS S3: Affected communities
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S3', 'Affected communities', 'Disclosure requirements related to affected communities', 0, 1000, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S3-1', 'Policies related to affected communities', 'Policies to manage material impacts, risks and opportunities related to affected communities', 1, 1001, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S3-2', 'Processes for engaging with affected communities about impacts', 'General and specific processes for engaging with affected communities about actual and potential impacts', 1, 1002, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S3-3', 'Processes to remediate negative impacts and channels for affected communities to raise concerns', 'Processes to remediate negative impacts and grievance mechanisms for affected communities', 1, 1003, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S3-4', 'Taking action on material impacts on affected communities', 'Actions taken, planned or underway to prevent, mitigate or remediate negative impacts on affected communities', 1, 1004, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S3-5', 'Targets related to managing material negative impacts, advancing positive impacts, and managing material risks and opportunities', 'Time-bound and outcome-oriented targets related to affected communities', 1, 1005, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- ESRS S4: Consumers and end-users
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S4', 'Consumers and end-users', 'Disclosure requirements related to consumers and end-users', 0, 1100, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S4-1', 'Policies related to consumers and end-users', 'Policies to manage material impacts, risks and opportunities related to consumers and end-users', 1, 1101, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S4-2', 'Processes for engaging with consumers and end-users about impacts', 'General and specific processes for engaging with consumers and end-users about actual and potential impacts', 1, 1102, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S4-3', 'Processes to remediate negative impacts and channels for consumers and end-users to raise concerns', 'Processes to remediate negative impacts and grievance mechanisms for consumers and end-users', 1, 1103, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S4-4', 'Taking action on material impacts on consumers and end-users', 'Actions taken, planned or underway to prevent, mitigate or remediate negative impacts on consumers and end-users', 1, 1104, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS S4-5', 'Targets related to managing material negative impacts, advancing positive impacts, and managing material risks and opportunities', 'Time-bound and outcome-oriented targets related to consumers and end-users', 1, 1105, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- ESRS G1: Business conduct
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS G1', 'Business conduct', 'Disclosure requirements related to business conduct including anti-corruption, political engagement and payment practices', 0, 1200, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS G1-1', 'Business conduct policies and corporate culture', 'Policies with respect to business conduct matters and how the undertaking fosters its corporate culture', 1, 1201, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS G1-2', 'Management of relationships with suppliers', 'Information about the management of relationships with suppliers and the related impacts on the supply chain', 1, 1202, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS G1-3', 'Prevention and detection of corruption and bribery', 'Procedures and measures in place for the prevention and detection of corruption and bribery', 1, 1203, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS G1-4', 'Incidents of corruption or bribery', 'Information on confirmed incidents of corruption or bribery', 1, 1204, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS G1-5', 'Political influence and lobbying activities', 'Information on activities and commitments related to political influence and lobbying', 1, 1205, 'active'),
('c0000000-0000-0000-0000-e525c52d0000', 'ESRS G1-6', 'Payment practices', 'Information on payment practices especially with regard to late payment to small and medium enterprises', 1, 1206, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
