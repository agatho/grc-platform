-- ============================================================================
-- ARCTOS Seed: ISO 22301:2019 Business Continuity Management System
-- Source: ISO 22301:2019 Security and resilience — BCMS — Requirements
-- Structure: Clauses (Level 0) -> Requirements (Level 1)
-- Target Modules: bcms
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-223010000000',
  'ISO 22301:2019',
  'Security and resilience — Business continuity management systems — Requirements. Clauses 4 through 10 specifying requirements for implementing, maintaining and improving a BCMS.',
  'control', 'platform', 'iso_22301_2019', '2019', true, '{bcms}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Clause 4: Context of the organization
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-223010000000', '4', 'Context of the organization', 'Understanding the organization, its context, needs of interested parties, scope and BCMS', 0, 400, 'active'),
('c0000000-0000-0000-0000-223010000000', '4.1', 'Understanding the organization and its context', 'Determine external and internal issues relevant to the organization''s purpose and that affect its ability to achieve the intended outcomes of its BCMS', 1, 401, 'active'),
('c0000000-0000-0000-0000-223010000000', '4.2', 'Understanding the needs and expectations of interested parties', 'Determine interested parties relevant to the BCMS and their requirements, including applicable legal and regulatory requirements', 1, 402, 'active'),
('c0000000-0000-0000-0000-223010000000', '4.3', 'Determining the scope of the BCMS', 'Determine the boundaries and applicability of the BCMS considering internal and external issues, requirements of interested parties, and the organization''s products and services', 1, 403, 'active'),
('c0000000-0000-0000-0000-223010000000', '4.4', 'Business continuity management system', 'Establish, implement, maintain and continually improve a BCMS including the processes needed and their interactions', 1, 404, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Clause 5: Leadership
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-223010000000', '5', 'Leadership', 'Leadership commitment, policy, and organizational roles, responsibilities and authorities', 0, 500, 'active'),
('c0000000-0000-0000-0000-223010000000', '5.1', 'Leadership and commitment', 'Top management shall demonstrate leadership and commitment with respect to the BCMS by ensuring policy and objectives are established, resources are available, and the BCMS achieves its intended outcomes', 1, 501, 'active'),
('c0000000-0000-0000-0000-223010000000', '5.2', 'Policy', 'Top management shall establish a business continuity policy that is appropriate, provides a framework for objectives, includes a commitment to satisfy applicable requirements and to continual improvement', 1, 502, 'active'),
('c0000000-0000-0000-0000-223010000000', '5.3', 'Organizational roles, responsibilities and authorities', 'Top management shall ensure responsibilities and authorities for relevant roles are assigned and communicated within the organization', 1, 503, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Clause 6: Planning
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-223010000000', '6', 'Planning', 'Actions to address risks and opportunities, BC objectives and planning to achieve them', 0, 600, 'active'),
('c0000000-0000-0000-0000-223010000000', '6.1', 'Actions to address risks and opportunities', 'Determine risks and opportunities that need to be addressed to ensure the BCMS can achieve its intended outcomes, prevent or reduce undesired effects, and achieve continual improvement', 1, 601, 'active'),
('c0000000-0000-0000-0000-223010000000', '6.2', 'Business continuity objectives and plans to achieve them', 'Establish BC objectives at relevant functions and levels that are consistent with the BC policy, measurable, monitored, communicated and updated as appropriate', 1, 602, 'active'),
('c0000000-0000-0000-0000-223010000000', '6.3', 'Planning of changes', 'When the organization determines the need for changes to the BCMS, the changes shall be carried out in a planned and systematic manner', 1, 603, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Clause 7: Support
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-223010000000', '7', 'Support', 'Resources, competence, awareness, communication and documented information', 0, 700, 'active'),
('c0000000-0000-0000-0000-223010000000', '7.1', 'Resources', 'Determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the BCMS', 1, 701, 'active'),
('c0000000-0000-0000-0000-223010000000', '7.2', 'Competence', 'Determine the necessary competence of persons doing work that affects BC performance and ensure these persons are competent on the basis of education, training or experience', 1, 702, 'active'),
('c0000000-0000-0000-0000-223010000000', '7.3', 'Awareness', 'Persons doing work under the organization''s control shall be aware of the BC policy, their contribution to the BCMS effectiveness, and the implications of not conforming', 1, 703, 'active'),
('c0000000-0000-0000-0000-223010000000', '7.4', 'Communication', 'Determine the need for internal and external communications relevant to the BCMS including what, when, with whom, and how to communicate', 1, 704, 'active'),
('c0000000-0000-0000-0000-223010000000', '7.5', 'Documented information', 'The BCMS shall include documented information required by the standard and determined by the organization as necessary for the effectiveness of the BCMS', 1, 705, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Clause 8: Operation
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-223010000000', '8', 'Operation', 'Operational planning and control, BIA, risk assessment, BC strategies, BC plans and exercise programme', 0, 800, 'active'),
('c0000000-0000-0000-0000-223010000000', '8.1', 'Operational planning and control', 'Plan, implement and control the processes needed to meet requirements and implement the actions determined in planning, including management of planned changes and review of unintended changes', 1, 801, 'active'),
('c0000000-0000-0000-0000-223010000000', '8.2', 'Business impact analysis and risk assessment', 'Implement and maintain a formal documented process for BIA and risk assessment that establishes the context, assesses business impacts of disruptions, and evaluates risks of disruption', 1, 802, 'active'),
('c0000000-0000-0000-0000-223010000000', '8.3', 'Business continuity strategies and solutions', 'Identify and select BC strategies and solutions based on the outputs of the BIA and risk assessment to protect prioritized activities, stabilize and resume operations, and limit impact', 1, 803, 'active'),
('c0000000-0000-0000-0000-223010000000', '8.4', 'Business continuity plans and procedures', 'Establish, implement and maintain BC plans and procedures to manage disruptive incidents, continue activities based on recovery objectives identified in the BIA, and restore operations', 1, 804, 'active'),
('c0000000-0000-0000-0000-223010000000', '8.5', 'Exercise programme', 'Implement and maintain an exercise programme that validates the consistency of BC strategies and solutions with BC objectives, is based on appropriate scenarios, and produces post-exercise reports', 1, 805, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Clause 9: Performance evaluation
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-223010000000', '9', 'Performance evaluation', 'Monitoring, measurement, analysis, evaluation, internal audit and management review', 0, 900, 'active'),
('c0000000-0000-0000-0000-223010000000', '9.1', 'Monitoring, measurement, analysis and evaluation', 'Determine what needs to be monitored and measured, the methods for monitoring and measurement, when monitoring and measuring shall be performed, and when results shall be analysed and evaluated', 1, 901, 'active'),
('c0000000-0000-0000-0000-223010000000', '9.2', 'Internal audit', 'Conduct internal audits at planned intervals to provide information on whether the BCMS conforms to the organization''s own requirements and the requirements of the standard, and is effectively implemented and maintained', 1, 902, 'active'),
('c0000000-0000-0000-0000-223010000000', '9.3', 'Management review', 'Top management shall review the BCMS at planned intervals to ensure its continuing suitability, adequacy and effectiveness, considering status of actions, changes in external and internal issues, and BC performance', 1, 903, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Clause 10: Improvement
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-223010000000', '10', 'Improvement', 'Nonconformity, corrective action and continual improvement', 0, 1000, 'active'),
('c0000000-0000-0000-0000-223010000000', '10.1', 'Nonconformity and corrective action', 'When a nonconformity occurs, react to it, evaluate the need for action to eliminate causes, implement needed actions, review effectiveness of corrective actions, and make changes to the BCMS if necessary', 1, 1001, 'active'),
('c0000000-0000-0000-0000-223010000000', '10.2', 'Continual improvement', 'Continually improve the suitability, adequacy and effectiveness of the BCMS through the use of the BC policy, objectives, audit results, analysis of monitored events, corrective actions and management review', 1, 1002, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
