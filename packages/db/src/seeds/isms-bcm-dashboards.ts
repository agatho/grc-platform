// Sprint 55: Seed 13 dashboard configurations (7 ISMS + 6 BCM)
// Uses Sprint 18 dashboard_widget_config table

import { db } from "../index";
import { sql } from "drizzle-orm";

const ISMS_DASHBOARD_SEEDS = [
  {
    name: "Overview Protection Requirement",
    key: "isms_prq",
    module: "isms",
    layout: {
      widgets: [
        { type: "protection_requirements_table", w: 12, h: 6, x: 0, y: 0 },
        { type: "cia_distribution", w: 6, h: 3, x: 0, y: 6 },
        { type: "prq_status", w: 6, h: 3, x: 6, y: 6 },
      ],
    },
  },
  {
    name: "Overview Assessments",
    key: "isms_assessments",
    module: "isms",
    layout: {
      widgets: [
        { type: "assessments_table", w: 12, h: 6, x: 0, y: 0 },
        { type: "assessment_completion", w: 6, h: 3, x: 0, y: 6 },
      ],
    },
  },
  {
    name: "Overview Risk Scenario",
    key: "isms_risk_scenario",
    module: "isms",
    layout: {
      widgets: [
        { type: "risk_scenarios_table", w: 12, h: 6, x: 0, y: 0 },
        { type: "risk_scenario_heatmap", w: 6, h: 4, x: 0, y: 6 },
      ],
    },
  },
  {
    name: "Overview Single Risk ISM",
    key: "isms_single_risk",
    module: "isms",
    layout: {
      widgets: [{ type: "single_risk_table", w: 12, h: 6, x: 0, y: 0 }],
    },
  },
  {
    name: "Overview Control ISM",
    key: "isms_control",
    module: "isms",
    layout: {
      widgets: [
        { type: "controls_table", w: 12, h: 6, x: 0, y: 0 },
        { type: "control_maturity_chart", w: 6, h: 3, x: 0, y: 6 },
      ],
    },
  },
  {
    name: "Finding BCM",
    key: "isms_finding_bcm",
    module: "isms",
    layout: {
      widgets: [{ type: "findings_table", w: 12, h: 6, x: 0, y: 0 }],
    },
  },
  {
    name: "ISMS Welcome",
    key: "isms_welcome",
    module: "isms",
    layout: {
      widgets: [
        { type: "welcome_card", w: 6, h: 3, x: 0, y: 0 },
        { type: "my_todos", w: 6, h: 3, x: 6, y: 0 },
        { type: "kpi_overview", w: 12, h: 2, x: 0, y: 3 },
      ],
    },
  },
];

const BCM_DASHBOARD_SEEDS = [
  {
    name: "Overview Essential Process",
    key: "bcm_essential",
    module: "bcms",
    layout: {
      widgets: [{ type: "essential_processes_table", w: 12, h: 6, x: 0, y: 0 }],
    },
  },
  {
    name: "Overview BIA",
    key: "bcm_bia",
    module: "bcms",
    layout: {
      widgets: [
        { type: "bia_table", w: 12, h: 6, x: 0, y: 0 },
        { type: "bia_impact_chart", w: 6, h: 3, x: 0, y: 6 },
      ],
    },
  },
  {
    name: "Overview Continuity Strategy",
    key: "bcm_strategy",
    module: "bcms",
    layout: {
      widgets: [{ type: "strategies_table", w: 12, h: 6, x: 0, y: 0 }],
    },
  },
  {
    name: "Overview Emergency Plan",
    key: "bcm_emergency",
    module: "bcms",
    layout: {
      widgets: [{ type: "emergency_plans_table", w: 12, h: 6, x: 0, y: 0 }],
    },
  },
  {
    name: "Emergency Drill Plan",
    key: "bcm_drill",
    module: "bcms",
    layout: {
      widgets: [
        { type: "drills_table", w: 12, h: 6, x: 0, y: 0 },
        { type: "drill_results_summary", w: 6, h: 3, x: 0, y: 6 },
      ],
    },
  },
  {
    name: "Overview Finding BCM",
    key: "bcm_finding",
    module: "bcms",
    layout: {
      widgets: [{ type: "findings_table", w: 12, h: 6, x: 0, y: 0 }],
    },
  },
];

export async function seedISMSBCMDashboards() {
  const allSeeds = [...ISMS_DASHBOARD_SEEDS, ...BCM_DASHBOARD_SEEDS];

  for (const dashboard of allSeeds) {
    await db.execute(
      sql`INSERT INTO dashboard_widget_config (id, name, key, module, layout, is_system, created_at)
          VALUES (gen_random_uuid(), ${dashboard.name}, ${dashboard.key}, ${dashboard.module}, ${JSON.stringify(dashboard.layout)}::jsonb, true, NOW())
          ON CONFLICT (key) DO NOTHING`,
    );
  }
}
