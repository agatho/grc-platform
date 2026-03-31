-- ============================================================================
-- ARCTOS Seed: EU AI Act (Regulation 2024/1689)
-- Source: Regulation (EU) 2024/1689 — Artificial Intelligence Act
-- Titles I-XII: Prohibited practices, High-risk AI, Transparency, GPAI,
--               Monitoring, Penalties (~60 entries)
-- ============================================================================

-- Create catalog container
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-a1ac70000003',
  'EU AI Act',
  'Regulation (EU) 2024/1689 — European Artificial Intelligence Act. Harmonised rules on artificial intelligence covering prohibited practices, high-risk AI systems, transparency obligations, general-purpose AI models, governance and penalties.',
  'control', 'platform', 'eu_ai_act', '2024/1689', true, '{isms}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Title I: General Provisions (Art. 1-4)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-I', 'General Provisions', 'Title I — Subject matter, scope, definitions and AI literacy (Art. 1-4)', 0, 100, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-I.1', 'Subject matter (Art. 1)', 'Lays down harmonised rules for the placing on the market, putting into service and use of AI systems, prohibitions, requirements for high-risk AI, transparency, GPAI models, and market monitoring.', 1, 101, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-I.2', 'Scope (Art. 2)', 'Applies to providers placing on the market or putting into service AI systems in the Union, deployers established in the Union, and providers/deployers in third countries where output is used in the Union.', 1, 102, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-I.3', 'Definitions (Art. 3)', 'Definitions of AI system, provider, deployer, authorised representative, importer, distributor, operator, placing on the market, putting into service, intended purpose, reasonably foreseeable misuse, and other key terms.', 1, 103, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-I.4', 'AI literacy (Art. 4)', 'Providers and deployers shall take measures to ensure a sufficient level of AI literacy among their staff and other persons dealing with the operation and use of AI systems on their behalf.', 1, 104, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Title II: Prohibited AI Practices (Art. 5)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-II', 'Prohibited AI Practices', 'Title II — AI practices that are prohibited under the AI Act (Art. 5)', 0, 200, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-II.5', 'Prohibited AI practices (Art. 5)', 'Overarching prohibition of certain AI practices that pose an unacceptable risk to fundamental rights, safety and democratic values.', 1, 201, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-II.5a', 'Subliminal manipulation (Art. 5(1)(a))', 'Prohibition of AI systems that deploy subliminal techniques beyond a persons consciousness or purposefully manipulative or deceptive techniques to materially distort behaviour causing significant harm.', 2, 202, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-II.5b', 'Exploitation of vulnerabilities (Art. 5(1)(b))', 'Prohibition of AI systems that exploit vulnerabilities of persons due to age, disability or specific social or economic situation to materially distort behaviour causing significant harm.', 2, 203, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-II.5c', 'Social scoring (Art. 5(1)(c))', 'Prohibition of AI systems for evaluation or classification of natural persons based on social behaviour or personal characteristics leading to detrimental or unfavourable treatment in unrelated contexts or disproportionate to behaviour.', 2, 204, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-II.5d', 'Predictive policing (Art. 5(1)(d))', 'Prohibition of AI systems for making risk assessments of natural persons to predict criminal offences solely based on profiling or personality traits, except when augmenting human assessment based on objective verifiable facts.', 2, 205, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-II.5e', 'Facial recognition scraping (Art. 5(1)(e))', 'Prohibition of AI systems that create or expand facial recognition databases through untargeted scraping of facial images from the internet or CCTV footage.', 2, 206, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-II.5f', 'Emotion inference in workplace and education (Art. 5(1)(f))', 'Prohibition of AI systems to infer emotions of natural persons in the areas of workplace and education institutions, except where intended for medical or safety reasons.', 2, 207, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-II.5g', 'Biometric categorisation (Art. 5(1)(g))', 'Prohibition of AI systems for biometric categorisation to deduce or infer race, political opinions, trade union membership, religious beliefs, sex life or sexual orientation from biometric data.', 2, 208, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-II.5h', 'Real-time remote biometric identification (Art. 5(1)(h))', 'Prohibition of real-time remote biometric identification in publicly accessible spaces for law enforcement, except for targeted search for victims, prevention of imminent threats, or identification of suspects of serious criminal offences.', 2, 209, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Title III: High-Risk AI Systems (Art. 6-49)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III', 'High-Risk AI Systems', 'Title III — Requirements, obligations and conformity for high-risk AI systems (Art. 6-49)', 0, 300, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.6', 'Classification rules for high-risk AI (Art. 6)', 'An AI system is high-risk if it is a product or safety component covered by Union harmonisation legislation in Annex I, or falls within use cases in Annex III, unless it does not pose a significant risk of harm.', 1, 301, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.8', 'Compliance with requirements (Art. 8)', 'High-risk AI systems shall comply with requirements laid down in Chapter 2, taking into account their intended purpose and the generally acknowledged state of the art.', 1, 310, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.9', 'Risk management system (Art. 9)', 'A risk management system shall be established, implemented, documented and maintained as a continuous iterative process throughout the entire lifecycle of the high-risk AI system, including risk identification, estimation and mitigation.', 1, 320, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.9a', 'Risk identification, evaluation and testing (Art. 9(2)-(7))', 'Identification and analysis of foreseeable risks to health, safety or fundamental rights. Residual risks shall be judged acceptable. Testing shall include real-world conditions prior to market placement.', 2, 321, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.10', 'Data and data governance (Art. 10)', 'Training, validation and testing data sets shall meet quality criteria and be subject to data governance practices concerning design choices, data collection, preparation, bias examination and mitigation.', 1, 330, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.11', 'Technical documentation (Art. 11)', 'Technical documentation shall be drawn up before placing on the market, kept up to date, and demonstrate compliance with requirements. Content specified in Annex IV.', 1, 340, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.12', 'Record-keeping (Art. 12)', 'High-risk AI systems shall allow automatic recording of events (logs) over their lifetime, ensuring traceability of system functioning including operation periods, input data matches and human verification.', 1, 350, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.13', 'Transparency and provision of information (Art. 13)', 'Systems shall be sufficiently transparent to enable deployers to interpret output. Instructions for use shall include provider identity, capabilities, intended purpose, accuracy levels and human oversight measures.', 1, 360, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.14', 'Human oversight (Art. 14)', 'High-risk AI systems shall be designed to be effectively overseen by natural persons, enabling them to understand capacities, monitor operation, remain aware of automation bias, and override output.', 1, 370, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.15', 'Accuracy, robustness and cybersecurity (Art. 15)', 'Systems shall achieve appropriate levels of accuracy, robustness and cybersecurity throughout their lifecycle, including resilience against adversarial attacks and data poisoning.', 1, 380, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Title III Chapter 3: Provider and Deployer Obligations (Art. 16-29)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.16', 'Obligations of providers (Art. 16)', 'Providers shall ensure compliance, implement a quality management system, keep documentation and logs, undertake conformity assessment, draw up EU declaration of conformity, and affix CE marking.', 1, 400, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.17', 'Quality management system (Art. 17)', 'Providers shall implement a quality management system covering regulatory compliance strategy, design and development techniques, testing and validation procedures, and resource management.', 1, 410, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.18', 'Documentation and log retention (Art. 18-19)', 'Technical documentation and quality management documentation shall be kept for 10 years. Automatically generated logs shall be kept at least 6 months.', 1, 420, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.20', 'Corrective actions and cooperation (Art. 20-21)', 'Providers finding non-conformity shall take corrective actions including withdrawal or recall. Upon request, providers shall cooperate with and provide information to competent authorities.', 1, 430, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.22', 'Importers, distributors and representatives (Art. 22-25)', 'Third-country providers shall appoint an authorised representative. Importers and distributors shall verify CE marking and documentation. Parties making substantial modifications become providers.', 1, 440, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.26', 'Obligations of deployers (Art. 26)', 'Deployers shall use systems in accordance with instructions, ensure human oversight by trained persons, ensure input data is relevant and representative, and monitor operation.', 1, 450, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.27', 'Fundamental rights impact assessment (Art. 27)', 'Public bodies and certain deployers shall carry out a fundamental rights impact assessment before putting a high-risk AI system into use.', 1, 460, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-III.49', 'Registration obligations (Art. 49)', 'Before placing on the market or putting into service, the provider or authorised representative shall register themselves and the system in the EU database (Art. 71).', 1, 470, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Annex III: High-Risk Use Case Areas
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-AIII', 'Annex III — High-Risk Use Cases', 'High-risk AI use case areas listed in Annex III of the AI Act', 0, 600, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-AIII.1', 'Biometrics (Annex III, 1)', 'Remote biometric identification systems, biometric categorisation by sensitive attributes, and emotion recognition systems.', 1, 601, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-AIII.2', 'Critical infrastructure (Annex III, 2)', 'AI as safety components in management and operation of critical digital infrastructure, road traffic, or supply of water, gas, heating and electricity.', 1, 602, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-AIII.3', 'Education and vocational training (Annex III, 3)', 'AI for determining access or admission, evaluating learning outcomes, assessing education level, and monitoring prohibited behaviour during tests.', 1, 603, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-AIII.4', 'Employment and workers management (Annex III, 4)', 'AI for recruitment, screening, evaluating candidates, and decisions on promotion, termination, task allocation or monitoring of workers.', 1, 604, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-AIII.5', 'Access to essential services (Annex III, 5)', 'AI for evaluating eligibility for public assistance, creditworthiness, risk assessment in life/health insurance, and classifying emergency calls.', 1, 605, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-AIII.6', 'Law enforcement (Annex III, 6)', 'AI for individual risk assessment, polygraphs, evidence reliability evaluation, profiling in criminal investigations, and crime analytics.', 1, 606, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-AIII.7', 'Migration, asylum and border control (Annex III, 7)', 'AI for assessment of irregular migration risks, security/health risks of persons seeking entry, and examination of asylum or visa applications.', 1, 607, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-AIII.8', 'Justice and democratic processes (Annex III, 8)', 'AI for assisting judicial authorities in researching and interpreting facts and law, and for influencing elections, referendums or voting behaviour.', 1, 608, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Title IV: Transparency Obligations (Art. 50)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-IV', 'Transparency Obligations', 'Title IV — Transparency obligations for providers and deployers of certain AI systems (Art. 50)', 0, 700, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-IV.50', 'Transparency obligations (Art. 50)', 'Transparency requirements for AI systems interacting with natural persons, generating synthetic content, or performing emotion recognition or biometric categorisation.', 1, 701, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-IV.50a', 'AI-human interaction disclosure (Art. 50(1))', 'Providers shall ensure natural persons are informed they are interacting with an AI system, unless obvious from circumstances.', 2, 702, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-IV.50b', 'Synthetic content marking (Art. 50(2))', 'Providers of AI systems generating synthetic audio, image, video or text shall ensure outputs are marked in a machine-readable format and detectable as artificially generated.', 2, 703, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-IV.50c', 'Deepfake and emotion recognition disclosure (Art. 50(3)-(4))', 'Deployers of deepfake-generating AI systems shall disclose artificial generation. Deployers of emotion recognition or biometric categorisation systems shall inform exposed persons and comply with data protection law.', 2, 704, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Title V: General-Purpose AI Models (Art. 51-56)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-V', 'General-Purpose AI Models', 'Title V — General-purpose AI models including those with systemic risk (Art. 51-56)', 0, 800, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-V.51', 'Classification of GPAI models (Art. 51)', 'A GPAI model is classified with systemic risk if it has high impact capabilities or the Commission determines so based on criteria in Annex XIII.', 1, 801, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-V.53', 'Obligations for GPAI model providers (Art. 53)', 'Providers shall maintain technical documentation, make information available to downstream providers, implement a copyright compliance policy, and publish a training data summary.', 1, 810, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-V.53a', 'Technical documentation and copyright (Art. 53(1)(a),(c))', 'GPAI providers shall maintain technical documentation per Annex XI, and put in place a copyright compliance policy including opt-out reservations under Directive (EU) 2019/790.', 2, 811, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-V.55', 'GPAI models with systemic risk (Art. 55)', 'Providers of systemic-risk GPAI models shall perform model evaluation, assess and mitigate systemic risks, track and report serious incidents, and ensure adequate cybersecurity.', 1, 820, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-V.55a', 'Model evaluation and systemic risk mitigation (Art. 55(1)(a)-(b))', 'Standardised model evaluation including adversarial testing, and assessment and mitigation of possible systemic risks at Union level.', 2, 821, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-V.56', 'Codes of practice (Art. 56)', 'The AI Office shall facilitate the drawing up of codes of practice at Union level covering obligations for GPAI model providers.', 1, 830, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Title VIII: Monitoring and Enforcement (Art. 72-78)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-VIII', 'Monitoring and Enforcement', 'Title VIII — Post-market monitoring, information sharing and market surveillance (Art. 72-78)', 0, 900, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-VIII.72', 'Post-market monitoring (Art. 72)', 'Providers shall establish a post-market monitoring system to actively and systematically collect, document and analyse data on performance throughout the AI system lifetime.', 1, 901, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-VIII.73', 'Reporting of serious incidents (Art. 73)', 'Providers shall report serious incidents to market surveillance authorities. Initial report within 15 days of awareness, or 2 days for death/serious harm. Intermediate and final reports to follow.', 1, 910, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-VIII.74', 'Market surveillance and authorities (Art. 74-78)', 'National market surveillance and fundamental rights authorities shall have powers to enforce the regulation, access data/documentation/source code, and request explanations from deployers. Confidentiality of trade secrets applies.', 1, 920, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Title XII: Penalties (Art. 99)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-XII', 'Penalties', 'Title XII — Penalties for non-compliance with the AI Act (Art. 99)', 0, 1000, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-XII.99', 'Penalties (Art. 99)', 'Member States shall lay down rules on penalties and take all measures necessary to ensure proper and effective implementation.', 1, 1001, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-XII.99a', 'Prohibited practices penalties (Art. 99(3))', 'Non-compliance with Art. 5 on prohibited AI practices: fines up to EUR 35 million or 7% of worldwide annual turnover, whichever is higher.', 2, 1002, 'active'),
('c0000000-0000-0000-0000-a1ac70000003', 'AIA-XII.99b', 'Other non-compliance penalties (Art. 99(4)-(5))', 'Non-compliance with high-risk or operator obligations: fines up to EUR 15 million or 3% turnover. Incorrect information to authorities: up to EUR 7.5 million or 1% turnover.', 2, 1003, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
