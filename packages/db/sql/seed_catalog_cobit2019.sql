-- ============================================================================
-- ARCTOS Seed: COBIT 2019 Governance & Management Objectives
-- Source: ISACA COBIT 2019 Framework
-- 5 Domains → 40 Governance/Management Objectives
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-c0b17000000a',
  'COBIT 2019',
  'COBIT 2019 — Governance and Management Objectives for Enterprise IT. 5 domains with 40 objectives.',
  'control', 'platform', 'cobit_2019', '2019', true, '{ics,audit}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Domain: EDM — Evaluate, Direct and Monitor (Governance)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c0b17000000a', 'EDM', 'Evaluate, Direct and Monitor', 'Governance domain ensuring that stakeholder needs, conditions, and options are evaluated; direction is set through prioritization and decision-making; and performance and compliance are monitored.', 0, 100, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'EDM01', 'Ensured Governance Framework Setting and Maintenance', 'Analyze and articulate the requirements for the governance of enterprise IT. Put in place and maintain the governance enablers.', 1, 101, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'EDM02', 'Ensured Benefits Delivery', 'Optimize the value contribution to the business from the business processes, IT services, and IT assets resulting from investment made by IT at an acceptable cost.', 1, 102, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'EDM03', 'Ensured Risk Optimization', 'Ensure that the enterprise risk appetite and tolerance are understood, articulated, and communicated, and that risk to enterprise value related to IT use is identified and managed.', 1, 103, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'EDM04', 'Ensured Resource Optimization', 'Ensure that adequate and sufficient IT-related resources (people, process, and technology) are available to support enterprise objectives effectively at optimal cost.', 1, 104, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'EDM05', 'Ensured Stakeholder Engagement', 'Ensure that enterprise IT performance and conformance measurement and reporting are transparent, with stakeholders approving the goals, metrics, and necessary remedial actions.', 1, 105, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Domain: APO — Align, Plan and Organize (Management)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c0b17000000a', 'APO', 'Align, Plan and Organize', 'Management domain addressing the overall organization, strategy, and supporting activities for IT.', 0, 200, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO01', 'Managed I&T Management Framework', 'Clarify and maintain the governance and management of enterprise IT. Implement and maintain mechanisms and authorities to manage information and use of IT in the enterprise.', 1, 201, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO02', 'Managed Strategy', 'Provide a holistic view of the current business and IT environment, the future direction, and the initiatives required to migrate to the desired future environment.', 1, 202, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO03', 'Managed Enterprise Architecture', 'Establish a common architecture consisting of business process, information, data, application, and technology architecture layers for effectively and efficiently realizing enterprise and IT strategies.', 1, 203, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO04', 'Managed Innovation', 'Achieve competitive advantage, business innovation, and improved operational effectiveness and efficiency by exploiting IT developments.', 1, 204, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO05', 'Managed Portfolio', 'Execute the strategic direction set for investments in line with the enterprise architecture vision and the desired characteristics of the investment and related services portfolio.', 1, 205, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO06', 'Managed Budget and Costs', 'Manage the IT-related financial activities in both the business and IT functions, covering budget, cost, and benefits management, and prioritization of spending through the use of formal budgeting practices.', 1, 206, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO07', 'Managed Human Resources', 'Provide a structured approach to ensure optimal structuring, placement, decision rights, and skills of human resources.', 1, 207, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO08', 'Managed Relationships', 'Manage the relationship between the business and IT in a formalized and transparent way that ensures a focus on achieving a common and shared goal of successful enterprise outcomes.', 1, 208, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO09', 'Managed Service Agreements', 'Align IT-enabled services and service levels with enterprise needs and expectations, including identification, specification, design, publishing, agreement, and monitoring of IT services and service levels.', 1, 209, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO10', 'Managed Vendors', 'Manage IT-related services provided by all types of vendors to meet enterprise requirements, including the selection of vendors, management of relationships, management of contracts, and reviewing and monitoring of vendor performance.', 1, 210, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO11', 'Managed Quality', 'Define and communicate quality requirements in all processes, procedures, and the related enterprise outcomes. Monitor, collect, and analyze quality metrics to continuously improve quality.', 1, 211, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO12', 'Managed Risk', 'Continually identify, assess, and reduce IT-related risk within tolerance levels set by enterprise management.', 1, 212, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO13', 'Managed Security', 'Define, operate, and monitor an information security management system.', 1, 213, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'APO14', 'Managed Data', 'Achieve and sustain effective management of the critical data assets required to achieve enterprise objectives.', 1, 214, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Domain: BAI — Build, Acquire and Implement (Management)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c0b17000000a', 'BAI', 'Build, Acquire and Implement', 'Management domain addressing the definition, acquisition, and implementation of IT solutions and their integration into business processes.', 0, 300, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'BAI01', 'Managed Programs', 'Manage all programs from the investment portfolio in alignment with enterprise strategy and in a coordinated way based on the standard program management approach.', 1, 301, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'BAI02', 'Managed Requirements Definition', 'Identify solutions and analyze requirements before acquisition or creation to ensure that they are in line with enterprise strategic requirements covering business processes, applications, information, and technology architecture.', 1, 302, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'BAI03', 'Managed Solutions Identification and Build', 'Establish and maintain identified solutions in line with enterprise requirements covering design, development, procurement, and partnering with suppliers or vendors.', 1, 303, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'BAI04', 'Managed Availability and Capacity', 'Balance current and future needs for availability, performance, and capacity with cost-effective service provision.', 1, 304, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'BAI05', 'Managed Organizational Change', 'Maximize the likelihood of successfully implementing sustainable organizational change quickly and with reduced risk, covering the complete life cycle of the change and all affected stakeholders.', 1, 305, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'BAI06', 'Managed IT Changes', 'Manage all changes in a controlled manner, including standard changes and emergency maintenance relating to business processes, applications, and infrastructure.', 1, 306, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'BAI07', 'Managed IT Change Acceptance and Transitioning', 'Formally accept and make operational new solutions, including implementation planning, system and data conversion, acceptance testing, communication, release preparation, promotion to production, early production support, and a post-implementation review.', 1, 307, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'BAI08', 'Managed Knowledge', 'Maintain the availability of relevant, current, validated, and reliable knowledge to support all process activities and to facilitate decision-making.', 1, 308, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'BAI09', 'Managed Assets', 'Manage IT assets through their life cycle to make sure that their use delivers value at optimal cost, they remain operational, they are accounted for and physically protected, and assets that are critical to support service capability are reliable and available.', 1, 309, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'BAI10', 'Managed Configuration', 'Define and maintain descriptions and relationships between key resources and capabilities required to deliver IT-enabled services, including collecting configuration information, establishing baselines, verifying and auditing configuration information, and updating the configuration repository.', 1, 310, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'BAI11', 'Managed Projects', 'Manage all projects initiated in the enterprise in alignment with enterprise strategy and in a coordinated way based on the standard project management approach.', 1, 311, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Domain: DSS — Deliver, Service and Support (Management)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c0b17000000a', 'DSS', 'Deliver, Service and Support', 'Management domain addressing the operational delivery and support of IT services, including security.', 0, 400, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'DSS01', 'Managed Operations', 'Coordinate and execute the activities and operational procedures required to deliver internal and outsourced IT services, including the execution of predefined standard operating procedures and the required monitoring activities.', 1, 401, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'DSS02', 'Managed Service Requests and Incidents', 'Provide timely and effective response to user requests and resolution of all types of incidents. Restore normal service, record and fulfill user requests, and record, investigate, diagnose, escalate, and resolve incidents.', 1, 402, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'DSS03', 'Managed Problems', 'Identify and classify problems and their root causes. Provide timely resolution to prevent recurring incidents. Provide recommendations for improvements.', 1, 403, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'DSS04', 'Managed Continuity', 'Establish and maintain a plan to enable the business and IT to respond to incidents and disruptions in order to continue operation of critical business processes and required IT services and maintain availability of information at a level acceptable to the enterprise.', 1, 404, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'DSS05', 'Managed Security Services', 'Protect enterprise information to maintain the level of information security risk acceptable to the enterprise in accordance with the security policy. Establish and maintain information security roles and access privileges and perform security monitoring.', 1, 405, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'DSS06', 'Managed Business Process Controls', 'Define and maintain appropriate business process controls to ensure that information related to and processed by in-house or outsourced business processes satisfies all relevant information control requirements.', 1, 406, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Domain: MEA — Monitor, Evaluate and Assess (Management)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c0b17000000a', 'MEA', 'Monitor, Evaluate and Assess', 'Management domain addressing performance monitoring, conformance evaluation, and assurance activities.', 0, 500, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'MEA01', 'Managed Performance and Conformance Monitoring', 'Collect, validate, and evaluate business, IT, and process goals and metrics. Monitor that processes are performing against agreed-on performance and conformance goals and metrics, and provide reporting that is systematic and timely.', 1, 501, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'MEA02', 'Managed System of Internal Control', 'Continuously monitor and evaluate the control environment, including self-assessments and independent assurance reviews. Enable management to identify control deficiencies and inefficiencies and to initiate improvement actions.', 1, 502, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'MEA03', 'Managed Compliance with External Requirements', 'Evaluate that IT processes and IT-supported business processes are compliant with laws, regulations, and contractual requirements. Obtain assurance that the requirements have been identified and complied with.', 1, 503, 'active'),
('c0000000-0000-0000-0000-c0b17000000a', 'MEA04', 'Managed Assurance', 'Enable the organization to design and develop efficient and effective assurance initiatives by providing guidance on planning, scoping, executing, and following up on assurance reviews, using a roadmap aligned with the assurance approach.', 1, 504, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
