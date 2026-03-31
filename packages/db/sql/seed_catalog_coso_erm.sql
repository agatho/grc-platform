-- ============================================================================
-- ARCTOS Seed: COSO Enterprise Risk Management Framework (2017)
-- Source: Committee of Sponsoring Organizations of the Treadway Commission
-- 5 Components → 20 Principles
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-c050e2300009',
  'COSO ERM Framework',
  'COSO Enterprise Risk Management — Integrating with Strategy and Performance (2017). 5 components with 20 principles.',
  'control', 'platform', 'coso_erm_2017', '2017', true, '{erm,ics}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Component 1: Governance & Culture (Principles 1–5)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c050e2300009', 'COSO-GC', 'Governance & Culture', 'Governance sets the organizations tone, reinforcing the importance of and establishing oversight responsibilities for enterprise risk management. Culture pertains to ethical values, desired behaviors, and understanding of risk.', 0, 100, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-GC-01', 'Exercises Board Risk Oversight', 'The board of directors provides oversight of the strategy and carries out governance responsibilities to support management in achieving strategy and business objectives.', 1, 101, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-GC-02', 'Establishes Operating Structures', 'The organization establishes operating structures in the pursuit of strategy and business objectives.', 1, 102, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-GC-03', 'Defines Desired Culture', 'The organization defines the desired behaviors that characterize the entitys desired culture.', 1, 103, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-GC-04', 'Demonstrates Commitment to Core Values', 'The organization demonstrates a commitment to the entitys core values.', 1, 104, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-GC-05', 'Attracts, Develops, and Retains Capable Individuals', 'The organization is committed to building human capital in alignment with the strategy and business objectives.', 1, 105, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Component 2: Strategy & Objective-Setting (Principles 6–9)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c050e2300009', 'COSO-SO', 'Strategy & Objective-Setting', 'Enterprise risk management is integrated into the organizations strategic plan. Business objectives are the basis for identifying, assessing, and responding to risk.', 0, 200, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-SO-06', 'Analyzes Business Context', 'The organization considers potential effects of business context on risk profile.', 1, 201, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-SO-07', 'Defines Risk Appetite', 'The organization defines risk appetite in the context of creating, preserving, and realizing value.', 1, 202, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-SO-08', 'Evaluates Alternative Strategies', 'The organization evaluates alternative strategies and the potential impact on the risk profile.', 1, 203, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-SO-09', 'Formulates Business Objectives', 'The organization considers risk while establishing business objectives at various levels that align and support the strategy.', 1, 204, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Component 3: Performance (Principles 10–14)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c050e2300009', 'COSO-PF', 'Performance', 'Risks that may impact the achievement of strategy and business objectives need to be identified and assessed. Risks are prioritized by severity in the context of risk appetite.', 0, 300, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-PF-10', 'Identifies Risk', 'The organization identifies risk that impacts the performance of strategy and business objectives.', 1, 301, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-PF-11', 'Assesses Severity of Risk', 'The organization assesses the severity of risk.', 1, 302, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-PF-12', 'Prioritizes Risks', 'The organization prioritizes risks as a basis for selecting responses to risks.', 1, 303, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-PF-13', 'Implements Risk Responses', 'The organization identifies and selects risk responses.', 1, 304, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-PF-14', 'Develops Portfolio View', 'The organization develops and evaluates a portfolio view of risk.', 1, 305, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Component 4: Review & Revision (Principles 15–17)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c050e2300009', 'COSO-RR', 'Review & Revision', 'By reviewing entity performance, an organization can consider how well the enterprise risk management components are functioning over time and in light of substantial changes.', 0, 400, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-RR-15', 'Assesses Substantial Change', 'The organization identifies and assesses changes that may substantially affect strategy and business objectives.', 1, 401, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-RR-16', 'Reviews Risk and Performance', 'The organization reviews entity performance and considers risk.', 1, 402, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-RR-17', 'Pursues Improvement in ERM', 'The organization pursues improvement of enterprise risk management.', 1, 403, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Component 5: Information, Communication & Reporting (Principles 18–20)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c050e2300009', 'COSO-IC', 'Information, Communication & Reporting', 'Enterprise risk management requires a continual process of obtaining and sharing necessary information, from both internal and external sources, which flows up, down, and across the organization.', 0, 500, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-IC-18', 'Leverages Information and Technology', 'The organization leverages the entitys information and technology systems to support enterprise risk management.', 1, 501, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-IC-19', 'Communicates Risk Information', 'The organization uses communication channels to support enterprise risk management.', 1, 502, 'active'),
('c0000000-0000-0000-0000-c050e2300009', 'COSO-IC-20', 'Reports on Risk, Culture, and Performance', 'The organization reports on risk, culture, and performance at multiple levels and across the entity.', 1, 503, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
