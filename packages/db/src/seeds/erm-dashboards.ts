// Sprint 54: Seed 7 ERM dashboard configurations
// Uses Sprint 18 dashboard_widget_config table

import { db } from "../index";
import { sql } from "drizzle-orm";

const ERM_DASHBOARD_SEEDS = [
  {
    name: "Welcome",
    key: "erm_welcome",
    module: "erm",
    layout: {
      widgets: [
        { type: "welcome_card", w: 6, h: 3, x: 0, y: 0 },
        { type: "my_todos_erm", w: 6, h: 3, x: 6, y: 0 },
        { type: "kpi_cards", w: 12, h: 2, x: 0, y: 3 },
      ],
    },
  },
  {
    name: "ERM Overview",
    key: "erm_overview",
    module: "erm",
    layout: {
      widgets: [
        { type: "dual_heatmap", w: 12, h: 6, x: 0, y: 0 },
        { type: "risk_value_bar_chart", w: 6, h: 4, x: 0, y: 6 },
        { type: "category_distribution", w: 6, h: 4, x: 6, y: 6 },
      ],
    },
  },
  {
    name: "My ToDos",
    key: "erm_my_todos",
    module: "erm",
    layout: {
      widgets: [{ type: "my_todos_erm", w: 12, h: 8, x: 0, y: 0 }],
    },
  },
  {
    name: "Central Risk Manager",
    key: "erm_central",
    module: "erm",
    layout: {
      widgets: [
        { type: "kpi_cards", w: 12, h: 2, x: 0, y: 0 },
        { type: "risks_table", w: 12, h: 6, x: 0, y: 2 },
        { type: "treatments_table", w: 12, h: 4, x: 0, y: 8 },
      ],
    },
  },
  {
    name: "Risk Incident",
    key: "erm_incident",
    module: "erm",
    layout: {
      widgets: [
        { type: "risk_events_timeline", w: 8, h: 6, x: 0, y: 0 },
        { type: "near_miss_counter", w: 4, h: 3, x: 8, y: 0 },
        { type: "materialized_risks", w: 4, h: 3, x: 8, y: 3 },
      ],
    },
  },
  {
    name: "Enterprise Risk",
    key: "erm_enterprise",
    module: "erm",
    layout: {
      widgets: [
        { type: "risk_appetite_gauge", w: 6, h: 4, x: 0, y: 0 },
        { type: "top_risks_table", w: 6, h: 4, x: 6, y: 0 },
        { type: "bowtie_summary", w: 12, h: 4, x: 0, y: 4 },
      ],
    },
  },
  {
    name: "Risk Evaluation Status",
    key: "erm_eval_status",
    module: "erm",
    layout: {
      widgets: [
        { type: "evaluation_phase_distribution", w: 6, h: 4, x: 0, y: 0 },
        { type: "overdue_evaluations", w: 6, h: 4, x: 6, y: 0 },
        { type: "evaluation_timeline", w: 12, h: 4, x: 0, y: 4 },
      ],
    },
  },
];

export async function seedERMDashboards() {
  for (const dashboard of ERM_DASHBOARD_SEEDS) {
    await db.execute(
      sql`INSERT INTO dashboard_widget_config (id, name, key, module, layout, is_system, created_at)
          VALUES (gen_random_uuid(), ${dashboard.name}, ${dashboard.key}, ${dashboard.module}, ${JSON.stringify(dashboard.layout)}::jsonb, true, NOW())
          ON CONFLICT (key) DO NOTHING`,
    );
  }
}
