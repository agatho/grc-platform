-- Sprint 16: Seed Playbook Templates (267-270)
-- 5 pre-built playbook templates with phases and tasks
-- These are org-scoped and will be inserted per-org during onboarding
-- For development: insert for the first org found

-- ──────────────────────────────────────────────────────────────
-- Helper: Use first organization for seeding
-- ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_org_id uuid;
  v_admin_id uuid;

  -- Template IDs
  v_ransomware_id uuid := gen_random_uuid();
  v_breach_id uuid := gen_random_uuid();
  v_ddos_id uuid := gen_random_uuid();
  v_insider_id uuid := gen_random_uuid();
  v_supply_id uuid := gen_random_uuid();

  -- Phase IDs (Ransomware)
  v_rw_p1 uuid := gen_random_uuid();
  v_rw_p2 uuid := gen_random_uuid();
  v_rw_p3 uuid := gen_random_uuid();
  v_rw_p4 uuid := gen_random_uuid();

  -- Phase IDs (Data Breach)
  v_db_p1 uuid := gen_random_uuid();
  v_db_p2 uuid := gen_random_uuid();
  v_db_p3 uuid := gen_random_uuid();
  v_db_p4 uuid := gen_random_uuid();
  v_db_p5 uuid := gen_random_uuid();

  -- Phase IDs (DDoS)
  v_dd_p1 uuid := gen_random_uuid();
  v_dd_p2 uuid := gen_random_uuid();
  v_dd_p3 uuid := gen_random_uuid();

  -- Phase IDs (Insider)
  v_in_p1 uuid := gen_random_uuid();
  v_in_p2 uuid := gen_random_uuid();
  v_in_p3 uuid := gen_random_uuid();
  v_in_p4 uuid := gen_random_uuid();

  -- Phase IDs (Supply Chain)
  v_sc_p1 uuid := gen_random_uuid();
  v_sc_p2 uuid := gen_random_uuid();
  v_sc_p3 uuid := gen_random_uuid();
  v_sc_p4 uuid := gen_random_uuid();

BEGIN
  SELECT id INTO v_org_id FROM organization LIMIT 1;
  SELECT id INTO v_admin_id FROM "user" LIMIT 1;

  IF v_org_id IS NULL OR v_admin_id IS NULL THEN
    RAISE NOTICE 'No organization or user found, skipping playbook seed';
    RETURN;
  END IF;

  -- ════════════════════════════════════════════════════════════
  -- 1. RANSOMWARE PLAYBOOK (4 phases, 25 tasks)
  -- ════════════════════════════════════════════════════════════

  INSERT INTO playbook_template (id, org_id, name, description, trigger_category, trigger_min_severity, is_active, estimated_duration_hours, created_by)
  VALUES (v_ransomware_id, v_org_id, 'Ransomware Response Playbook',
    'Comprehensive incident response plan for ransomware attacks. Covers containment, eradication, recovery, and lessons learned phases aligned with NIST SP 800-61 and BSI guidelines.',
    'ransomware', 'significant', true, 168, v_admin_id);

  -- Phase 1: Containment (0-4h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_rw_p1, v_ransomware_id, 'Containment', 'Immediately isolate affected systems and prevent further spread of ransomware.', 1, 4, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_rw_p1, 'Isolate affected systems from network', 'Disconnect affected systems from the network immediately. Do NOT power off systems.', 'it_lead', 1, true, 1, '["Disconnect network cables","Disable WiFi adapters","Block at firewall level","Document isolated systems"]'),
  (v_rw_p1, 'Activate incident response team', 'Contact all IRT members and establish communication channel.', 'ciso', 1, true, 2, '["Send IRT activation alert","Open dedicated communication channel","Confirm team availability"]'),
  (v_rw_p1, 'Preserve forensic evidence', 'Create memory dumps and disk images before any remediation.', 'it_lead', 2, true, 3, '["Capture memory dump","Create disk image","Secure log files","Document chain of custody"]'),
  (v_rw_p1, 'Identify ransomware variant', 'Analyze ransom note, file extensions, and behavior indicators.', 'it_lead', 3, false, 4, '["Collect ransom note samples","Check file extension patterns","Search known variant databases","Document IOCs"]'),
  (v_rw_p1, 'Assess scope of infection', 'Determine which systems, data, and business processes are affected.', 'it_lead', 3, true, 5, '["Scan network for IOCs","Check backup system integrity","Map affected business processes","Estimate data impact"]'),
  (v_rw_p1, 'Block C2 communication channels', 'Identify and block command-and-control server communications.', 'it_lead', 2, false, 6, '["Identify C2 IP addresses","Block at firewall","Update DNS blacklist","Monitor for new C2 attempts"]'),
  (v_rw_p1, 'Notify management and stakeholders', 'Brief executive management on situation, impact, and response plan.', 'communications', 2, false, 7, '["Prepare situation briefing","Brief executive team","Document decisions made"]');

  -- Phase 2: Eradication (4-48h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_rw_p2, v_ransomware_id, 'Eradication', 'Remove ransomware from all affected systems and close attack vectors.', 2, 48, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_rw_p2, 'Identify initial attack vector', 'Determine how the ransomware entered the environment.', 'it_lead', 12, true, 1, '["Analyze email logs","Check VPN logs","Review RDP access","Examine browser history"]'),
  (v_rw_p2, 'Remove malware from all systems', 'Clean or rebuild all infected systems systematically.', 'it_lead', 24, true, 2, '["Run anti-malware scans","Rebuild compromised systems","Verify clean state"]'),
  (v_rw_p2, 'Reset all compromised credentials', 'Force password reset for all potentially compromised accounts.', 'it_lead', 12, true, 3, '["Reset domain admin passwords","Reset service account credentials","Reset VPN credentials","Enable MFA where missing"]'),
  (v_rw_p2, 'Patch vulnerability used for entry', 'Apply security patches to close the exploited vulnerability.', 'it_lead', 24, false, 4, '["Identify specific CVE","Test patch","Deploy patch","Verify remediation"]'),
  (v_rw_p2, 'Notify CERT/BSI if required', 'Report to national CERT within required timeline (NIS2: 24h early warning).', 'ciso', 24, true, 5, '["Prepare CERT notification","Submit early warning (24h)","Submit incident notification (72h)"]'),
  (v_rw_p2, 'Notify supervisory authority if personal data affected', 'GDPR Art. 33: Notify DPA within 72 hours if personal data is involved.', 'dpo', 48, true, 6, '["Assess personal data impact","Prepare DPA notification form","Submit to supervisory authority"]'),
  (v_rw_p2, 'Update firewall and IDS/IPS rules', 'Implement detection rules for the specific ransomware variant.', 'it_lead', 24, false, 7, '["Create YARA rules","Update IDS signatures","Deploy to all sensors"]');

  -- Phase 3: Recovery (48-120h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_rw_p3, v_ransomware_id, 'Recovery', 'Restore systems and data from clean backups and resume operations.', 3, 120, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_rw_p3, 'Verify backup integrity', 'Confirm that backups are clean and not corrupted by ransomware.', 'it_lead', 60, true, 1, '["Scan backup media","Test restore in isolated environment","Verify data integrity"]'),
  (v_rw_p3, 'Restore critical systems from backup', 'Prioritize restoration of business-critical systems.', 'it_lead', 72, true, 2, '["Restore in priority order","Verify system functionality","Run integration tests"]'),
  (v_rw_p3, 'Restore remaining systems', 'Complete restoration of all affected systems.', 'it_lead', 96, false, 3, '["Continue restoration","Verify each system","Document any data loss"]'),
  (v_rw_p3, 'Implement enhanced monitoring', 'Deploy additional monitoring to detect any residual threats.', 'it_lead', 72, false, 4, '["Deploy EDR agents","Enable enhanced logging","Set up alert rules"]'),
  (v_rw_p3, 'Communicate with affected data subjects', 'If personal data breach: notify affected individuals per GDPR Art. 34.', 'dpo', 96, false, 5, '["Identify affected individuals","Prepare notification letter","Send notifications","Document notifications"]'),
  (v_rw_p3, 'Verify business process resumption', 'Confirm all business processes are functioning correctly.', 'process_owner', 120, true, 6, '["Test each critical process","Verify data accuracy","Get business sign-off"]');

  -- Phase 4: Lessons Learned (120-168h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_rw_p4, v_ransomware_id, 'Lessons Learned', 'Conduct post-incident review and implement improvements.', 4, 168, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_rw_p4, 'Conduct post-incident review meeting', 'Gather all stakeholders for a thorough incident review.', 'ciso', 144, true, 1, '["Schedule review meeting","Prepare incident timeline","Document findings"]'),
  (v_rw_p4, 'Document incident report', 'Create comprehensive incident report with timeline, impact, and recommendations.', 'ciso', 160, true, 2, '["Write executive summary","Detail technical analysis","List recommendations","Get management approval"]'),
  (v_rw_p4, 'Update incident response procedures', 'Incorporate lessons learned into IR procedures and playbooks.', 'risk_manager', 168, false, 3, '["Identify procedure gaps","Update playbooks","Review escalation paths"]'),
  (v_rw_p4, 'Plan security improvements', 'Create action plan for security enhancements identified during incident.', 'ciso', 168, false, 4, '["Prioritize improvements","Estimate budget","Assign owners","Set deadlines"]'),
  (v_rw_p4, 'Schedule follow-up security assessment', 'Plan a focused security assessment to verify improvements.', 'risk_manager', 168, false, 5, '["Define assessment scope","Schedule date","Assign assessors"]');

  -- ════════════════════════════════════════════════════════════
  -- 2. DATA BREACH PLAYBOOK (5 phases, 20 tasks)
  -- ════════════════════════════════════════════════════════════

  INSERT INTO playbook_template (id, org_id, name, description, trigger_category, trigger_min_severity, is_active, estimated_duration_hours, created_by)
  VALUES (v_breach_id, v_org_id, 'Data Breach Response Playbook',
    'Response plan for data breaches involving personal data. Covers GDPR Art. 33/34 notification obligations, 72-hour DPA deadline, and affected individual notification.',
    'data_breach', 'significant', true, 336, v_admin_id);

  -- Phase 1: Detection & Assessment (0-4h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_db_p1, v_breach_id, 'Detection & Assessment', 'Identify the breach scope and assess the risk to data subjects.', 1, 4, 'dpo', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_db_p1, 'Confirm and classify the data breach', 'Verify the breach and determine the type of personal data involved.', 'dpo', 2, true, 1, '["Confirm breach occurrence","Identify data categories affected","Determine number of records","Classify breach severity"]'),
  (v_db_p1, 'Identify affected data subjects', 'Determine which individuals are impacted by the breach.', 'dpo', 3, true, 2, '["Query affected databases","Estimate number of individuals","Identify vulnerable groups","Document findings"]'),
  (v_db_p1, 'Assess risk to individuals', 'Evaluate the likelihood and severity of risk to data subjects rights.', 'dpo', 4, true, 3, '["Assess data sensitivity","Evaluate exposure duration","Consider mitigation factors","Document risk assessment"]'),
  (v_db_p1, 'Activate breach response team', 'Convene the data breach response team including DPO, IT, Legal, and Communications.', 'ciso', 1, true, 4, '["Notify all team members","Establish secure communication","Brief on situation"]');

  -- Phase 2: Containment (4-12h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_db_p2, v_breach_id, 'Containment', 'Stop the breach and prevent further data exposure.', 2, 12, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_db_p2, 'Stop ongoing data exfiltration', 'Take immediate action to prevent further data loss.', 'it_lead', 6, true, 1, '["Block data transfer channels","Revoke compromised access","Isolate affected systems"]'),
  (v_db_p2, 'Secure evidence and audit trails', 'Preserve all evidence for investigation and potential legal proceedings.', 'it_lead', 8, false, 2, '["Preserve access logs","Secure audit trails","Create forensic copies","Document chain of custody"]'),
  (v_db_p2, 'Assess third-party involvement', 'Determine if processors or sub-processors are affected.', 'dpo', 10, false, 3, '["Check processor contracts","Notify affected processors","Request breach details from processors"]'),
  (v_db_p2, 'Document breach for Art. 33 notification', 'Begin preparing the supervisory authority notification.', 'dpo', 12, true, 4, '["Complete breach documentation form","Record timeline of events","Prepare technical details"]');

  -- Phase 3: Authority Notification - 72h (12-72h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_db_p3, v_breach_id, 'Authority Notification (72h)', 'Notify supervisory authority within 72 hours per GDPR Art. 33.', 3, 72, 'dpo', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_db_p3, 'Submit DPA notification (GDPR Art. 33)', 'File breach notification with competent supervisory authority within 72 hours.', 'dpo', 68, true, 1, '["Complete notification form","Review with legal","Submit to DPA","Confirm receipt"]'),
  (v_db_p3, 'Prepare internal incident report', 'Document the breach comprehensively for internal records.', 'dpo', 72, false, 2, '["Write detailed report","Include technical findings","Document decisions made","Archive securely"]'),
  (v_db_p3, 'Coordinate with legal counsel', 'Assess legal implications and prepare for potential claims.', 'legal', 48, false, 3, '["Brief external counsel if needed","Assess liability exposure","Review insurance coverage"]'),
  (v_db_p3, 'Notify affected third-party controllers', 'If acting as processor, notify affected controllers without undue delay.', 'dpo', 48, false, 4, '["Identify affected controllers","Send breach notifications","Document all notifications"]');

  -- Phase 4: Individual Notification (72-168h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_db_p4, v_breach_id, 'Individual Notification', 'Notify affected data subjects per GDPR Art. 34 if high risk.', 4, 168, 'dpo', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_db_p4, 'Prepare individual notification content', 'Draft clear, plain-language notification for affected data subjects.', 'communications', 96, true, 1, '["Describe breach nature","List data categories affected","Describe mitigation measures","Provide DPO contact details"]'),
  (v_db_p4, 'Send notifications to affected individuals', 'Deliver breach notifications through appropriate channels.', 'communications', 144, true, 2, '["Send email notifications","Send postal notifications if needed","Update FAQ on website","Set up dedicated helpline"]'),
  (v_db_p4, 'Offer mitigation measures to individuals', 'Provide credit monitoring or other protective services if appropriate.', 'dpo', 168, false, 3, '["Evaluate need for credit monitoring","Set up monitoring service","Communicate to affected individuals"]'),
  (v_db_p4, 'Handle data subject inquiries', 'Manage incoming questions and complaints from affected individuals.', 'communications', 168, false, 4, '["Set up inquiry tracking","Train support staff","Prepare FAQ document","Monitor inquiry volume"]');

  -- Phase 5: Remediation (168-336h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_db_p5, v_breach_id, 'Remediation', 'Implement corrective measures and document lessons learned.', 5, 336, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_db_p5, 'Implement security improvements', 'Deploy technical and organizational measures to prevent recurrence.', 'it_lead', 240, true, 1, '["Implement identified fixes","Enhance access controls","Deploy additional monitoring"]'),
  (v_db_p5, 'Update data protection impact assessments', 'Revise DPIAs for affected processing activities.', 'dpo', 288, false, 2, '["Review existing DPIAs","Update risk assessments","Document new measures"]'),
  (v_db_p5, 'Conduct post-breach review', 'Hold lessons learned session and update procedures.', 'ciso', 336, true, 3, '["Schedule review meeting","Prepare analysis report","Update IR procedures","Communicate improvements"]'),
  (v_db_p5, 'Submit supplementary DPA notification if needed', 'Provide additional information to DPA as investigation concludes.', 'dpo', 336, false, 4, '["Review initial notification","Prepare supplementary details","Submit to DPA"]');

  -- ════════════════════════════════════════════════════════════
  -- 3. DDOS PLAYBOOK (3 phases, 12 tasks)
  -- ════════════════════════════════════════════════════════════

  INSERT INTO playbook_template (id, org_id, name, description, trigger_category, trigger_min_severity, is_active, estimated_duration_hours, created_by)
  VALUES (v_ddos_id, v_org_id, 'DDoS Response Playbook',
    'Response plan for distributed denial-of-service attacks. Covers mitigation, analysis, and infrastructure hardening.',
    'ddos', 'significant', true, 72, v_admin_id);

  -- Phase 1: Mitigate (0-4h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_dd_p1, v_ddos_id, 'Mitigate', 'Activate DDoS mitigation and restore service availability.', 1, 4, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_dd_p1, 'Activate DDoS mitigation service', 'Enable cloud-based or on-premise DDoS protection.', 'it_lead', 1, true, 1, '["Activate scrubbing center","Redirect traffic through CDN","Enable rate limiting"]'),
  (v_dd_p1, 'Identify attack type and vectors', 'Classify the DDoS attack (volumetric, protocol, application layer).', 'it_lead', 2, true, 2, '["Analyze traffic patterns","Identify source IPs/ranges","Determine attack protocol"]'),
  (v_dd_p1, 'Implement emergency traffic filtering', 'Apply targeted filtering rules to block attack traffic.', 'it_lead', 2, true, 3, '["Create IP blacklists","Apply geo-blocking if needed","Configure WAF rules"]'),
  (v_dd_p1, 'Notify ISP and hosting provider', 'Coordinate with upstream providers for additional mitigation.', 'it_lead', 3, false, 4, '["Contact ISP abuse team","Request upstream filtering","Coordinate mitigation efforts"]'),
  (v_dd_p1, 'Communicate service disruption internally', 'Inform stakeholders about the attack and expected resolution.', 'communications', 2, false, 5, '["Send internal notification","Update status page","Brief management"]');

  -- Phase 2: Analyze (4-24h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_dd_p2, v_ddos_id, 'Analyze', 'Detailed analysis of the attack and assessment of collateral damage.', 2, 24, 'it_lead', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_dd_p2, 'Conduct detailed traffic analysis', 'Perform forensic analysis of attack traffic and patterns.', 'it_lead', 12, true, 1, '["Capture traffic samples","Analyze attack signatures","Create IOC list"]'),
  (v_dd_p2, 'Assess collateral damage', 'Determine if the DDoS was cover for another attack (data exfiltration).', 'it_lead', 18, true, 2, '["Check for unauthorized access","Review data transfer logs","Scan for malware"]'),
  (v_dd_p2, 'Report to NIS2 authority if applicable', 'Submit incident notification if service falls under NIS2 scope.', 'ciso', 24, false, 3, '["Determine NIS2 applicability","Prepare notification","Submit within required timeline"]');

  -- Phase 3: Harden (24-72h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_dd_p3, v_ddos_id, 'Harden', 'Implement long-term improvements to DDoS resilience.', 3, 72, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_dd_p3, 'Review and enhance DDoS protection', 'Evaluate current DDoS mitigation capabilities and enhance.', 'it_lead', 48, true, 1, '["Review mitigation SLA","Evaluate additional protection","Implement improvements"]'),
  (v_dd_p3, 'Update network architecture resilience', 'Improve network redundancy and failover capabilities.', 'it_lead', 60, false, 2, '["Review network topology","Add redundant paths","Test failover scenarios"]'),
  (v_dd_p3, 'Document incident and update runbooks', 'Create detailed incident report and update response procedures.', 'ciso', 72, true, 3, '["Write incident report","Update DDoS runbook","Brief team on improvements"]'),
  (v_dd_p3, 'Conduct DDoS resilience exercise', 'Plan and schedule a simulated DDoS exercise to test improvements.', 'it_lead', 72, false, 4, '["Define exercise scope","Schedule exercise","Prepare test scenarios"]');

  -- ════════════════════════════════════════════════════════════
  -- 4. INSIDER THREAT PLAYBOOK (4 phases, 15 tasks)
  -- ════════════════════════════════════════════════════════════

  INSERT INTO playbook_template (id, org_id, name, description, trigger_category, trigger_min_severity, is_active, estimated_duration_hours, created_by)
  VALUES (v_insider_id, v_org_id, 'Insider Threat Response Playbook',
    'Response plan for suspected insider threats including data theft, sabotage, or unauthorized access by employees or contractors.',
    'insider', 'significant', true, 240, v_admin_id);

  -- Phase 1: Detection & Triage (0-8h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_in_p1, v_insider_id, 'Detection & Triage', 'Confirm insider threat indicators and assess the situation.', 1, 8, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_in_p1, 'Validate insider threat indicators', 'Review alerts and evidence to confirm suspected insider activity.', 'ciso', 4, true, 1, '["Review DLP alerts","Check access logs","Analyze behavior patterns","Validate against false positive"]'),
  (v_in_p1, 'Assess scope and potential impact', 'Determine which systems, data, and processes may be affected.', 'it_lead', 6, true, 2, '["Map accessed systems","Identify data at risk","Assess business impact"]'),
  (v_in_p1, 'Engage HR and Legal', 'Involve HR and Legal counsel for employment and legal considerations.', 'hr', 4, true, 3, '["Brief HR on situation","Consult employment law","Review contractual obligations"]'),
  (v_in_p1, 'Establish need-to-know investigation team', 'Form a confidential investigation team with limited disclosure.', 'ciso', 2, true, 4, '["Select team members","Establish secure communication","Brief on confidentiality"]');

  -- Phase 2: Investigation (8-48h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_in_p2, v_insider_id, 'Investigation', 'Conduct thorough investigation while maintaining confidentiality.', 2, 48, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_in_p2, 'Collect and preserve digital evidence', 'Gather forensic evidence from all relevant systems and devices.', 'it_lead', 24, true, 1, '["Image relevant devices","Collect email records","Extract access logs","Preserve evidence securely"]'),
  (v_in_p2, 'Review access and activity logs', 'Analyze detailed logs of the suspects activities.', 'it_lead', 36, true, 2, '["Review VPN logs","Check file access history","Analyze email patterns","Review USB/external media use"]'),
  (v_in_p2, 'Interview relevant personnel', 'Conduct interviews with witnesses and related staff as appropriate.', 'hr', 48, false, 3, '["Prepare interview questions","Conduct interviews","Document statements"]'),
  (v_in_p2, 'Assess data exfiltration extent', 'Determine if and how much data was exfiltrated.', 'it_lead', 36, true, 4, '["Check DLP logs","Review cloud storage access","Analyze network transfers","Quantify data loss"]');

  -- Phase 3: Containment & Response (48-120h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_in_p3, v_insider_id, 'Containment & Response', 'Take action to contain the threat and protect assets.', 3, 120, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_in_p3, 'Revoke or restrict access', 'Modify access rights for the suspected insider.', 'it_lead', 56, true, 1, '["Disable accounts","Revoke VPN access","Block badge access","Change shared credentials"]'),
  (v_in_p3, 'Take HR disciplinary action', 'Execute appropriate HR procedures based on investigation findings.', 'hr', 96, true, 2, '["Review investigation findings","Consult with legal","Execute HR procedures","Document all actions"]'),
  (v_in_p3, 'Notify supervisory authority if data breach', 'If personal data is involved, notify DPA per GDPR.', 'dpo', 120, false, 3, '["Assess personal data impact","Prepare notification if needed","Submit to DPA"]'),
  (v_in_p3, 'Recover or secure exfiltrated data', 'Attempt to recover data and prevent further distribution.', 'it_lead', 120, false, 4, '["Contact data recipients","Issue takedown notices","Recover company devices"]');

  -- Phase 4: Legal & Lessons Learned (120-240h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_in_p4, v_insider_id, 'Legal & Lessons Learned', 'Pursue legal action if warranted and implement preventive measures.', 4, 240, 'legal', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_in_p4, 'File criminal complaint if warranted', 'Work with legal to determine if criminal prosecution is appropriate.', 'legal', 168, false, 1, '["Review evidence with counsel","Prepare criminal complaint","File with authorities"]'),
  (v_in_p4, 'Review and enhance insider threat controls', 'Implement technical and procedural improvements.', 'ciso', 200, true, 2, '["Review DLP policies","Enhance monitoring","Update access review procedures","Implement behavioral analytics"]'),
  (v_in_p4, 'Conduct lessons learned review', 'Document findings and update insider threat program.', 'ciso', 240, true, 3, '["Hold review meeting","Document improvements","Update security awareness training"]');

  -- ════════════════════════════════════════════════════════════
  -- 5. SUPPLY CHAIN COMPROMISE PLAYBOOK (4 phases, 18 tasks)
  -- ════════════════════════════════════════════════════════════

  INSERT INTO playbook_template (id, org_id, name, description, trigger_category, trigger_min_severity, is_active, estimated_duration_hours, created_by)
  VALUES (v_supply_id, v_org_id, 'Supply Chain Compromise Response Playbook',
    'Response plan for supply chain attacks including compromised software, hardware, or service providers. Covers vendor assessment, containment, and alternate sourcing.',
    'supply_chain', 'emergency', true, 336, v_admin_id);

  -- Phase 1: Assessment (0-12h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_sc_p1, v_supply_id, 'Assessment', 'Assess the scope of the supply chain compromise.', 1, 12, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_sc_p1, 'Identify compromised vendor/component', 'Determine which vendor, software, or hardware component is compromised.', 'it_lead', 4, true, 1, '["Review threat intelligence","Identify affected component","Verify compromise indicators"]'),
  (v_sc_p1, 'Map dependencies on affected component', 'Identify all systems and processes that depend on the compromised component.', 'it_lead', 8, true, 2, '["Review asset inventory","Map software dependencies","Identify affected business processes"]'),
  (v_sc_p1, 'Assess impact to organization', 'Determine the potential impact if the compromise affects operations.', 'risk_manager', 10, true, 3, '["Estimate business impact","Assess data exposure risk","Evaluate operational continuity"]'),
  (v_sc_p1, 'Contact affected vendor', 'Engage with the compromised vendor to understand the situation.', 'ciso', 6, false, 4, '["Contact vendor security team","Request incident details","Review vendor response plan"]'),
  (v_sc_p1, 'Brief executive management', 'Provide situation briefing to executive leadership.', 'ciso', 8, false, 5, '["Prepare briefing document","Present to management","Document decisions"]');

  -- Phase 2: Isolation (12-48h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_sc_p2, v_supply_id, 'Isolation', 'Isolate compromised components and prevent further exposure.', 2, 48, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_sc_p2, 'Isolate affected systems', 'Disconnect or sandbox systems using the compromised component.', 'it_lead', 16, true, 1, '["Isolate affected servers","Block vendor network access","Disable auto-updates from vendor"]'),
  (v_sc_p2, 'Scan for indicators of compromise', 'Check all systems for signs of exploitation via the supply chain vector.', 'it_lead', 24, true, 2, '["Run IOC scans","Check for backdoors","Review network traffic for C2"]'),
  (v_sc_p2, 'Revoke vendor access credentials', 'Disable all access tokens, API keys, and credentials for the affected vendor.', 'it_lead', 16, true, 3, '["Revoke API keys","Disable VPN accounts","Reset shared credentials"]'),
  (v_sc_p2, 'Notify regulatory authorities if required', 'Submit notifications per NIS2 or sector-specific requirements.', 'ciso', 36, false, 4, '["Assess notification requirements","Prepare incident report","Submit to authorities"]'),
  (v_sc_p2, 'Review contracts and SLAs with vendor', 'Assess contractual obligations and potential liability.', 'legal', 48, false, 5, '["Review vendor contract","Assess SLA breaches","Document for potential claims"]');

  -- Phase 3: Alternate Sourcing (48-168h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_sc_p3, v_supply_id, 'Alternate Sourcing', 'Identify and implement alternative solutions for compromised components.', 3, 168, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_sc_p3, 'Identify alternative vendors/solutions', 'Research and evaluate alternative sources for the compromised component.', 'risk_manager', 96, true, 1, '["Research alternatives","Evaluate security posture","Compare capabilities"]'),
  (v_sc_p3, 'Implement temporary workarounds', 'Deploy interim solutions to maintain business operations.', 'it_lead', 72, true, 2, '["Design workaround","Test in staging","Deploy to production","Monitor stability"]'),
  (v_sc_p3, 'Begin vendor transition if needed', 'Start the process of transitioning to alternative vendor.', 'risk_manager', 168, false, 3, '["Negotiate contracts","Plan migration","Begin data migration"]'),
  (v_sc_p3, 'Update vendor risk assessment', 'Revise the TPRM risk rating for the affected vendor.', 'risk_manager', 120, false, 4, '["Update risk score","Document findings","Review monitoring frequency"]');

  -- Phase 4: Restoration (168-336h)
  INSERT INTO playbook_phase (id, template_id, name, description, sort_order, deadline_hours_relative, escalation_role_on_overdue, communication_template_key)
  VALUES (v_sc_p4, v_supply_id, 'Restoration', 'Restore full operations and implement long-term improvements.', 4, 336, 'ciso', 'playbook_phase_start');

  INSERT INTO playbook_task_template (phase_id, title, description, assigned_role, deadline_hours_relative, is_critical_path, sort_order, checklist_items) VALUES
  (v_sc_p4, 'Complete system restoration', 'Restore all systems to full operational capability.', 'it_lead', 240, true, 1, '["Deploy clean versions","Verify system integrity","Run full test suite"]'),
  (v_sc_p4, 'Enhance supply chain security program', 'Implement improvements to prevent future supply chain compromises.', 'ciso', 288, false, 2, '["Review vendor onboarding process","Enhance continuous monitoring","Update vendor security requirements"]'),
  (v_sc_p4, 'Conduct post-incident review', 'Document lessons learned and update incident response procedures.', 'ciso', 336, true, 3, '["Hold review meeting","Document findings","Update IR procedures","Brief leadership on improvements"]'),
  (v_sc_p4, 'Update business continuity plans', 'Revise BCPs to address supply chain compromise scenarios.', 'risk_manager', 336, false, 4, '["Review existing BCPs","Add supply chain scenarios","Test updated plans"]');

END $$;
