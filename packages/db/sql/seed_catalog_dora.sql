-- ============================================================================
-- ARCTOS Seed: EU DORA (Regulation 2022/2554)
-- Source: Regulation (EU) 2022/2554 — Digital Operational Resilience Act
-- 5 Pillars: ICT Risk Management, Incident Management, Resilience Testing,
--            Third-Party Risk, Information Sharing (~55 entries)
-- ============================================================================

-- Create catalog container
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-d02a00000004',
  'EU DORA',
  'Regulation (EU) 2022/2554 — Digital Operational Resilience Act. Harmonised requirements for ICT risk management, incident reporting, resilience testing, third-party risk management and information sharing for financial entities.',
  'control', 'platform', 'eu_dora', '2022/2554', true, '{isms,bcms,tprm}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Chapter I: General Provisions (Art. 1-4)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-d02a00000004', 'DORA-I', 'General Provisions', 'Chapter I — Subject matter, scope, definitions and principle of proportionality (Art. 1-4)', 0, 100, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-I.1', 'Subject matter (Art. 1)', 'Lays down uniform requirements for the security of network and information systems supporting business processes of financial entities, including ICT risk management, incident reporting, resilience testing and third-party risk management.', 1, 101, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-I.2', 'Scope (Art. 2)', 'Applies to credit institutions, payment institutions, investment firms, insurance undertakings, crypto-asset service providers, central securities depositories, trade repositories, and other financial entities.', 1, 102, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-I.3', 'Definitions (Art. 3)', 'Definitions including digital operational resilience, ICT risk, ICT system, network and information system, ICT third-party service provider, ICT-related incident, and critical or important function.', 1, 103, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-I.4', 'Principle of proportionality (Art. 4)', 'Financial entities shall implement ICT risk management frameworks proportionate to their size, nature, scale and complexity of services, activities and operations, and their overall risk profile.', 1, 104, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter II: ICT Risk Management (Art. 5-16)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II', 'ICT Risk Management', 'Chapter II — ICT risk management framework, governance, identification, protection, detection, response and recovery (Art. 5-16)', 0, 200, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.5', 'Governance and organisation (Art. 5)', 'The management body shall define, approve, oversee and be responsible for the ICT risk management framework, set roles and responsibilities, define risk tolerance, and approve the ICT business continuity policy.', 1, 201, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.5a', 'ICT risk management training (Art. 5(4))', 'Members of the management body shall maintain sufficient knowledge and skills to understand and assess ICT risk, including by following specific training on a regular basis.', 2, 202, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.6', 'ICT risk management framework (Art. 6)', 'Financial entities shall have a sound, comprehensive and well-documented ICT risk management framework, including strategies, policies, procedures, protocols and tools. Annual review and audit required.', 1, 210, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.6a', 'ICT risk management function (Art. 6(4))', 'Responsibility for managing and overseeing ICT risk shall be assigned to a control function with sufficient independence. The three lines of defence model, or equivalent, applies.', 2, 211, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.7', 'ICT systems, protocols and tools (Art. 7)', 'Financial entities shall use and maintain updated ICT systems, protocols and tools appropriate to the magnitude of operations and adequate to support critical and important functions.', 1, 220, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.8', 'Identification (Art. 8)', 'Financial entities shall identify, classify and document all ICT-supported business functions, assets and resources, including those provided by third-party providers, and perform risk assessments at least annually.', 1, 230, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.8a', 'ICT asset inventory (Art. 8(1))', 'Financial entities shall identify and document all ICT assets, classify them by criticality, and map configuration dependencies including with ICT third-party service providers.', 2, 231, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.9', 'Protection and prevention (Art. 9)', 'Financial entities shall have ICT security policies, procedures, protocols and tools to ensure resilience, continuity and availability of ICT systems, including network segmentation and strong authentication.', 1, 240, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.9a', 'Access management and authentication (Art. 9(4))', 'Financial entities shall implement strong authentication mechanisms based on relevant standards, dedicated control systems, and protection measures for cryptographic keys.', 2, 241, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.10', 'Detection (Art. 10)', 'Financial entities shall have mechanisms to promptly detect anomalous activities, ICT network performance issues and ICT-related incidents, with multiple layers of control and defined alert thresholds.', 1, 250, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.11', 'Response and recovery (Art. 11)', 'Financial entities shall put in place a comprehensive ICT business continuity policy with response and recovery plans covering scenarios of severe disruption, defining RTO and RPO for each critical function.', 1, 260, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.12', 'Backup policies and procedures (Art. 12)', 'Financial entities shall maintain and periodically test backup and restoration policies. Restoration shall not jeopardise security, integrity of systems or confidentiality of data.', 1, 265, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.13', 'Learning and evolving (Art. 13)', 'Financial entities shall gather information on vulnerabilities, cyber threats and incidents, analyse their impact and derive lessons learned. Post-incident reviews shall be conducted after major disruptions.', 1, 270, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.14', 'Communication (Art. 14)', 'Financial entities shall have communication plans for responsible disclosure of ICT-related incidents or major vulnerabilities to clients, counterparts, the public and relevant authorities.', 1, 280, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-II.16', 'Simplified ICT risk management framework (Art. 16)', 'Certain small and non-interconnected entities may apply a simplified ICT risk management framework, maintaining a proportionate but sound and documented approach.', 1, 290, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter III: ICT-Related Incident Management (Art. 17-23)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-d02a00000004', 'DORA-III', 'ICT-Related Incident Management', 'Chapter III — ICT-related incident classification, management, reporting and notification (Art. 17-23)', 0, 300, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-III.17', 'Incident management process (Art. 17)', 'Financial entities shall define, establish and implement an ICT-related incident management process to detect, manage and notify incidents, including early warning indicators, categorisation and role allocation.', 1, 301, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-III.18', 'Classification of ICT-related incidents (Art. 18)', 'Financial entities shall classify incidents based on number of clients affected, duration, geographical spread, data losses, criticality of services affected, and economic impact.', 1, 310, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-III.19', 'Reporting of major incidents (Art. 19)', 'Financial entities shall report major ICT-related incidents to competent authorities using initial, intermediate and final reports within prescribed timelines.', 1, 320, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-III.19a', 'Notification timelines (Art. 19(4))', 'Initial notification within 4 hours of classification as major incident and no later than 24 hours from detection. Intermediate report within 72 hours. Final report within 1 month including root cause analysis.', 2, 321, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-III.20', 'Harmonisation of reporting (Art. 20)', 'The ESAs shall develop common regulatory technical standards for the content, timelines and templates for reporting of major ICT-related incidents and significant cyber threats.', 1, 330, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-III.21', 'Centralisation of reporting (Art. 21)', 'The ESAs shall assess feasibility of centralising incident reporting through a single EU Hub for major ICT-related incident reporting.', 1, 340, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-III.22', 'Supervisory feedback (Art. 22)', 'The competent authority shall provide feedback or guidance to the financial entity following the initial report, in particular where the incident has a systemic dimension.', 1, 350, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-III.23', 'Voluntary notification of cyber threats (Art. 23)', 'Financial entities may voluntarily notify competent authorities of significant cyber threats when considered relevant to the financial system, service users or clients.', 1, 360, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter IV: Digital Operational Resilience Testing (Art. 24-27)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-d02a00000004', 'DORA-IV', 'Digital Operational Resilience Testing', 'Chapter IV — Digital operational resilience testing programme, tools and TLPT (Art. 24-27)', 0, 400, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-IV.24', 'General requirements for testing (Art. 24)', 'Financial entities shall establish, maintain and review a sound and comprehensive digital operational resilience testing programme as an integral part of the ICT risk management framework.', 1, 401, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-IV.25', 'Testing of ICT tools and systems (Art. 25)', 'Testing shall include vulnerability assessments, network security assessments, scenario-based tests, performance testing, end-to-end testing, penetration testing and source code reviews where feasible.', 1, 410, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-IV.26', 'Threat-led penetration testing — TLPT (Art. 26)', 'Financial entities identified by competent authorities shall carry out TLPT at least every 3 years, covering critical or important functions on live production systems, following the TIBER-EU framework.', 1, 420, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-IV.26a', 'Pooled testing (Art. 26(4))', 'Where an ICT third-party service provider is in TLPT scope, the financial entity shall ensure the providers participation. Pooled testing of common services may be permitted.', 2, 421, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-IV.27', 'Requirements for testers (Art. 27)', 'TLPT shall be undertaken by testers of the highest suitability and reputability, with appropriate technical and organisational capabilities, certifications and professional indemnity insurance.', 1, 430, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter V: Managing ICT Third-Party Risk (Art. 28-44)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V', 'Managing ICT Third-Party Risk', 'Chapter V — Key principles, contractual provisions, oversight of critical providers and exit strategies (Art. 28-44)', 0, 500, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V.28', 'General principles (Art. 28)', 'Financial entities shall manage ICT third-party risk as an integral component of ICT risk within their framework and maintain a register of all contractual arrangements with ICT third-party providers.', 1, 501, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V.28a', 'Register of information (Art. 28(3))', 'Financial entities shall maintain and update a register of all contractual arrangements for ICT services, distinguishing those covering critical or important functions.', 2, 502, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V.28b', 'Strategy on ICT third-party risk (Art. 28(2))', 'Financial entities shall adopt and regularly review a strategy on ICT third-party risk, including a policy on the use of ICT services supporting critical or important functions.', 2, 503, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V.29', 'Preliminary assessment and concentration risk (Art. 29)', 'Prior to entering a contractual arrangement, financial entities shall identify and assess all relevant risks including whether the arrangement may lead to ICT concentration risk.', 1, 510, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V.30', 'Key contractual provisions (Art. 30)', 'Contracts shall include descriptions of functions, data processing locations, provisions on availability/authenticity/integrity/confidentiality, service levels, and notice periods.', 1, 520, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V.30a', 'Contractual provisions for critical functions (Art. 30(3))', 'For critical functions, contracts shall additionally include full SLA descriptions with quantitative and qualitative performance targets, reporting obligations, and access/inspection/audit rights.', 2, 521, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V.30b', 'Exit strategies (Art. 30(3)(f))', 'Contracts for critical functions shall include exit strategies with adequate transition periods, business continuity provisions during transition, and migration assistance.', 2, 522, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V.29b', 'Sub-outsourcing (Art. 29(2))', 'Financial entities shall assess whether sub-outsourcing of critical functions would impair supervision, and consider risks of long or complex chains of sub-outsourcing.', 1, 530, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V.28c', 'Monitoring of third-party arrangements (Art. 28(5)-(6))', 'Financial entities shall continuously monitor third-party provider performance through defined reporting, periodic audits and inspections, and timely response to identified issues.', 1, 540, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V.31', 'Designation of critical ICT providers (Art. 31)', 'The ESAs shall designate critical ICT third-party providers based on systemic impact of failure, degree of substitutability, and number of dependent financial entities.', 1, 550, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V.33', 'Oversight framework for critical providers (Art. 33)', 'The Lead Overseer shall assess whether each critical provider has comprehensive rules, procedures, mechanisms and arrangements to manage ICT risk posed to financial entities.', 1, 560, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-V.35', 'Powers of the Lead Overseer (Art. 35)', 'The Lead Overseer may request information, conduct investigations and on-site inspections, issue recommendations addressing ICT risks, and request remediation plans.', 1, 570, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter VI: Information-Sharing Arrangements (Art. 45)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-d02a00000004', 'DORA-VI', 'Information-Sharing Arrangements', 'Chapter VI — Information sharing on cyber threats and intelligence (Art. 45)', 0, 600, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-VI.45', 'Information-sharing arrangements (Art. 45)', 'Financial entities may exchange cyber threat information and intelligence, including indicators of compromise, tactics, techniques and procedures, cybersecurity alerts and configuration tools.', 1, 601, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-VI.45a', 'Information-sharing conditions (Art. 45(2))', 'Information sharing shall take place within trusted communities, be protected through confidentiality arrangements, and respect competition law. Entities shall notify competent authorities of participation.', 2, 602, 'active'),
('c0000000-0000-0000-0000-d02a00000004', 'DORA-VI.45b', 'Data protection in information sharing (Art. 45(4))', 'Information sharing shall comply with applicable data protection rules including GDPR, and include measures to protect commercially sensitive information.', 2, 603, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
