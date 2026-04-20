// Framework-specific Test-Plan-Templates.
//
// Static, expert-curated templates that auditors can drop into a control_test
// without invoking the AI agent. Keyed by control reference (e.g. "8.4" for
// PCI DSS Req 8.4 "MFA implemented to secure access into the CDE").
//
// Why static? AI test plans are great for ad-hoc controls but auditors prefer
// repeatable, peer-reviewed steps for high-stakes attestations (SOC 2 Type II,
// PCI DSS QSA, ISAE 3402). Templates can be loaded as starting points and then
// customised per environment.
//
// Schema:
//   key       — `${frameworkSource}::${controlRef}`, e.g. "pci_dss_v4::8.4"
//   objective — what we're proving
//   approach  — Test of Design (ToD) and Test of Effectiveness (ToE) split
//   steps     — ordered, each carrying expected evidence and pass/fail criteria
//   sampleSize— heuristic per ToE volume
//   frequency — how often this should be re-tested

export interface TestPlanStep {
  step: number;
  action: string;
  expectedEvidence: string;
  passCriteria: string;
}

export interface TestPlanTemplate {
  controlRef: string;
  framework: string;
  title: string;
  objective: string;
  scope: string;
  approach: { tod: string; toe: string };
  steps: TestPlanStep[];
  sampleSize: string;
  frequency: "quarterly" | "annual" | "monthly" | "continuous";
  estimatedHours: number;
  evidenceTypes: string[];
}

export const FRAMEWORK_TEST_PLAN_TEMPLATES: Record<string, TestPlanTemplate> = {
  // ────────────────────────────────────────────────────────────────────────
  // PCI DSS v4.0.1 — High-frequency QSA-relevant tests
  // ────────────────────────────────────────────────────────────────────────
  "pci_dss_v4::1.2": {
    controlRef: "1.2",
    framework: "pci_dss_v4",
    title: "NSC configuration standards defined and applied",
    objective:
      "Verify that NSC (firewall/security-group) configuration standards exist, are approved and are applied to all systems in scope.",
    scope: "All NSCs protecting the CDE perimeter and segmentation boundaries.",
    approach: {
      tod: "Inspect the NSC standards document and compare to a sample of running configurations.",
      toe: "For each in-scope NSC, retrieve the live ruleset and compare line-by-line to the approved baseline.",
    },
    steps: [
      {
        step: 1,
        action: "Obtain the current NSC configuration standards document.",
        expectedEvidence: "PDF/Markdown with version and approver",
        passCriteria: "Approved < 12 months ago, signed by responsible owner",
      },
      {
        step: 2,
        action:
          "Select a sample of NSCs (firewalls, AWS SGs, k8s NetworkPolicies) protecting the CDE.",
        expectedEvidence: "Asset list filtered to scope",
        passCriteria: "Sample covers ≥ 25% of CDE-facing NSCs, min 3",
      },
      {
        step: 3,
        action: "Export the live ruleset of each sampled NSC.",
        expectedEvidence: "Config exports with timestamp",
        passCriteria: "Live config matches baseline within tolerance",
      },
      {
        step: 4,
        action: 'Identify any rules not present in the baseline ("drift").',
        expectedEvidence: "Drift report with rule-level diff",
        passCriteria: "Any drift has a CR# justification",
      },
    ],
    sampleSize: "min(3, ceil(0.25 * total_in_scope_nscs))",
    frequency: "quarterly",
    estimatedHours: 4,
    evidenceTypes: ["config_export", "policy_doc", "change_record"],
  },

  "pci_dss_v4::3.6": {
    controlRef: "3.6",
    framework: "pci_dss_v4",
    title: "Cryptographic keys used to protect stored account data are secured",
    objective:
      "Confirm that key-management procedures prevent disclosure or misuse of cryptographic keys protecting PAN.",
    scope:
      "All HSMs, KMS instances and key vaults storing keys for cardholder data.",
    approach: {
      tod: "Review the key-management procedure for split-knowledge, dual-control, rotation and revocation.",
      toe: "Walk through one key generation, one rotation and one revocation event in the audit period.",
    },
    steps: [
      {
        step: 1,
        action: "Identify all keys used to encrypt account data.",
        expectedEvidence:
          "Key inventory with purpose, algorithm, key length, rotation date",
        passCriteria: "Inventory current within 30 days; each key has owner",
      },
      {
        step: 2,
        action: "Inspect access controls on the key store.",
        expectedEvidence: "IAM policy/HSM ACL",
        passCriteria:
          "Only key-custodians have access; no service-accounts with broad rights",
      },
      {
        step: 3,
        action:
          "Walk through one cryptographic key change event in the period.",
        expectedEvidence:
          "Change ticket, approval, post-change verification log",
        passCriteria: "Change followed split-knowledge/dual-control",
      },
      {
        step: 4,
        action: "Verify rotation cadence vs. published cryptoperiod.",
        expectedEvidence: "Rotation log per key",
        passCriteria: "Each key rotated at or before cryptoperiod",
      },
    ],
    sampleSize: "100% of keys in scope (typically <20)",
    frequency: "annual",
    estimatedHours: 6,
    evidenceTypes: [
      "key_inventory",
      "iam_policy",
      "change_record",
      "rotation_log",
    ],
  },

  "pci_dss_v4::8.4": {
    controlRef: "8.4",
    framework: "pci_dss_v4",
    title: "MFA implemented to secure access into the CDE",
    objective:
      "Verify that MFA is enforced for all non-console access into the CDE and for all administrators.",
    scope:
      "All authentication paths into the CDE: VPN, jump hosts, cloud consoles, database admin, application admin UIs.",
    approach: {
      tod: "Inspect identity provider config and conditional access rules.",
      toe: "Attempt to log in with single factor only and verify it is rejected.",
    },
    steps: [
      {
        step: 1,
        action: "List all authentication paths into the CDE.",
        expectedEvidence: "Access matrix per system",
        passCriteria: "List complete and signed off by CDE owner",
      },
      {
        step: 2,
        action: "Inspect IdP config for MFA enforcement.",
        expectedEvidence: "Conditional-access policy export",
        passCriteria: "MFA = mandatory for CDE-tagged apps",
      },
      {
        step: 3,
        action: "Attempt login with single factor only on a sample of paths.",
        expectedEvidence: "Screenshot of MFA prompt or rejection",
        passCriteria: "Single-factor login rejected on every sampled path",
      },
      {
        step: 4,
        action: "Sample 25 administrator login events from the period.",
        expectedEvidence: "IdP login audit log",
        passCriteria: "100% include MFA factor",
      },
    ],
    sampleSize: "All distinct CDE access paths + 25 admin logins",
    frequency: "quarterly",
    estimatedHours: 5,
    evidenceTypes: ["idp_policy", "login_log", "screenshot", "access_matrix"],
  },

  "pci_dss_v4::10.4": {
    controlRef: "10.4",
    framework: "pci_dss_v4",
    title: "Audit logs reviewed to identify anomalies and suspicious activity",
    objective:
      "Demonstrate that log review is performed at the required frequency and follow-up is documented.",
    scope:
      "All in-scope log sources (CDE servers, NSCs, IDS/IPS, IAM systems).",
    approach: {
      tod: "Inspect the log-review procedure and SIEM rule set.",
      toe: "Sample log-review records from the period and trace one suspicious event to its disposition.",
    },
    steps: [
      {
        step: 1,
        action: "Verify SIEM ingest from all in-scope log sources.",
        expectedEvidence: "SIEM source list, ingest health metrics",
        passCriteria: "All sources present, 0 sources with > 4h ingest gap",
      },
      {
        step: 2,
        action: "Inspect documented log-review procedure.",
        expectedEvidence: "Procedure document",
        passCriteria: "Daily for critical sources, weekly for others",
      },
      {
        step: 3,
        action: "Sample 5 days of log-review records.",
        expectedEvidence: "Reviewer sign-off, exceptions raised",
        passCriteria: "Each day reviewed within 24h of generation",
      },
      {
        step: 4,
        action: "Trace one alert to its disposition.",
        expectedEvidence: "Alert → ticket → resolution chain",
        passCriteria: "Resolution within SLA, root cause documented",
      },
    ],
    sampleSize: "5 random days from the period + 1 alert end-to-end",
    frequency: "quarterly",
    estimatedHours: 4,
    evidenceTypes: [
      "siem_export",
      "procedure_doc",
      "sign_off_log",
      "ticket_chain",
    ],
  },

  "pci_dss_v4::11.4": {
    controlRef: "11.4",
    framework: "pci_dss_v4",
    title: "External and internal penetration testing regularly performed",
    objective:
      "Confirm pen testing is performed at required frequency, by qualified personnel, with findings remediated.",
    scope: "All external and internal CDE-facing systems.",
    approach: {
      tod: "Review pen-test scoping document and tester qualifications.",
      toe: "Walk through the most recent test report and finding remediation.",
    },
    steps: [
      {
        step: 1,
        action: "Obtain the most recent pen-test report (within 12 months).",
        expectedEvidence: "Pen-test PDF report",
        passCriteria:
          "Conducted within 12 months; methodology stated (NIST 800-115/PCI DSS)",
      },
      {
        step: 2,
        action: "Verify tester independence and qualifications.",
        expectedEvidence: "Tester CV/cert (OSCP/CREST)",
        passCriteria:
          "Independent of in-scope dev/ops teams; held current cert at test date",
      },
      {
        step: 3,
        action: "Reconcile the report scope vs. CDE inventory.",
        expectedEvidence: "Scope statement + CDE asset list",
        passCriteria:
          "Scope matches CDE; no in-scope system excluded without justification",
      },
      {
        step: 4,
        action: "Trace each high/critical finding to remediation status.",
        expectedEvidence: "Finding tracker with status, evidence",
        passCriteria: "All high/critical remediated and re-tested",
      },
    ],
    sampleSize: "1 most recent test (annual)",
    frequency: "annual",
    estimatedHours: 8,
    evidenceTypes: [
      "pentest_report",
      "scope_doc",
      "tester_cv",
      "remediation_tracker",
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // SOC 2 (TSC 2017/2022) — Common Criteria
  // ────────────────────────────────────────────────────────────────────────
  "isae3402_soc2::CC6.1": {
    controlRef: "CC6.1",
    framework: "isae3402_soc2",
    title:
      "Logical access security software, infrastructure, and architectures",
    objective:
      "Verify that logical access controls restrict access to the system and data to authorised users.",
    scope:
      "Production environments and supporting infrastructure that process customer data.",
    approach: {
      tod: "Inspect IAM policies, access matrices and provisioning procedures.",
      toe: "Sample new joiners, movers and leavers across the audit period; trace access lifecycle.",
    },
    steps: [
      {
        step: 1,
        action: "Obtain the access-control policy and access matrix.",
        expectedEvidence: "Policy doc + matrix",
        passCriteria:
          "Policy approved < 12 months; matrix maps each role to permissions",
      },
      {
        step: 2,
        action: "Sample 25 new-hire access provisionings.",
        expectedEvidence: "Ticket, approval, access screenshots",
        passCriteria:
          "All provisioned within 5 business days; access matches role",
      },
      {
        step: 3,
        action: "Sample 25 leavers.",
        expectedEvidence: "Off-board ticket, IdP deactivation timestamp",
        passCriteria: "All deactivated within 24h of last working day",
      },
      {
        step: 4,
        action: "Sample 10 role changes (movers).",
        expectedEvidence: "Ticket showing prior + new access",
        passCriteria: "Old privileges removed within 5 business days",
      },
    ],
    sampleSize: "25 joiners + 25 leavers + 10 movers",
    frequency: "annual",
    estimatedHours: 12,
    evidenceTypes: ["policy_doc", "ticket", "iam_export", "screenshot"],
  },

  "isae3402_soc2::CC6.6": {
    controlRef: "CC6.6",
    framework: "isae3402_soc2",
    title:
      "Logical access security measures protect against threats from sources outside its system boundaries",
    objective:
      "Demonstrate that perimeter controls (firewalls, WAF, DDoS) protect against external threats.",
    scope:
      "All Internet-facing systems and the boundaries of the production environment.",
    approach: {
      tod: "Review network architecture diagram and perimeter rule sets.",
      toe: "Verify deployment of perimeter controls and review block events from the audit period.",
    },
    steps: [
      {
        step: 1,
        action: "Obtain network architecture diagram showing perimeter.",
        expectedEvidence: "Diagram (Visio/Mermaid)",
        passCriteria:
          "Diagram current within 6 months and shows all ingress/egress points",
      },
      {
        step: 2,
        action: "Sample 5 perimeter firewalls and verify rule sets.",
        expectedEvidence: "Config export",
        passCriteria: "All show deny-by-default; allow-list documented",
      },
      {
        step: 3,
        action: "Verify WAF coverage on all public web apps.",
        expectedEvidence: "WAF inventory + app inventory",
        passCriteria: "100% of public apps behind WAF",
      },
      {
        step: 4,
        action: "Review 30 days of perimeter block logs.",
        expectedEvidence: "SIEM export of blocks",
        passCriteria: "Logs present, ingested into SIEM, no gaps > 4h",
      },
    ],
    sampleSize: "5 firewalls + 100% of public apps + 30 days logs",
    frequency: "annual",
    estimatedHours: 8,
    evidenceTypes: [
      "network_diagram",
      "config_export",
      "waf_inventory",
      "siem_export",
    ],
  },

  "isae3402_soc2::CC7.2": {
    controlRef: "CC7.2",
    framework: "isae3402_soc2",
    title: "System monitoring detects anomalies and incidents",
    objective:
      "Verify that system monitoring detects anomalies indicative of malicious acts, configuration changes or other events.",
    scope: "Production infrastructure and applications.",
    approach: {
      tod: "Inspect monitoring tooling and alert configuration.",
      toe: "Walk through the alerts triggered in the audit period and the ticket flow.",
    },
    steps: [
      {
        step: 1,
        action: "List monitoring tools (SIEM, EDR, APM).",
        expectedEvidence: "Tool inventory",
        passCriteria: "Coverage of all critical systems",
      },
      {
        step: 2,
        action: "Inspect alert rules.",
        expectedEvidence: "Alert ruleset export",
        passCriteria:
          "Rules cover MITRE ATT&CK common TTPs; reviewed quarterly",
      },
      {
        step: 3,
        action: "Sample 25 alerts from the period.",
        expectedEvidence: "Alert → ticket → resolution chain",
        passCriteria: "Each triaged within SLA; follow-up actions recorded",
      },
      {
        step: 4,
        action: "Verify on-call rotation.",
        expectedEvidence: "On-call schedule, paging logs",
        passCriteria: "24/7 coverage; ack < 15 min for critical",
      },
    ],
    sampleSize: "25 alerts + on-call schedule for the period",
    frequency: "annual",
    estimatedHours: 10,
    evidenceTypes: [
      "tool_inventory",
      "alert_ruleset",
      "ticket_chain",
      "oncall_schedule",
    ],
  },

  "isae3402_soc2::CC8.1": {
    controlRef: "CC8.1",
    framework: "isae3402_soc2",
    title:
      "Authorises, designs, develops, configures, documents, tests, approves, and implements changes",
    objective:
      "Verify that all changes to infrastructure and code go through authorised change management.",
    scope: "All production infrastructure and application code repositories.",
    approach: {
      tod: "Inspect change-management policy and CI/CD pipeline configuration.",
      toe: "Sample changes and walk through the full lifecycle.",
    },
    steps: [
      {
        step: 1,
        action: "Obtain change-management policy.",
        expectedEvidence: "Policy doc",
        passCriteria:
          "Defines categories (standard/normal/emergency), approvers, testing requirements",
      },
      {
        step: 2,
        action: "Sample 25 production deployments from the period.",
        expectedEvidence: "PR, CI build, deploy log",
        passCriteria:
          "Each has ≥ 1 reviewer, all CI checks green, deploy log present",
      },
      {
        step: 3,
        action: "Sample 5 emergency changes.",
        expectedEvidence: "Emergency change ticket, post-hoc review",
        passCriteria:
          "Justified, approved retrospectively within 5 business days",
      },
      {
        step: 4,
        action:
          "Verify segregation of duties between developer and production approver.",
        expectedEvidence: "PR-author vs deploy-approver",
        passCriteria: "0 deploys self-approved (admin overrides flagged)",
      },
    ],
    sampleSize: "25 deployments + 5 emergency changes",
    frequency: "annual",
    estimatedHours: 10,
    evidenceTypes: ["policy_doc", "pull_request", "ci_log", "deploy_log"],
  },

  "isae3402_soc2::A1.2": {
    controlRef: "A1.2",
    framework: "isae3402_soc2",
    title:
      "Environmental protections, software, data backup processes, and recovery infrastructure",
    objective:
      "Verify that backup and recovery processes maintain availability commitments.",
    scope: "All production data stores supporting customer-facing services.",
    approach: {
      tod: "Inspect backup configuration and DR plan.",
      toe: "Review backup logs and the most recent recovery test.",
    },
    steps: [
      {
        step: 1,
        action: "Obtain backup policy and DR plan.",
        expectedEvidence: "Policy + DR plan",
        passCriteria: "RPO and RTO defined per service tier; aligned to SLA",
      },
      {
        step: 2,
        action: "Sample 30 days of backup logs.",
        expectedEvidence: "Backup tool report",
        passCriteria: "All scheduled backups completed; failures retried < 1h",
      },
      {
        step: 3,
        action: "Inspect the most recent restore test.",
        expectedEvidence: "Restore test report with RTO timing",
        passCriteria: "Conducted within 12 months; RTO met",
      },
      {
        step: 4,
        action: "Verify backup encryption and offsite storage.",
        expectedEvidence: "Encryption config + storage location",
        passCriteria: "AES-256 at rest; geo-redundant storage",
      },
    ],
    sampleSize: "30 days backups + 1 restore test",
    frequency: "annual",
    estimatedHours: 6,
    evidenceTypes: [
      "policy_doc",
      "backup_log",
      "restore_report",
      "encryption_config",
    ],
  },
};

export function getTestPlanTemplate(
  framework: string,
  controlRef: string,
): TestPlanTemplate | null {
  return FRAMEWORK_TEST_PLAN_TEMPLATES[`${framework}::${controlRef}`] ?? null;
}

export function listTestPlanTemplates(framework?: string): TestPlanTemplate[] {
  const all = Object.values(FRAMEWORK_TEST_PLAN_TEMPLATES);
  if (!framework) return all;
  return all.filter((t) => t.framework === framework);
}
