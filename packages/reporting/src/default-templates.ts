// Sprint 30: 8 Default Report Templates
// Seeded per-org when reporting module is first enabled

import type {
  ReportSectionConfig,
  ReportParameterDefinition,
  ReportModuleScope,
} from "@grc/shared";

export interface DefaultTemplate {
  name: string;
  description: string;
  moduleScope: ReportModuleScope;
  sectionsJson: ReportSectionConfig[];
  parametersJson: ReportParameterDefinition[];
}

export const DEFAULT_REPORT_TEMPLATES: DefaultTemplate[] = [
  // 1. Risk Register Report
  {
    name: "Risk Register Report",
    description:
      "Complete risk register with inherent and residual risk scores, treatment plans, and risk categories.",
    moduleScope: "erm",
    sectionsJson: [
      {
        type: "title",
        config: { text: "Risk Register Report — {{org.name}}" },
      },
      {
        type: "text",
        config: {
          text: "Report generated on {{report.date}}. Period: {{period.label}}.",
        },
      },
      {
        type: "kpi",
        config: { dataSource: "erm.risk_count", label: "Total Risks" },
      },
      {
        type: "kpi",
        config: { dataSource: "erm.high_risk_count", label: "High Risks" },
      },
      { type: "page_break", config: {} },
      {
        type: "chart",
        config: {
          dataSource: "erm.risk_by_category",
          chartType: "bar",
          label: "Risks by Category",
        },
      },
      {
        type: "table",
        config: {
          dataSource: "erm.risk_register",
          label: "Risk Register",
        },
      },
    ],
    parametersJson: [
      {
        key: "period",
        type: "daterange",
        label: "Reporting Period",
        required: false,
      },
    ],
  },

  // 2. Control Effectiveness Summary
  {
    name: "Control Effectiveness Summary",
    description:
      "Summary of control effectiveness scores (CES), distribution, and control testing status.",
    moduleScope: "ics",
    sectionsJson: [
      {
        type: "title",
        config: {
          text: "Control Effectiveness Summary — {{org.name}}",
        },
      },
      {
        type: "text",
        config: {
          text: "Internal Control System effectiveness report. Generated {{report.date}}.",
        },
      },
      {
        type: "kpi",
        config: { dataSource: "ics.avg_ces", label: "Average CES" },
      },
      {
        type: "kpi",
        config: {
          dataSource: "ics.control_count",
          label: "Total Controls",
        },
      },
      {
        type: "chart",
        config: {
          dataSource: "ics.ces_distribution",
          chartType: "bar",
          label: "CES Distribution",
        },
      },
      { type: "page_break", config: {} },
      {
        type: "table",
        config: {
          dataSource: "ics.control_effectiveness",
          label: "Control Details",
        },
      },
    ],
    parametersJson: [],
  },

  // 3. Audit Summary Report
  {
    name: "Audit Summary Report",
    description:
      "Summary of audit activities, findings, and remediation status.",
    moduleScope: "audit",
    sectionsJson: [
      {
        type: "title",
        config: { text: "Audit Summary — {{org.name}}" },
      },
      {
        type: "text",
        config: {
          text: "Audit summary report for {{period.label}}. Generated {{report.date}}.",
        },
      },
      {
        type: "text",
        config: {
          text: "This report provides an overview of completed and planned audit activities, key findings, and the current status of remediation actions.",
        },
      },
    ],
    parametersJson: [
      {
        key: "period",
        type: "daterange",
        label: "Audit Period",
        required: false,
      },
    ],
  },

  // 4. ISMS Status Report
  {
    name: "ISMS Status Report",
    description:
      "Information Security Management System status including incidents, threats, and control maturity.",
    moduleScope: "isms",
    sectionsJson: [
      {
        type: "title",
        config: { text: "ISMS Status Report — {{org.name}}" },
      },
      {
        type: "text",
        config: {
          text: "ISMS status overview as of {{report.date}}.",
        },
      },
      {
        type: "kpi",
        config: {
          dataSource: "isms.incident_count",
          label: "Open Incidents",
        },
      },
      {
        type: "kpi",
        config: {
          dataSource: "isms.threat_count",
          label: "Active Threats",
        },
      },
      {
        type: "chart",
        config: {
          dataSource: "isms.incident_by_severity",
          chartType: "bar",
          label: "Incidents by Severity",
        },
      },
      { type: "page_break", config: {} },
      {
        type: "table",
        config: {
          dataSource: "isms.incidents",
          label: "Incident Log",
        },
      },
      {
        type: "table",
        config: {
          dataSource: "isms.threats",
          label: "Threat Overview",
        },
      },
    ],
    parametersJson: [
      {
        key: "period",
        type: "daterange",
        label: "Reporting Period",
        required: false,
      },
    ],
  },

  // 5. DPMS / RoPA Report
  {
    name: "DPMS / RoPA Report",
    description:
      "Data Protection Management System report including Records of Processing Activities.",
    moduleScope: "dpms",
    sectionsJson: [
      {
        type: "title",
        config: {
          text: "Data Protection Report — {{org.name}}",
        },
      },
      {
        type: "text",
        config: {
          text: "Records of Processing Activities and data protection status. Generated {{report.date}}.",
        },
      },
    ],
    parametersJson: [],
  },

  // 6. ESG Sustainability Report
  {
    name: "ESG Sustainability Report",
    description:
      "Environmental, Social, and Governance reporting including emission data and compliance status.",
    moduleScope: "esg",
    sectionsJson: [
      {
        type: "title",
        config: { text: "ESG Report — {{org.name}}" },
      },
      {
        type: "text",
        config: {
          text: "Sustainability and ESG compliance report for {{period.label}}. Generated {{report.date}}.",
        },
      },
    ],
    parametersJson: [
      {
        key: "period",
        type: "daterange",
        label: "Reporting Period",
        required: true,
      },
    ],
  },

  // 7. Executive Summary
  {
    name: "Executive Summary",
    description:
      "High-level cross-module overview for board and executive management with key KPIs.",
    moduleScope: "all",
    sectionsJson: [
      {
        type: "title",
        config: {
          text: "Executive Summary — {{org.name}}",
        },
      },
      {
        type: "text",
        config: {
          text: "Cross-module executive overview. Prepared by {{author.name}} on {{report.date}}.",
        },
      },
      {
        type: "kpi",
        config: { dataSource: "erm.risk_count", label: "Total Risks" },
      },
      {
        type: "kpi",
        config: { dataSource: "erm.high_risk_count", label: "High Risks" },
      },
      {
        type: "kpi",
        config: { dataSource: "ics.avg_ces", label: "Avg. CES" },
      },
      {
        type: "kpi",
        config: {
          dataSource: "isms.incident_count",
          label: "Open Incidents",
        },
      },
      { type: "page_break", config: {} },
      {
        type: "chart",
        config: {
          dataSource: "erm.risk_by_category",
          chartType: "bar",
          label: "Risk Distribution",
        },
      },
    ],
    parametersJson: [
      {
        key: "period",
        type: "daterange",
        label: "Period",
        required: false,
      },
    ],
  },

  // 8. Compliance Calendar Report
  {
    name: "Compliance Calendar Report",
    description:
      "Overview of upcoming compliance deadlines, certifications, and review dates across all modules.",
    moduleScope: "all",
    sectionsJson: [
      {
        type: "title",
        config: {
          text: "Compliance Calendar — {{org.name}}",
        },
      },
      {
        type: "text",
        config: {
          text: "Upcoming compliance deadlines and scheduled reviews as of {{report.date}}.",
        },
      },
    ],
    parametersJson: [
      {
        key: "period",
        type: "daterange",
        label: "Calendar Period",
        required: false,
      },
    ],
  },
];
