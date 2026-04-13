-- seed_esrs_datapoints.sql
-- ESRS Datapoint Definitions for esrs_datapoint_definition table
-- Covers E1 (Climate Change), E2 (Pollution), E3 (Water), E4 (Biodiversity),
-- E5 (Circular Economy), S1 (Own Workforce), S2 (Workers in Value Chain),
-- S3 (Affected Communities), S4 (Consumers), G1 (Business Conduct)
-- Total: 65 datapoints
-- Idempotent: ON CONFLICT (datapoint_code) DO NOTHING

-- ============================================================
-- E1 — Climate Change (24 datapoints)
-- ============================================================

INSERT INTO esrs_datapoint_definition (id, esrs_standard, disclosure_requirement, datapoint_code, name_en, name_de, description_en, description_de, data_type, unit, is_mandatory, frequency, calculation_method, related_topics)
VALUES
  (gen_random_uuid(), 'E1', 'E1-1', 'E1-1.p16a',
   'Transition plan for climate change mitigation',
   'Transitionsplan zur Klimaschutzminderung',
   'Disclosure of the undertaking''s transition plan for climate change mitigation, including key assumptions and alignment with limiting global warming to 1.5 degrees Celsius.',
   'Offenlegung des Transitionsplans des Unternehmens zur Klimaschutzminderung, einschliesslich zentraler Annahmen und Ausrichtung auf die Begrenzung der globalen Erwaermung auf 1,5 Grad Celsius.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['climate_change', 'transition_plan']
  ),
  (gen_random_uuid(), 'E1', 'E1-1', 'E1-1.p16b',
   'Transition plan aligned with 1.5C Paris Agreement goal',
   'Transitionsplan im Einklang mit dem 1,5C-Ziel des Pariser Abkommens',
   'Whether the transition plan is compatible with limiting global warming to 1.5 degrees Celsius in line with the Paris Agreement.',
   'Ob der Transitionsplan mit der Begrenzung der globalen Erwaermung auf 1,5 Grad Celsius im Einklang mit dem Pariser Abkommen vereinbar ist.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['climate_change', 'paris_agreement']
  ),
  (gen_random_uuid(), 'E1', 'E1-1', 'E1-1.p16c',
   'GHG emission reduction targets in the transition plan',
   'THG-Emissionsreduktionsziele im Transitionsplan',
   'Disclosure of GHG emission reduction targets included in the transition plan.',
   'Offenlegung der im Transitionsplan enthaltenen THG-Emissionsreduktionsziele.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['climate_change', 'ghg_targets']
  ),
  (gen_random_uuid(), 'E1', 'E1-1', 'E1-1.p16d',
   'Key decarbonisation levers and actions planned',
   'Wichtige Dekarbonisierungshebel und geplante Massnahmen',
   'Description of key decarbonisation levers identified and key actions planned, including changes in the product portfolio and adoption of new technologies.',
   'Beschreibung der identifizierten zentralen Dekarbonisierungshebel und geplanten Massnahmen, einschliesslich Aenderungen im Produktportfolio und Einfuehrung neuer Technologien.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['climate_change', 'decarbonisation']
  ),
  (gen_random_uuid(), 'E1', 'E1-1', 'E1-1.p16e',
   'Locked-in GHG emissions from key assets',
   'Gebundene THG-Emissionen aus wichtigen Vermoegenswerten',
   'Disclosure of significant locked-in GHG emissions from the undertaking''s key assets and products.',
   'Offenlegung signifikanter gebundener THG-Emissionen aus wichtigen Vermoegenswerten und Produkten des Unternehmens.',
   'quantitative', 'tCO2e', false, 'annual', NULL, ARRAY['climate_change', 'locked_in_emissions']
  ),
  (gen_random_uuid(), 'E1', 'E1-1', 'E1-1.p16f',
   'CapEx and OpEx in transition plan',
   'CapEx und OpEx im Transitionsplan',
   'Disclosure of CapEx and OpEx amounts or percentages required for implementing the transition plan.',
   'Offenlegung der fuer die Umsetzung des Transitionsplans erforderlichen CapEx- und OpEx-Betraege oder -Prozentsaetze.',
   'quantitative', 'EUR', false, 'annual', NULL, ARRAY['climate_change', 'investment']
  ),
  (gen_random_uuid(), 'E1', 'E1-2', 'E1-2.p20',
   'Policies related to climate change mitigation and adaptation',
   'Strategien zur Klimaschutzminderung und -anpassung',
   'Description of the policies the undertaking has in place to manage its material impacts, risks and opportunities related to climate change mitigation and adaptation.',
   'Beschreibung der Strategien des Unternehmens zum Management wesentlicher Auswirkungen, Risiken und Chancen im Zusammenhang mit Klimaschutzminderung und -anpassung.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['climate_change', 'policies']
  ),
  (gen_random_uuid(), 'E1', 'E1-3', 'E1-3.p26',
   'Actions and resources related to climate change',
   'Massnahmen und Ressourcen im Zusammenhang mit dem Klimawandel',
   'Description of the key actions taken and planned to achieve climate-related targets and manage risks and opportunities.',
   'Beschreibung der wichtigsten ergriffenen und geplanten Massnahmen zur Erreichung klimabezogener Ziele und zum Management von Risiken und Chancen.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['climate_change', 'actions']
  ),
  (gen_random_uuid(), 'E1', 'E1-4', 'E1-4.p34',
   'GHG emission reduction targets',
   'THG-Emissionsreduktionsziele',
   'Disclosure of the GHG emission reduction targets the undertaking has set, including whether they are science-based and validated by SBTi.',
   'Offenlegung der vom Unternehmen festgelegten THG-Emissionsreduktionsziele, einschliesslich ob sie wissenschaftsbasiert und durch SBTi validiert sind.',
   'semi-quantitative', NULL, true, 'annual', NULL, ARRAY['climate_change', 'sbti', 'targets']
  ),
  (gen_random_uuid(), 'E1', 'E1-4', 'E1-4.p34a',
   'Absolute GHG emission reduction target value',
   'Absolutes THG-Emissionsreduktionsziel',
   'Disclosure of the absolute value of the GHG emission reduction target for Scope 1, 2, and 3.',
   'Offenlegung des absoluten Werts des THG-Emissionsreduktionsziels fuer Scope 1, 2 und 3.',
   'quantitative', 'tCO2e', true, 'annual', NULL, ARRAY['climate_change', 'targets']
  ),
  (gen_random_uuid(), 'E1', 'E1-4', 'E1-4.p34b',
   'Target year for GHG emission reduction',
   'Zieljahr fuer THG-Emissionsreduktion',
   'Target year by which the GHG emission reduction target is to be achieved.',
   'Zieljahr, bis zu dem das THG-Emissionsreduktionsziel erreicht werden soll.',
   'quantitative', 'year', true, 'annual', NULL, ARRAY['climate_change', 'targets']
  ),
  (gen_random_uuid(), 'E1', 'E1-5', 'E1-5.p38',
   'Total energy consumption from fossil sources',
   'Gesamtenergieverbrauch aus fossilen Quellen',
   'Total energy consumption from fossil fuel sources in MWh.',
   'Gesamtenergieverbrauch aus fossilen Brennstoffquellen in MWh.',
   'quantitative', 'MWh', true, 'annual', 'Sum of all fossil fuel energy consumption', ARRAY['climate_change', 'energy']
  ),
  (gen_random_uuid(), 'E1', 'E1-5', 'E1-5.p39',
   'Total energy consumption from nuclear sources',
   'Gesamtenergieverbrauch aus Kernenergiequellen',
   'Total energy consumption from nuclear sources in MWh.',
   'Gesamtenergieverbrauch aus Kernenergiequellen in MWh.',
   'quantitative', 'MWh', false, 'annual', NULL, ARRAY['climate_change', 'energy']
  ),
  (gen_random_uuid(), 'E1', 'E1-5', 'E1-5.p40',
   'Total energy consumption from renewable sources',
   'Gesamtenergieverbrauch aus erneuerbaren Quellen',
   'Total energy consumption from renewable energy sources in MWh.',
   'Gesamtenergieverbrauch aus erneuerbaren Energiequellen in MWh.',
   'quantitative', 'MWh', true, 'annual', 'Sum of all renewable energy consumption', ARRAY['climate_change', 'energy', 'renewables']
  ),
  (gen_random_uuid(), 'E1', 'E1-5', 'E1-5.p41',
   'Total energy consumption',
   'Gesamtenergieverbrauch',
   'Total energy consumption in MWh, broken down by fossil, nuclear, and renewable sources.',
   'Gesamtenergieverbrauch in MWh, aufgeschluesselt nach fossilen, nuklearen und erneuerbaren Quellen.',
   'quantitative', 'MWh', true, 'annual', 'Fossil + Nuclear + Renewable', ARRAY['climate_change', 'energy']
  ),
  (gen_random_uuid(), 'E1', 'E1-5', 'E1-5.p42',
   'Energy intensity per net revenue',
   'Energieintensitaet pro Nettoumsatz',
   'Total energy consumption per net revenue (MWh/EUR million).',
   'Gesamtenergieverbrauch pro Nettoumsatz (MWh/Mio. EUR).',
   'quantitative', 'MWh/M EUR', true, 'annual', 'Total energy / Net revenue', ARRAY['climate_change', 'energy', 'intensity']
  ),
  (gen_random_uuid(), 'E1', 'E1-6', 'E1-6.p44',
   'Gross Scope 1 GHG emissions',
   'Brutto-Scope-1-THG-Emissionen',
   'Gross Scope 1 GHG emissions in metric tonnes of CO2 equivalent.',
   'Brutto-Scope-1-THG-Emissionen in metrischen Tonnen CO2-Aequivalent.',
   'quantitative', 'tCO2e', true, 'annual', 'Direct emissions from owned/controlled sources', ARRAY['climate_change', 'scope_1', 'ghg']
  ),
  (gen_random_uuid(), 'E1', 'E1-6', 'E1-6.p45',
   'Gross Scope 2 GHG emissions (location-based)',
   'Brutto-Scope-2-THG-Emissionen (standortbasiert)',
   'Gross location-based Scope 2 GHG emissions in metric tonnes of CO2 equivalent.',
   'Brutto standortbasierte Scope-2-THG-Emissionen in metrischen Tonnen CO2-Aequivalent.',
   'quantitative', 'tCO2e', true, 'annual', 'Location-based method per GHG Protocol', ARRAY['climate_change', 'scope_2', 'ghg']
  ),
  (gen_random_uuid(), 'E1', 'E1-6', 'E1-6.p46',
   'Gross Scope 2 GHG emissions (market-based)',
   'Brutto-Scope-2-THG-Emissionen (marktbasiert)',
   'Gross market-based Scope 2 GHG emissions in metric tonnes of CO2 equivalent.',
   'Brutto marktbasierte Scope-2-THG-Emissionen in metrischen Tonnen CO2-Aequivalent.',
   'quantitative', 'tCO2e', true, 'annual', 'Market-based method per GHG Protocol', ARRAY['climate_change', 'scope_2', 'ghg']
  ),
  (gen_random_uuid(), 'E1', 'E1-6', 'E1-6.p51',
   'Gross Scope 3 GHG emissions',
   'Brutto-Scope-3-THG-Emissionen',
   'Total gross Scope 3 GHG emissions in metric tonnes of CO2 equivalent across all relevant categories.',
   'Gesamte Brutto-Scope-3-THG-Emissionen in metrischen Tonnen CO2-Aequivalent ueber alle relevanten Kategorien.',
   'quantitative', 'tCO2e', true, 'annual', 'Sum of all 15 Scope 3 categories', ARRAY['climate_change', 'scope_3', 'ghg', 'value_chain']
  ),
  (gen_random_uuid(), 'E1', 'E1-6', 'E1-6.p52',
   'Total GHG emissions (Scope 1 + 2 + 3)',
   'Gesamte THG-Emissionen (Scope 1 + 2 + 3)',
   'Total GHG emissions as sum of Scope 1, Scope 2, and Scope 3 emissions.',
   'Gesamte THG-Emissionen als Summe von Scope 1, Scope 2 und Scope 3 Emissionen.',
   'quantitative', 'tCO2e', true, 'annual', 'Scope 1 + Scope 2 (market-based) + Scope 3', ARRAY['climate_change', 'ghg', 'total']
  ),
  (gen_random_uuid(), 'E1', 'E1-6', 'E1-6.p53',
   'GHG emissions intensity per net revenue',
   'THG-Emissionsintensitaet pro Nettoumsatz',
   'GHG emissions intensity expressed as metric tonnes of CO2e per EUR million of net revenue.',
   'THG-Emissionsintensitaet ausgedrueckt in metrischen Tonnen CO2e pro Mio. EUR Nettoumsatz.',
   'quantitative', 'tCO2e/M EUR', true, 'annual', 'Total GHG / Net revenue', ARRAY['climate_change', 'ghg', 'intensity']
  ),
  (gen_random_uuid(), 'E1', 'E1-7', 'E1-7.p56',
   'GHG removals and carbon credits',
   'THG-Entfernungen und Kohlenstoffzertifikate',
   'GHG removals and storage from the undertaking''s own operations and the use of carbon credits.',
   'THG-Entfernungen und -Speicherung aus eigenen Geschaeftstaetigkeiten und Nutzung von Kohlenstoffzertifikaten.',
   'quantitative', 'tCO2e', false, 'annual', NULL, ARRAY['climate_change', 'removals', 'carbon_credits']
  ),
  (gen_random_uuid(), 'E1', 'E1-8', 'E1-8.p60',
   'Internal carbon pricing',
   'Interne CO2-Bepreisung',
   'Whether the undertaking applies internal carbon pricing and, if so, how it is used in decision-making.',
   'Ob das Unternehmen eine interne CO2-Bepreisung anwendet und wie diese bei der Entscheidungsfindung eingesetzt wird.',
   'semi-quantitative', 'EUR/tCO2e', false, 'annual', NULL, ARRAY['climate_change', 'carbon_pricing']
  )
ON CONFLICT (datapoint_code) DO NOTHING;

-- ============================================================
-- E2 — Pollution (4 datapoints)
-- ============================================================

INSERT INTO esrs_datapoint_definition (id, esrs_standard, disclosure_requirement, datapoint_code, name_en, name_de, description_en, description_de, data_type, unit, is_mandatory, frequency, calculation_method, related_topics)
VALUES
  (gen_random_uuid(), 'E2', 'E2-1', 'E2-1.p11',
   'Policies related to pollution',
   'Strategien in Bezug auf Umweltverschmutzung',
   'Disclosure of the policies the undertaking has in place to manage material impacts, risks and opportunities related to pollution prevention and control.',
   'Offenlegung der Strategien zur Steuerung wesentlicher Auswirkungen, Risiken und Chancen im Zusammenhang mit der Verhuetung und Kontrolle von Umweltverschmutzung.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['pollution', 'policies']
  ),
  (gen_random_uuid(), 'E2', 'E2-4', 'E2-4.p26',
   'Pollutants emitted to air',
   'Schadstoffemissionen in die Luft',
   'Amounts of each pollutant emitted to air listed in Annex II of the E-PRTR Regulation.',
   'Mengen jedes in die Luft emittierten Schadstoffs, die in Anhang II der E-PRTR-Verordnung aufgefuehrt sind.',
   'quantitative', 'tonnes', false, 'annual', NULL, ARRAY['pollution', 'air_emissions']
  ),
  (gen_random_uuid(), 'E2', 'E2-4', 'E2-4.p27',
   'Pollutants emitted to water',
   'Schadstoffemissionen in Gewaesser',
   'Amounts of each pollutant emitted to water listed in Annex II of the E-PRTR Regulation.',
   'Mengen jedes in Gewaesser emittierten Schadstoffs gemaess Anhang II der E-PRTR-Verordnung.',
   'quantitative', 'tonnes', false, 'annual', NULL, ARRAY['pollution', 'water_emissions']
  ),
  (gen_random_uuid(), 'E2', 'E2-4', 'E2-4.p28',
   'Pollutants emitted to soil',
   'Schadstoffemissionen in den Boden',
   'Amounts of each pollutant emitted to soil listed in Annex II of the E-PRTR Regulation.',
   'Mengen jedes in den Boden emittierten Schadstoffs gemaess Anhang II der E-PRTR-Verordnung.',
   'quantitative', 'tonnes', false, 'annual', NULL, ARRAY['pollution', 'soil_emissions']
  )
ON CONFLICT (datapoint_code) DO NOTHING;

-- ============================================================
-- E3 — Water and Marine Resources (3 datapoints)
-- ============================================================

INSERT INTO esrs_datapoint_definition (id, esrs_standard, disclosure_requirement, datapoint_code, name_en, name_de, description_en, description_de, data_type, unit, is_mandatory, frequency, calculation_method, related_topics)
VALUES
  (gen_random_uuid(), 'E3', 'E3-1', 'E3-1.p9',
   'Policies related to water and marine resources',
   'Strategien in Bezug auf Wasser und Meeresressourcen',
   'Disclosure of policies to manage material impacts, risks and opportunities related to water and marine resources.',
   'Offenlegung der Strategien zur Steuerung wesentlicher Auswirkungen, Risiken und Chancen in Bezug auf Wasser und Meeresressourcen.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['water', 'policies']
  ),
  (gen_random_uuid(), 'E3', 'E3-4', 'E3-4.p28',
   'Total water consumption',
   'Gesamtwasserverbrauch',
   'Total water consumption in cubic metres.',
   'Gesamtwasserverbrauch in Kubikmetern.',
   'quantitative', 'm3', false, 'annual', NULL, ARRAY['water', 'consumption']
  ),
  (gen_random_uuid(), 'E3', 'E3-4', 'E3-4.p29',
   'Water consumption in areas of high water stress',
   'Wasserverbrauch in Gebieten mit hohem Wasserstress',
   'Water consumption in areas of high water stress as identified using the WRI Aqueduct tool.',
   'Wasserverbrauch in Gebieten mit hohem Wasserstress, identifiziert mittels des WRI-Aqueduct-Tools.',
   'quantitative', 'm3', false, 'annual', NULL, ARRAY['water', 'water_stress']
  )
ON CONFLICT (datapoint_code) DO NOTHING;

-- ============================================================
-- E4 — Biodiversity and Ecosystems (3 datapoints)
-- ============================================================

INSERT INTO esrs_datapoint_definition (id, esrs_standard, disclosure_requirement, datapoint_code, name_en, name_de, description_en, description_de, data_type, unit, is_mandatory, frequency, calculation_method, related_topics)
VALUES
  (gen_random_uuid(), 'E4', 'E4-1', 'E4-1.p10',
   'Transition plan for biodiversity and ecosystems',
   'Transitionsplan fuer Biodiversitaet und Oekosysteme',
   'Disclosure of the transition plan for improvement of biodiversity and ecosystem protection, including science-based targets.',
   'Offenlegung des Transitionsplans zur Verbesserung des Schutzes von Biodiversitaet und Oekosystemen, einschliesslich wissenschaftsbasierter Ziele.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['biodiversity', 'transition_plan']
  ),
  (gen_random_uuid(), 'E4', 'E4-2', 'E4-2.p18',
   'Policies related to biodiversity and ecosystems',
   'Strategien in Bezug auf Biodiversitaet und Oekosysteme',
   'Disclosure of policies to manage material impacts, risks and opportunities related to biodiversity and ecosystems.',
   'Offenlegung der Strategien zur Steuerung wesentlicher Auswirkungen, Risiken und Chancen in Bezug auf Biodiversitaet und Oekosysteme.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['biodiversity', 'policies']
  ),
  (gen_random_uuid(), 'E4', 'E4-5', 'E4-5.p33',
   'Impact metrics related to biodiversity change',
   'Wirkungskennzahlen zum Biodiversitaetswandel',
   'Disclosure of metrics related to the undertaking''s impact on biodiversity, including land use change and ecosystem degradation.',
   'Offenlegung von Kennzahlen zu den Auswirkungen des Unternehmens auf die Biodiversitaet, einschliesslich Landnutzungsaenderungen und Oekosystemdegradation.',
   'quantitative', 'hectares', false, 'annual', NULL, ARRAY['biodiversity', 'land_use']
  )
ON CONFLICT (datapoint_code) DO NOTHING;

-- ============================================================
-- E5 — Circular Economy (3 datapoints)
-- ============================================================

INSERT INTO esrs_datapoint_definition (id, esrs_standard, disclosure_requirement, datapoint_code, name_en, name_de, description_en, description_de, data_type, unit, is_mandatory, frequency, calculation_method, related_topics)
VALUES
  (gen_random_uuid(), 'E5', 'E5-1', 'E5-1.p10',
   'Policies related to resource use and circular economy',
   'Strategien zur Ressourcennutzung und Kreislaufwirtschaft',
   'Disclosure of policies to manage material impacts, risks and opportunities related to resource use and circular economy.',
   'Offenlegung der Strategien zur Steuerung wesentlicher Auswirkungen, Risiken und Chancen in Bezug auf Ressourcennutzung und Kreislaufwirtschaft.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['circular_economy', 'policies']
  ),
  (gen_random_uuid(), 'E5', 'E5-5', 'E5-5.p37',
   'Total waste generated',
   'Gesamtes erzeugtes Abfallaufkommen',
   'Total amount of waste generated by the undertaking in tonnes, split by hazardous and non-hazardous.',
   'Gesamtmenge des vom Unternehmen erzeugten Abfalls in Tonnen, aufgeschluesselt nach gefaehrlich und nicht gefaehrlich.',
   'quantitative', 'tonnes', false, 'annual', NULL, ARRAY['circular_economy', 'waste']
  ),
  (gen_random_uuid(), 'E5', 'E5-5', 'E5-5.p40',
   'Resource inflows including recycled content',
   'Ressourcenzufluesse einschliesslich Recyclinganteil',
   'Total weight or percentage of materials used that are recycled input materials.',
   'Gesamtgewicht oder Prozentsatz der verwendeten Materialien, die aus recycelten Einsatzstoffen bestehen.',
   'quantitative', 'tonnes', false, 'annual', NULL, ARRAY['circular_economy', 'recycling']
  )
ON CONFLICT (datapoint_code) DO NOTHING;

-- ============================================================
-- S1 — Own Workforce (12 datapoints)
-- ============================================================

INSERT INTO esrs_datapoint_definition (id, esrs_standard, disclosure_requirement, datapoint_code, name_en, name_de, description_en, description_de, data_type, unit, is_mandatory, frequency, calculation_method, related_topics)
VALUES
  (gen_random_uuid(), 'S1', 'S1-1', 'S1-1.p20',
   'Policies related to own workforce',
   'Strategien in Bezug auf die eigene Belegschaft',
   'Disclosure of policies to manage material impacts on the undertaking''s own workforce, including human rights commitments.',
   'Offenlegung der Strategien zur Steuerung wesentlicher Auswirkungen auf die eigene Belegschaft, einschliesslich Menschenrechtsverpflichtungen.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['own_workforce', 'policies', 'human_rights']
  ),
  (gen_random_uuid(), 'S1', 'S1-2', 'S1-2.p26',
   'Processes for engaging with own workforce',
   'Prozesse zur Einbindung der eigenen Belegschaft',
   'Description of general processes for engaging with own workers and their representatives about impacts.',
   'Beschreibung der allgemeinen Prozesse zur Einbindung der eigenen Arbeitnehmer und deren Vertreter in Bezug auf Auswirkungen.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['own_workforce', 'engagement']
  ),
  (gen_random_uuid(), 'S1', 'S1-3', 'S1-3.p30',
   'Remediation processes for negative impacts on own workforce',
   'Abhilfeprozesse fuer negative Auswirkungen auf die eigene Belegschaft',
   'Description of processes to remediate negative impacts on own workforce and channels for raising concerns.',
   'Beschreibung der Prozesse zur Behebung negativer Auswirkungen auf die eigene Belegschaft und Kanaele zur Meldung von Bedenken.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['own_workforce', 'remediation', 'grievance']
  ),
  (gen_random_uuid(), 'S1', 'S1-6', 'S1-6.p50',
   'Total number of employees (headcount)',
   'Gesamtzahl der Beschaeftigten (Kopfzahl)',
   'Total headcount of employees at the end of the reporting period, broken down by gender and country.',
   'Gesamtkopfzahl der Beschaeftigten am Ende des Berichtszeitraums, aufgeschluesselt nach Geschlecht und Land.',
   'quantitative', 'headcount', true, 'annual', NULL, ARRAY['own_workforce', 'headcount']
  ),
  (gen_random_uuid(), 'S1', 'S1-6', 'S1-6.p51',
   'Total number of employees (FTE)',
   'Gesamtzahl der Beschaeftigten (VZAe)',
   'Total number of employees in full-time equivalents at the end of the reporting period.',
   'Gesamtzahl der Beschaeftigten in Vollzeitaequivalenten am Ende des Berichtszeitraums.',
   'quantitative', 'FTE', true, 'annual', NULL, ARRAY['own_workforce', 'fte']
  ),
  (gen_random_uuid(), 'S1', 'S1-6', 'S1-6.p52',
   'Employee turnover rate',
   'Mitarbeiterfluktuation',
   'Rate of employee turnover during the reporting period.',
   'Fluktuationsrate der Mitarbeiter im Berichtszeitraum.',
   'quantitative', '%', true, 'annual', 'Leavers / Average headcount * 100', ARRAY['own_workforce', 'turnover']
  ),
  (gen_random_uuid(), 'S1', 'S1-8', 'S1-8.p61',
   'Collective bargaining coverage',
   'Tarifbindungsquote',
   'Percentage of employees covered by collective bargaining agreements.',
   'Prozentsatz der Beschaeftigten, die durch Tarifvertraege abgedeckt sind.',
   'quantitative', '%', true, 'annual', NULL, ARRAY['own_workforce', 'collective_bargaining']
  ),
  (gen_random_uuid(), 'S1', 'S1-9', 'S1-9.p66',
   'Gender diversity in workforce',
   'Geschlechterdiversitaet in der Belegschaft',
   'Distribution of employees by gender, including in management and other levels.',
   'Verteilung der Beschaeftigten nach Geschlecht, einschliesslich Management und anderen Ebenen.',
   'quantitative', '%', true, 'annual', NULL, ARRAY['own_workforce', 'diversity', 'gender']
  ),
  (gen_random_uuid(), 'S1', 'S1-10', 'S1-10.p71',
   'Adequate wages — lowest wage vs applicable benchmark',
   'Angemessene Loehne — niedrigster Lohn vs. geltende Benchmark',
   'Whether all employees are paid an adequate wage, assessed against applicable benchmarks.',
   'Ob alle Beschaeftigten einen angemessenen Lohn erhalten, bewertet anhand geltender Benchmarks.',
   'semi-quantitative', NULL, true, 'annual', NULL, ARRAY['own_workforce', 'wages']
  ),
  (gen_random_uuid(), 'S1', 'S1-14', 'S1-14.p88a',
   'Work-related fatalities',
   'Arbeitsbedingte Todesfaelle',
   'Number of fatalities as a result of work-related injuries and work-related ill health among own workforce.',
   'Anzahl der Todesfaelle infolge arbeitsbedingter Verletzungen und arbeitsbedingter Erkrankungen in der eigenen Belegschaft.',
   'quantitative', 'count', true, 'annual', NULL, ARRAY['own_workforce', 'health_safety', 'fatalities']
  ),
  (gen_random_uuid(), 'S1', 'S1-14', 'S1-14.p88b',
   'Recordable work-related accidents',
   'Meldepflichtige arbeitsbedingte Unfaelle',
   'Number and rate of recordable work-related accidents.',
   'Anzahl und Rate meldepflichtiger arbeitsbedingter Unfaelle.',
   'quantitative', 'count', true, 'annual', NULL, ARRAY['own_workforce', 'health_safety', 'accidents']
  ),
  (gen_random_uuid(), 'S1', 'S1-16', 'S1-16.p97',
   'Gender pay gap',
   'Geschlechtsspezifisches Lohngefaelle',
   'Percentage difference between the average gross hourly earnings of male and female employees.',
   'Prozentuale Differenz zwischen dem durchschnittlichen Bruttostundenverdienst maennlicher und weiblicher Beschaeftigter.',
   'quantitative', '%', true, 'annual', '(Male avg - Female avg) / Male avg * 100', ARRAY['own_workforce', 'pay_gap', 'gender']
  )
ON CONFLICT (datapoint_code) DO NOTHING;

-- ============================================================
-- S2 — Workers in the Value Chain (3 datapoints)
-- ============================================================

INSERT INTO esrs_datapoint_definition (id, esrs_standard, disclosure_requirement, datapoint_code, name_en, name_de, description_en, description_de, data_type, unit, is_mandatory, frequency, calculation_method, related_topics)
VALUES
  (gen_random_uuid(), 'S2', 'S2-1', 'S2-1.p14',
   'Policies related to value chain workers',
   'Strategien in Bezug auf Arbeitnehmer in der Wertschoepfungskette',
   'Disclosure of policies to manage material impacts on workers in the value chain, including forced labour and child labour.',
   'Offenlegung der Strategien zur Steuerung wesentlicher Auswirkungen auf Arbeitnehmer in der Wertschoepfungskette, einschliesslich Zwangsarbeit und Kinderarbeit.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['value_chain_workers', 'policies', 'human_rights']
  ),
  (gen_random_uuid(), 'S2', 'S2-2', 'S2-2.p19',
   'Processes for engaging with value chain workers',
   'Prozesse zur Einbindung der Arbeitnehmer in der Wertschoepfungskette',
   'Description of general processes for engaging with value chain workers about actual and potential impacts.',
   'Beschreibung der allgemeinen Prozesse zur Einbindung der Arbeitnehmer in der Wertschoepfungskette in Bezug auf tatsaechliche und potenzielle Auswirkungen.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['value_chain_workers', 'engagement']
  ),
  (gen_random_uuid(), 'S2', 'S2-5', 'S2-5.p37',
   'Material impacts on value chain workers',
   'Wesentliche Auswirkungen auf Arbeitnehmer in der Wertschoepfungskette',
   'Description of material negative and positive impacts on workers in the value chain connected to the undertaking''s operations.',
   'Beschreibung wesentlicher negativer und positiver Auswirkungen auf Arbeitnehmer in der Wertschoepfungskette im Zusammenhang mit den Geschaeftstaetigkeiten des Unternehmens.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['value_chain_workers', 'impacts']
  )
ON CONFLICT (datapoint_code) DO NOTHING;

-- ============================================================
-- S3 — Affected Communities (2 datapoints)
-- ============================================================

INSERT INTO esrs_datapoint_definition (id, esrs_standard, disclosure_requirement, datapoint_code, name_en, name_de, description_en, description_de, data_type, unit, is_mandatory, frequency, calculation_method, related_topics)
VALUES
  (gen_random_uuid(), 'S3', 'S3-1', 'S3-1.p13',
   'Policies related to affected communities',
   'Strategien in Bezug auf betroffene Gemeinschaften',
   'Disclosure of policies to manage material impacts, risks and opportunities related to affected communities, including indigenous peoples.',
   'Offenlegung der Strategien zur Steuerung wesentlicher Auswirkungen, Risiken und Chancen in Bezug auf betroffene Gemeinschaften, einschliesslich indigener Voelker.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['affected_communities', 'policies']
  ),
  (gen_random_uuid(), 'S3', 'S3-4', 'S3-4.p36',
   'Material impacts on affected communities',
   'Wesentliche Auswirkungen auf betroffene Gemeinschaften',
   'Description of material negative and positive impacts on affected communities connected to the undertaking''s operations and value chain.',
   'Beschreibung wesentlicher negativer und positiver Auswirkungen auf betroffene Gemeinschaften im Zusammenhang mit Geschaeftstaetigkeiten und Wertschoepfungskette des Unternehmens.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['affected_communities', 'impacts']
  )
ON CONFLICT (datapoint_code) DO NOTHING;

-- ============================================================
-- S4 — Consumers and End-Users (2 datapoints)
-- ============================================================

INSERT INTO esrs_datapoint_definition (id, esrs_standard, disclosure_requirement, datapoint_code, name_en, name_de, description_en, description_de, data_type, unit, is_mandatory, frequency, calculation_method, related_topics)
VALUES
  (gen_random_uuid(), 'S4', 'S4-1', 'S4-1.p13',
   'Policies related to consumers and end-users',
   'Strategien in Bezug auf Verbraucher und Endnutzer',
   'Disclosure of policies to manage material impacts, risks and opportunities related to consumers and end-users, including product safety and data privacy.',
   'Offenlegung der Strategien zur Steuerung wesentlicher Auswirkungen, Risiken und Chancen in Bezug auf Verbraucher und Endnutzer, einschliesslich Produktsicherheit und Datenschutz.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['consumers', 'policies', 'product_safety']
  ),
  (gen_random_uuid(), 'S4', 'S4-4', 'S4-4.p35',
   'Material impacts on consumers and end-users',
   'Wesentliche Auswirkungen auf Verbraucher und Endnutzer',
   'Description of material negative and positive impacts on consumers and end-users identified through the materiality assessment.',
   'Beschreibung wesentlicher negativer und positiver Auswirkungen auf Verbraucher und Endnutzer, die durch die Wesentlichkeitsanalyse identifiziert wurden.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['consumers', 'impacts']
  )
ON CONFLICT (datapoint_code) DO NOTHING;

-- ============================================================
-- G1 — Business Conduct (9 datapoints)
-- ============================================================

INSERT INTO esrs_datapoint_definition (id, esrs_standard, disclosure_requirement, datapoint_code, name_en, name_de, description_en, description_de, data_type, unit, is_mandatory, frequency, calculation_method, related_topics)
VALUES
  (gen_random_uuid(), 'G1', 'G1-1', 'G1-1.p10',
   'Corporate culture and business conduct policies',
   'Unternehmenskultur und Geschaeftsfuehrungsrichtlinien',
   'Disclosure of the role of administrative, management and supervisory bodies in fostering a corporate culture on business conduct.',
   'Offenlegung der Rolle der Verwaltungs-, Leitungs- und Aufsichtsorgane bei der Foerderung einer Unternehmenskultur im Bereich Geschaeftsfuehrung.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['business_conduct', 'corporate_culture']
  ),
  (gen_random_uuid(), 'G1', 'G1-1', 'G1-1.p10a',
   'Anti-corruption and anti-bribery policies',
   'Antikorruptions- und Bestechungsbekaempfungsrichtlinien',
   'Description of policies on anti-corruption and anti-bribery, including training and awareness programs.',
   'Beschreibung der Richtlinien zur Bekaempfung von Korruption und Bestechung, einschliesslich Schulungs- und Sensibilisierungsprogrammen.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['business_conduct', 'anti_corruption']
  ),
  (gen_random_uuid(), 'G1', 'G1-1', 'G1-1.p10b',
   'Whistleblower protection mechanisms',
   'Hinweisgeberschutzmechanismen',
   'Description of mechanisms for the protection of whistleblowers in accordance with applicable legislation.',
   'Beschreibung der Mechanismen zum Schutz von Hinweisgebern in Uebereinstimmung mit geltendem Recht.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['business_conduct', 'whistleblowing']
  ),
  (gen_random_uuid(), 'G1', 'G1-2', 'G1-2.p15',
   'Management of relationships with suppliers',
   'Management der Beziehungen zu Lieferanten',
   'Information about the management of relationships with suppliers, including payment practices.',
   'Informationen ueber das Management der Beziehungen zu Lieferanten, einschliesslich Zahlungspraktiken.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['business_conduct', 'suppliers', 'payment_practices']
  ),
  (gen_random_uuid(), 'G1', 'G1-3', 'G1-3.p17',
   'Prevention and detection of corruption and bribery',
   'Praevention und Aufdeckung von Korruption und Bestechung',
   'Description of procedures to prevent, detect and address allegations of corruption and bribery.',
   'Beschreibung der Verfahren zur Praevention, Aufdeckung und Behandlung von Korruptions- und Bestechungsvorwuerfen.',
   'narrative', NULL, true, 'annual', NULL, ARRAY['business_conduct', 'anti_corruption', 'compliance']
  ),
  (gen_random_uuid(), 'G1', 'G1-3', 'G1-3.p18',
   'Confirmed incidents of corruption or bribery',
   'Bestaetigte Korruptions- oder Bestechungsvorfaelle',
   'Number of confirmed incidents of corruption or bribery during the reporting period.',
   'Anzahl bestaetigter Korruptions- oder Bestechungsvorfaelle im Berichtszeitraum.',
   'quantitative', 'count', true, 'annual', NULL, ARRAY['business_conduct', 'anti_corruption', 'incidents']
  ),
  (gen_random_uuid(), 'G1', 'G1-4', 'G1-4.p21',
   'Confirmed incidents of violations of anti-competitive behaviour',
   'Bestaetigte Verstoesse gegen wettbewerbswidriges Verhalten',
   'Number of confirmed incidents involving violations of anti-competitive behaviour regulations.',
   'Anzahl bestaetigter Vorfaelle im Zusammenhang mit Verstoessen gegen Wettbewerbsvorschriften.',
   'quantitative', 'count', false, 'annual', NULL, ARRAY['business_conduct', 'anti_competitive']
  ),
  (gen_random_uuid(), 'G1', 'G1-5', 'G1-5.p27',
   'Political influence and lobbying activities',
   'Politische Einflussnahme und Lobbyaktivitaeten',
   'Description of the activities and commitments related to exerting political influence, including lobbying.',
   'Beschreibung der Aktivitaeten und Verpflichtungen im Zusammenhang mit politischer Einflussnahme, einschliesslich Lobbying.',
   'narrative', NULL, false, 'annual', NULL, ARRAY['business_conduct', 'lobbying', 'political_influence']
  ),
  (gen_random_uuid(), 'G1', 'G1-6', 'G1-6.p30',
   'Payment practices — average payment terms',
   'Zahlungspraktiken — durchschnittliche Zahlungsbedingungen',
   'Average payment terms in number of days and percentage of invoices paid within agreed terms.',
   'Durchschnittliche Zahlungsbedingungen in Tagen und Prozentsatz der innerhalb vereinbarter Fristen bezahlten Rechnungen.',
   'quantitative', 'days', false, 'annual', NULL, ARRAY['business_conduct', 'payment_practices']
  )
ON CONFLICT (datapoint_code) DO NOTHING;
