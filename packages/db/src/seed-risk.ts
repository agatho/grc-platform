// Seed: Sprint 2 — ERM demo data (risk_appetite, risks, treatments, KRIs, measurements)
// Run: npx tsx src/seed-risk.ts (from packages/db)
// Idempotent: checks for existing data before inserting

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

// ──────────────────────────────────────────────────────────────
// Demo risk definitions (per org, 5 risks each)
// ──────────────────────────────────────────────────────────────

interface DemoRisk {
  title: string;
  description: string;
  riskCategory: string;
  riskSource: string;
  status: string;
  department: string;
  inherentLikelihood: number;
  inherentImpact: number;
  residualLikelihood: number | null;
  residualImpact: number | null;
  treatmentStrategy: string | null;
  financialImpactMin: number;
  financialImpactMax: number;
  financialImpactExpected: number;
}

const demoRisks: DemoRisk[] = [
  {
    title: "Ransomware attack on critical infrastructure",
    description: "Potential ransomware infection targeting production control systems, leading to operational downtime and data loss. ISMS Annex A.12 relevant.",
    riskCategory: "cyber",
    riskSource: "isms",
    status: "assessed",
    department: "IT Security",
    inherentLikelihood: 4,
    inherentImpact: 5,
    residualLikelihood: 2,
    residualImpact: 4,
    treatmentStrategy: "mitigate",
    financialImpactMin: 500000,
    financialImpactMax: 5000000,
    financialImpactExpected: 2000000,
  },
  {
    title: "Supply chain disruption — key raw material supplier",
    description: "Single-source dependency for critical raw materials. Geopolitical instability and logistics bottlenecks increase risk of delivery failure.",
    riskCategory: "operational",
    riskSource: "erm",
    status: "treated",
    department: "Procurement",
    inherentLikelihood: 3,
    inherentImpact: 4,
    residualLikelihood: 2,
    residualImpact: 3,
    treatmentStrategy: "mitigate",
    financialImpactMin: 200000,
    financialImpactMax: 2000000,
    financialImpactExpected: 800000,
  },
  {
    title: "GDPR compliance gap — consent management",
    description: "Incomplete consent management processes across customer-facing systems. Risk of supervisory authority investigation and fines under Art. 83 GDPR.",
    riskCategory: "compliance",
    riskSource: "erm",
    status: "identified",
    department: "Data Protection",
    inherentLikelihood: 3,
    inherentImpact: 4,
    residualLikelihood: null,
    residualImpact: null,
    treatmentStrategy: null,
    financialImpactMin: 100000,
    financialImpactMax: 4000000,
    financialImpactExpected: 1500000,
  },
  {
    title: "Key personnel departure — leadership vacuum",
    description: "Loss of critical knowledge carriers in senior management positions without adequate succession planning.",
    riskCategory: "strategic",
    riskSource: "erm",
    status: "assessed",
    department: "Human Resources",
    inherentLikelihood: 2,
    inherentImpact: 4,
    residualLikelihood: 2,
    residualImpact: 3,
    treatmentStrategy: "accept",
    financialImpactMin: 50000,
    financialImpactMax: 500000,
    financialImpactExpected: 200000,
  },
  {
    title: "ESG reporting non-compliance under CSRD",
    description: "Failure to meet Corporate Sustainability Reporting Directive requirements by FY2026 deadline. Reputational and regulatory risk.",
    riskCategory: "esg",
    riskSource: "erm",
    status: "identified",
    department: "Sustainability",
    inherentLikelihood: 3,
    inherentImpact: 3,
    residualLikelihood: null,
    residualImpact: null,
    treatmentStrategy: null,
    financialImpactMin: 50000,
    financialImpactMax: 1000000,
    financialImpactExpected: 300000,
  },
];

// ──────────────────────────────────────────────────────────────
// Demo KRI definitions
// ──────────────────────────────────────────────────────────────

interface DemoKri {
  name: string;
  description: string;
  unit: string;
  direction: string;
  thresholdGreen: number;
  thresholdYellow: number;
  thresholdRed: number;
  measurements: { value: number; daysAgo: number }[];
  riskIndex: number; // which risk from demoRisks to link
}

const demoKris: DemoKri[] = [
  {
    name: "Mean Time to Patch Critical Vulnerabilities",
    description: "Average number of days to deploy patches for critical CVEs across all production systems.",
    unit: "days",
    direction: "asc",
    thresholdGreen: 7,
    thresholdYellow: 14,
    thresholdRed: 30,
    measurements: [
      { value: 5.5, daysAgo: 90 },
      { value: 8.2, daysAgo: 60 },
      { value: 6.1, daysAgo: 30 },
    ],
    riskIndex: 0,
  },
  {
    name: "Supplier On-Time Delivery Rate",
    description: "Percentage of deliveries from critical suppliers arriving within agreed lead time.",
    unit: "%",
    direction: "desc",
    thresholdGreen: 95,
    thresholdYellow: 85,
    thresholdRed: 70,
    measurements: [
      { value: 92, daysAgo: 90 },
      { value: 88, daysAgo: 60 },
      { value: 91, daysAgo: 30 },
    ],
    riskIndex: 1,
  },
  {
    name: "Open Data Subject Requests",
    description: "Number of unresolved data subject access requests older than 20 days (GDPR Art. 12 deadline: 30 days).",
    unit: "count",
    direction: "asc",
    thresholdGreen: 3,
    thresholdYellow: 8,
    thresholdRed: 15,
    measurements: [
      { value: 2, daysAgo: 90 },
      { value: 5, daysAgo: 60 },
      { value: 4, daysAgo: 30 },
    ],
    riskIndex: 2,
  },
];

// ──────────────────────────────────────────────────────────────
// Treatment definitions (for risks with treatment)
// ──────────────────────────────────────────────────────────────

interface DemoTreatment {
  riskIndex: number;
  description: string;
  expectedRiskReduction: number;
  costEstimate: number;
  status: string;
  dueDaysFromNow: number;
}

const demoTreatments: DemoTreatment[] = [
  {
    riskIndex: 0,
    description: "Deploy EDR solution across all endpoints and implement network micro-segmentation for OT/IT boundary.",
    expectedRiskReduction: 40,
    costEstimate: 180000,
    status: "in_progress",
    dueDaysFromNow: 60,
  },
  {
    riskIndex: 0,
    description: "Implement immutable backup strategy with air-gapped copies and quarterly restore testing.",
    expectedRiskReduction: 25,
    costEstimate: 45000,
    status: "planned",
    dueDaysFromNow: 90,
  },
  {
    riskIndex: 1,
    description: "Qualify secondary suppliers for top 5 critical raw materials and negotiate framework agreements.",
    expectedRiskReduction: 35,
    costEstimate: 25000,
    status: "completed",
    dueDaysFromNow: -30,
  },
  {
    riskIndex: 1,
    description: "Establish 6-week safety stock buffer for single-source materials.",
    expectedRiskReduction: 20,
    costEstimate: 350000,
    status: "in_progress",
    dueDaysFromNow: 45,
  },
];

async function seedRisks() {
  console.log("Seeding Sprint 2 ERM data...");

  await db.transaction(async (tx) => {
    // ── 1. Get org IDs with ARC-* codes ──────────────────────
    const orgs = await tx.execute<{ id: string; org_code: string; name: string }>(sql`
      SELECT id, org_code, name FROM organization
      WHERE org_code LIKE 'ARC%' AND deleted_at IS NULL
      ORDER BY org_code
    `);

    if (orgs.length === 0) {
      console.log("  No ARC-* organizations found. Run seed.ts first.");
      return;
    }

    // Get admin user for created_by
    const adminResult = await tx.execute<{ id: string }>(sql`
      SELECT id FROM "user" WHERE email = 'admin@arctos.dev' LIMIT 1
    `);
    const adminId = adminResult[0]?.id;
    if (!adminId) {
      console.log("  Admin user not found. Run seed.ts first.");
      return;
    }

    for (const org of orgs) {
      console.log(`\n  Org: ${org.name} (${org.org_code})`);

      // Set org context for RLS bypass
      await tx.execute(sql`SELECT set_config('app.current_org_id', ${org.id}, true)`);
      await tx.execute(sql`SELECT set_config('app.bypass_rls', 'true', true)`);

      // ── 2. Risk Appetite (idempotent) ──────────────────────
      const existingAppetite = await tx.execute<{ id: string }>(sql`
        SELECT id FROM risk_appetite WHERE org_id = ${org.id} LIMIT 1
      `);

      if (existingAppetite[0]) {
        console.log(`    Risk appetite already exists, skipping`);
      } else {
        await tx.execute(sql`
          INSERT INTO risk_appetite (org_id, appetite_threshold, tolerance_upper, tolerance_lower, description, effective_date, created_by)
          VALUES (
            ${org.id},
            12,
            15.0,
            8.0,
            ${"Maximum acceptable inherent risk score for " + org.name + ". Risks exceeding threshold require immediate treatment plan and management approval."},
            '2026-01-01',
            ${adminId}
          )
        `);
        console.log(`    Risk appetite created (threshold=12)`);
      }

      // ── 3. Risks (idempotent via title match) ─────────────
      const riskIds: string[] = [];

      for (const riskDef of demoRisks) {
        const existing = await tx.execute<{ id: string }>(sql`
          SELECT id FROM risk
          WHERE org_id = ${org.id} AND title = ${riskDef.title} AND deleted_at IS NULL
          LIMIT 1
        `);

        if (existing[0]) {
          riskIds.push(existing[0].id);
          console.log(`    Risk "${riskDef.title.substring(0, 40)}..." exists`);
          continue;
        }

        const result = await tx.execute<{ id: string }>(sql`
          INSERT INTO risk (
            org_id, title, description, risk_category, risk_source, status,
            owner_id, department,
            inherent_likelihood, inherent_impact,
            residual_likelihood, residual_impact,
            treatment_strategy,
            financial_impact_min, financial_impact_max, financial_impact_expected,
            created_by, updated_by
          ) VALUES (
            ${org.id},
            ${riskDef.title},
            ${riskDef.description},
            ${riskDef.riskCategory}::risk_category,
            ${riskDef.riskSource}::risk_source,
            ${riskDef.status}::risk_status,
            ${adminId},
            ${riskDef.department},
            ${riskDef.inherentLikelihood},
            ${riskDef.inherentImpact},
            ${riskDef.residualLikelihood},
            ${riskDef.residualImpact},
            ${riskDef.treatmentStrategy}::treatment_strategy,
            ${riskDef.financialImpactMin},
            ${riskDef.financialImpactMax},
            ${riskDef.financialImpactExpected},
            ${adminId},
            ${adminId}
          )
          RETURNING id
        `);

        riskIds.push(result[0].id);
        console.log(`    Risk created: "${riskDef.title.substring(0, 40)}..." (${result[0].id.substring(0, 8)})`);
      }

      // ── 4. Treatments (idempotent via description match) ──
      for (const treatDef of demoTreatments) {
        const riskId = riskIds[treatDef.riskIndex];
        if (!riskId) continue;

        const existing = await tx.execute<{ id: string }>(sql`
          SELECT id FROM risk_treatment
          WHERE risk_id = ${riskId} AND description = ${treatDef.description} AND deleted_at IS NULL
          LIMIT 1
        `);

        if (existing[0]) {
          console.log(`    Treatment exists for risk #${treatDef.riskIndex}`);
          continue;
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + treatDef.dueDaysFromNow);
        const dueDateStr = dueDate.toISOString().split("T")[0];

        await tx.execute(sql`
          INSERT INTO risk_treatment (
            org_id, risk_id, description, responsible_id,
            expected_risk_reduction, cost_estimate, status, due_date,
            created_by, updated_by
          ) VALUES (
            ${org.id},
            ${riskId},
            ${treatDef.description},
            ${adminId},
            ${treatDef.expectedRiskReduction},
            ${treatDef.costEstimate},
            ${treatDef.status}::treatment_status,
            ${dueDateStr}::date,
            ${adminId},
            ${adminId}
          )
        `);
        console.log(`    Treatment created for risk #${treatDef.riskIndex} (${treatDef.status})`);
      }

      // ── 5. KRIs + Measurements (idempotent via name match) ──
      for (const kriDef of demoKris) {
        const riskId = riskIds[kriDef.riskIndex];

        const existing = await tx.execute<{ id: string }>(sql`
          SELECT id FROM kri
          WHERE org_id = ${org.id} AND name = ${kriDef.name} AND deleted_at IS NULL
          LIMIT 1
        `);

        if (existing[0]) {
          console.log(`    KRI "${kriDef.name.substring(0, 40)}..." exists`);
          continue;
        }

        const kriResult = await tx.execute<{ id: string }>(sql`
          INSERT INTO kri (
            org_id, risk_id, name, description, unit, direction,
            threshold_green, threshold_yellow, threshold_red,
            current_value, measurement_frequency, alert_enabled,
            created_by, updated_by
          ) VALUES (
            ${org.id},
            ${riskId || null},
            ${kriDef.name},
            ${kriDef.description},
            ${kriDef.unit},
            ${kriDef.direction}::kri_direction,
            ${kriDef.thresholdGreen},
            ${kriDef.thresholdYellow},
            ${kriDef.thresholdRed},
            ${kriDef.measurements[kriDef.measurements.length - 1].value},
            'monthly'::kri_measurement_frequency,
            true,
            ${adminId},
            ${adminId}
          )
          RETURNING id
        `);

        const kriId = kriResult[0].id;
        console.log(`    KRI created: "${kriDef.name.substring(0, 40)}..." (${kriId.substring(0, 8)})`);

        // Insert measurements
        for (const m of kriDef.measurements) {
          const measuredAt = new Date();
          measuredAt.setDate(measuredAt.getDate() - m.daysAgo);

          await tx.execute(sql`
            INSERT INTO kri_measurement (
              kri_id, org_id, value, measured_at, source, created_by
            ) VALUES (
              ${kriId},
              ${org.id},
              ${m.value},
              ${measuredAt.toISOString()}::timestamptz,
              'manual'::kri_measurement_source,
              ${adminId}
            )
          `);
        }
        console.log(`      ${kriDef.measurements.length} measurements added`);

        // Update KRI last_measured_at and compute alert status
        const latestValue = kriDef.measurements[kriDef.measurements.length - 1].value;
        let alertStatus: string;
        if (kriDef.direction === "asc") {
          if (latestValue <= kriDef.thresholdGreen) alertStatus = "green";
          else if (latestValue <= kriDef.thresholdYellow) alertStatus = "yellow";
          else alertStatus = "red";
        } else {
          if (latestValue >= kriDef.thresholdGreen) alertStatus = "green";
          else if (latestValue >= kriDef.thresholdYellow) alertStatus = "yellow";
          else alertStatus = "red";
        }

        // Determine trend from measurements
        const values = kriDef.measurements.map((m) => m.value);
        let trend = "stable";
        if (values.length >= 2) {
          const last = values[values.length - 1];
          const prev = values[values.length - 2];
          if (kriDef.direction === "asc") {
            // Lower is better
            trend = last < prev ? "improving" : last > prev ? "worsening" : "stable";
          } else {
            // Higher is better
            trend = last > prev ? "improving" : last < prev ? "worsening" : "stable";
          }
        }

        await tx.execute(sql`
          UPDATE kri
          SET current_alert_status = ${alertStatus}::kri_alert_status,
              trend = ${trend}::kri_trend,
              last_measured_at = now()
          WHERE id = ${kriId}
        `);
        console.log(`      Alert: ${alertStatus}, Trend: ${trend}`);
      }
    }
  });

  console.log("\nSprint 2 ERM seed complete.");
  await client.end();
  process.exit(0);
}

seedRisks().catch((err) => {
  console.error("ERM seed failed:", err);
  process.exit(1);
});
