-- Sprint 67: GRC Copilot Enterprise Chat
-- Migration 967: Seed default prompt templates

INSERT INTO copilot_prompt_template (key, name, description, system_prompt, user_prompt_template, category, module_key, variables) VALUES
('risk_summary', 'Risk Summary', 'Summarize risk register for an organization', 'You are a GRC expert assistant. Provide concise, actionable risk summaries.', 'Provide a summary of the top risks for this organization. Focus on: {{focus_area}}', 'risk', 'erm', '[{"name":"focus_area","type":"string","required":false,"description":"Area to focus on"}]'),
('control_gap', 'Control Gap Analysis', 'Identify gaps in control coverage', 'You are a controls expert. Analyze control coverage and identify gaps.', 'Analyze control coverage for framework {{framework}} and identify gaps.', 'control', 'ics', '[{"name":"framework","type":"string","required":true,"description":"Framework to analyze"}]'),
('compliance_status', 'Compliance Status', 'Current compliance posture overview', 'You are a compliance officer assistant. Provide accurate compliance status reports.', 'What is the current compliance status for {{framework}}?', 'compliance', NULL, '[{"name":"framework","type":"string","required":true,"description":"Framework name"}]'),
('incident_analysis', 'Incident Analysis', 'Analyze security incidents', 'You are an incident response expert. Analyze incidents and suggest response actions.', 'Analyze recent incidents and provide recommendations.', 'general', 'isms', '[]'),
('audit_prep', 'Audit Preparation', 'Prepare for upcoming audits', 'You are an audit preparation assistant. Help organizations prepare for audits.', 'Help prepare for the upcoming {{audit_type}} audit.', 'general', 'audit', '[{"name":"audit_type","type":"string","required":true,"description":"Type of audit"}]')
ON CONFLICT DO NOTHING;
