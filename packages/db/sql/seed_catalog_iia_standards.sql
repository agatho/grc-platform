-- ============================================================================
-- ARCTOS Seed: IIA Global Internal Audit Standards 2024
-- Source: The Institute of Internal Auditors (IIA)
-- 5 Domains + Topical Requirements → Standards
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-11a000000000',
  'IIA Global Internal Audit Standards 2024',
  'Global Internal Audit Standards (GIAS) 2024 — 5 domains with 23 standards plus topical requirements for the professional practice of internal auditing.',
  'reference', 'platform', 'iia_standards_2024', '2024', true, '{audit}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Domain I: Purpose of Internal Auditing (Standards 1.1–1.3)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-11a000000000', 'DOM-I', 'Domain I — Purpose of Internal Auditing', 'Internal auditing strengthens the organizations ability to create, protect, and sustain value by providing the board and management with independent, risk-based, and objective assurance, advice, and insight.', 0, 100, 'active'),
('c0000000-0000-0000-0000-11a000000000', '1.1', 'Internal Audit Mandate', 'The internal audit function must have a mandate that is formally defined in a charter, approved by the board, and communicated throughout the organization.', 1, 101, 'active'),
('c0000000-0000-0000-0000-11a000000000', '1.2', 'Ethics and Professionalism — Purpose Domain', 'Internal auditors must demonstrate integrity and professional behavior in their work as it relates to the purpose of internal auditing.', 1, 102, 'active'),
('c0000000-0000-0000-0000-11a000000000', '1.3', 'Authority and Responsibility for Internal Auditing', 'The internal audit function must have sufficient authority and responsibility to fulfill its mandate, as defined in the charter.', 1, 103, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Domain II: Ethics and Professionalism (Standards 2.1–2.5)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-11a000000000', 'DOM-II', 'Domain II — Ethics and Professionalism', 'Internal auditors must behave ethically and apply due professional care to maintain trust and credibility.', 0, 200, 'active'),
('c0000000-0000-0000-0000-11a000000000', '2.1', 'Integrity', 'Internal auditors must demonstrate integrity in their work by being honest, diligent, and responsible to build trust and provide the basis for reliance on their judgment.', 1, 201, 'active'),
('c0000000-0000-0000-0000-11a000000000', '2.2', 'Objectivity', 'Internal auditors must maintain an unbiased mental attitude and avoid conflicts of interest that would impair their ability to perform their responsibilities impartially.', 1, 202, 'active'),
('c0000000-0000-0000-0000-11a000000000', '2.3', 'Competency', 'Internal auditors must possess and apply the knowledge, skills, and abilities needed to fulfill their individual and collective responsibilities.', 1, 203, 'active'),
('c0000000-0000-0000-0000-11a000000000', '2.4', 'Due Professional Care', 'Internal auditors must apply the care and skill expected of a reasonably prudent and competent internal auditor performing similar engagements.', 1, 204, 'active'),
('c0000000-0000-0000-0000-11a000000000', '2.5', 'Continuing Professional Development', 'Internal auditors must enhance their knowledge, skills, and other competencies through continuing professional development.', 1, 205, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Domain III: Governing the Internal Audit Function (Standards 3.1–3.4)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-11a000000000', 'DOM-III', 'Domain III — Governing the Internal Audit Function', 'The board establishes and protects the internal audit functions role through oversight, independence, and adequate resources.', 0, 300, 'active'),
('c0000000-0000-0000-0000-11a000000000', '3.1', 'Board Oversight of Internal Auditing', 'The board must oversee the internal audit function to ensure it operates effectively and fulfills its mandate.', 1, 301, 'active'),
('c0000000-0000-0000-0000-11a000000000', '3.2', 'Independence of the Internal Audit Function', 'The board must establish and protect the independence of the internal audit function by ensuring it is free from conditions that threaten its ability to carry out responsibilities in an unbiased manner.', 1, 302, 'active'),
('c0000000-0000-0000-0000-11a000000000', '3.3', 'Qualified Chief Audit Executive', 'The chief audit executive must be qualified and suitable for the role with the necessary competencies, experience, and professional certifications.', 1, 303, 'active'),
('c0000000-0000-0000-0000-11a000000000', '3.4', 'Resources for the Internal Audit Function', 'The chief audit executive must ensure the internal audit function has sufficient and appropriate resources to fulfill its mandate.', 1, 304, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Domain IV: Managing the Internal Audit Function (Standards 4.1–4.5)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-11a000000000', 'DOM-IV', 'Domain IV — Managing the Internal Audit Function', 'The chief audit executive must manage the internal audit function effectively to ensure it adds value to the organization.', 0, 400, 'active'),
('c0000000-0000-0000-0000-11a000000000', '4.1', 'Strategic Internal Audit Plan', 'The chief audit executive must develop and maintain a strategic internal audit plan that is aligned with the organizations priorities and risk profile.', 1, 401, 'active'),
('c0000000-0000-0000-0000-11a000000000', '4.2', 'Risk-Based Internal Audit Plan', 'The chief audit executive must develop a risk-based internal audit plan that determines the priorities of the internal audit function and is consistent with the organizations goals.', 1, 402, 'active'),
('c0000000-0000-0000-0000-11a000000000', '4.3', 'Resource Management', 'The chief audit executive must manage the human, technological, and financial resources of the internal audit function effectively.', 1, 403, 'active'),
('c0000000-0000-0000-0000-11a000000000', '4.4', 'Quality Assurance and Improvement Program', 'The chief audit executive must develop and maintain a quality assurance and improvement program that covers all aspects of the internal audit function.', 1, 404, 'active'),
('c0000000-0000-0000-0000-11a000000000', '4.5', 'Communication with the Board and Senior Management', 'The chief audit executive must communicate the internal audit functions plans, resource requirements, and results to the board and senior management.', 1, 405, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Domain V: Performing Internal Audit Services (Standards 5.1–5.6)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-11a000000000', 'DOM-V', 'Domain V — Performing Internal Audit Services', 'Internal auditors must plan, perform, and communicate results of assurance and advisory engagements effectively.', 0, 500, 'active'),
('c0000000-0000-0000-0000-11a000000000', '5.1', 'Planning Engagements', 'Internal auditors must develop and document a plan for each engagement to ensure the engagement achieves its objectives.', 1, 501, 'active'),
('c0000000-0000-0000-0000-11a000000000', '5.2', 'Performing Engagement Work', 'Internal auditors must identify, analyze, evaluate, and document sufficient information to achieve the engagement objectives.', 1, 502, 'active'),
('c0000000-0000-0000-0000-11a000000000', '5.3', 'Communicating Engagement Results', 'Internal auditors must communicate the results of engagements in a timely, accurate, objective, clear, concise, and constructive manner.', 1, 503, 'active'),
('c0000000-0000-0000-0000-11a000000000', '5.4', 'Monitoring Engagement Outcomes', 'The chief audit executive must establish a follow-up process to monitor the disposition of results communicated to management and the board.', 1, 504, 'active'),
('c0000000-0000-0000-0000-11a000000000', '5.5', 'Communicating Acceptance of Risks', 'When the chief audit executive concludes that management has accepted a level of risk that may be unacceptable to the organization, the matter must be discussed with senior management and may need to be communicated to the board.', 1, 505, 'active'),
('c0000000-0000-0000-0000-11a000000000', '5.6', 'Using the Work of Other Providers', 'Internal auditors may use the work of other internal and external assurance and consulting service providers. The chief audit executive must evaluate the competency, objectivity, and due professional care of the providers.', 1, 506, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Topical Requirements (Standards 11.1–11.5)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-11a000000000', 'TR', 'Topical Requirements', 'Topical requirements provide additional guidance for specific subject matters that internal auditors may encounter during engagements.', 0, 600, 'active'),
('c0000000-0000-0000-0000-11a000000000', '11.1', 'Information Security', 'Requirements and considerations for internal audit engagements relating to information security governance, risk management, and controls.', 1, 601, 'active'),
('c0000000-0000-0000-0000-11a000000000', '11.2', 'Information Technology', 'Requirements and considerations for internal audit engagements relating to IT governance, general controls, application controls, and emerging technologies.', 1, 602, 'active'),
('c0000000-0000-0000-0000-11a000000000', '11.3', 'Business Continuity', 'Requirements and considerations for internal audit engagements relating to business continuity planning, disaster recovery, and organizational resilience.', 1, 603, 'active'),
('c0000000-0000-0000-0000-11a000000000', '11.4', 'Privacy', 'Requirements and considerations for internal audit engagements relating to data privacy, protection of personal information, and regulatory compliance.', 1, 604, 'active'),
('c0000000-0000-0000-0000-11a000000000', '11.5', 'Fraud', 'Requirements and considerations for internal audit engagements relating to fraud risk assessment, detection, investigation, and prevention.', 1, 605, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
