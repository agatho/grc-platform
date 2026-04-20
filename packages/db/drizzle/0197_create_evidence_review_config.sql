-- Sprint 68: AI Evidence Review Agent
-- Migration 972: Add evidence review agent configuration defaults

-- Insert agent type for evidence review into agent_registration defaults
-- This allows the Sprint 35 agent framework to manage evidence review scheduling
INSERT INTO copilot_prompt_template (key, name, description, system_prompt, user_prompt_template, category, module_key, variables) VALUES
('evidence_review_classify', 'Evidence Classification', 'Classify evidence against control requirements', 'You are an evidence review expert. Classify evidence artifacts against control requirements. Assess completeness, freshness, and quality. Provide confidence scores 0-100.', 'Review the following evidence artifact:\nTitle: {{artifact_name}}\nContent: {{content}}\nControl Requirements: {{requirements}}\n\nClassify as: compliant, partially_compliant, non_compliant, or inconclusive.', 'control', 'ics', '[{"name":"artifact_name","type":"string","required":true},{"name":"content","type":"string","required":true},{"name":"requirements","type":"string","required":true}]'),
('evidence_review_gap', 'Evidence Gap Analysis', 'Identify gaps in evidence coverage', 'You are a compliance evidence expert. Identify missing, outdated, or incomplete evidence.', 'Analyze evidence coverage for the following controls:\n{{controls}}\n\nIdentify gaps and suggest remediation.', 'control', 'ics', '[{"name":"controls","type":"string","required":true}]')
ON CONFLICT DO NOTHING;
