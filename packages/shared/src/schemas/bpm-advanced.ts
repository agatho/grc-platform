import { z } from "zod";

// Sprint 47: BPM Advanced — Zod Schemas

// ─── Event Log Import ───────────────────────────────────────
export const createEventLogImportSchema = z.object({
  processId: z.string().uuid().optional(),
  importName: z.string().min(1).max(500),
  formatSource: z.enum(["csv", "xes"]),
  columnMapping: z
    .object({
      caseId: z.string().min(1),
      activity: z.string().min(1),
      timestamp: z.string().min(1),
      resource: z.string().optional(),
    })
    .optional(),
});

// ─── Process KPI Definition ─────────────────────────────────
export const LOWER_IS_BETTER_METRICS = [
  "cycle_time",
  "error_rate",
  "cost",
] as const;
export const HIGHER_IS_BETTER_METRICS = [
  "throughput",
  "compliance_rate",
] as const;

export const createKpiDefinitionSchema = z.object({
  processId: z.string().uuid(),
  name: z.string().min(1).max(500),
  metricType: z.enum([
    "cycle_time",
    "cost",
    "throughput",
    "error_rate",
    "compliance_rate",
    "custom",
  ]),
  unit: z.string().min(1).max(50),
  targetValue: z.number(),
  thresholdGreen: z.number(),
  thresholdYellow: z.number(),
  measurementPeriod: z.enum(["daily", "weekly", "monthly", "quarterly"]),
  dataSource: z.enum(["manual", "mining", "api"]),
  apiConfig: z
    .object({
      url: z.string().url(),
      method: z.enum(["GET", "POST"]).default("GET"),
      jsonPath: z.string(),
      auth: z
        .object({
          type: z.enum(["bearer", "api_key", "basic"]),
          value: z.string(),
        })
        .optional(),
    })
    .optional(),
  ownerId: z.string().uuid().optional(),
});

export const updateKpiDefinitionSchema = createKpiDefinitionSchema.partial();

// ─── KPI Measurement ────────────────────────────────────────
export const createKpiMeasurementSchema = z.object({
  kpiDefinitionId: z.string().uuid(),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  actualValue: z.number(),
  dataSourceDetail: z.string().max(2000).optional(),
});

// ─── KPI Status Computation ─────────────────────────────────
export function computeKpiStatus(
  metricType: string,
  actualValue: number,
  thresholdGreen: number,
  thresholdYellow: number,
): string {
  const lowerIsBetter = LOWER_IS_BETTER_METRICS.includes(metricType as any);
  if (lowerIsBetter) {
    if (actualValue <= thresholdGreen) return "green";
    if (actualValue <= thresholdYellow) return "yellow";
    return "red";
  }
  // Higher is better
  if (actualValue >= thresholdGreen) return "green";
  if (actualValue >= thresholdYellow) return "yellow";
  return "red";
}

// ─── Maturity Assessment ────────────────────────────────────
export const submitMaturityAssessmentSchema = z.object({
  processId: z.string().uuid(),
  assessmentDate: z.string().date(),
  dimensionScores: z.object({
    documentation: z.number().min(1).max(5),
    adherence: z.number().min(1).max(5),
    measurement: z.number().min(1).max(5),
    improvement: z.number().min(1).max(5),
    satisfaction: z.number().min(1).max(5),
  }),
  targetLevel: z.number().int().min(1).max(5).optional(),
});

// ─── Maturity Level Computation (weakest-link + average override) ─
export function computeMaturityLevel(
  dimensionScores: Record<string, number>,
): number {
  const scores = Object.values(dimensionScores);
  if (scores.length === 0) return 1;
  const min = Math.min(...scores);
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  if (avg > min + 1) return Math.floor(avg);
  return Math.floor(min);
}

// ─── Maturity Gap Actions ───────────────────────────────────
export function generateGapActions(
  dimensionScores: Record<string, number>,
  targetLevel: number,
): Array<{ dimension: string; action: string; priority: string }> {
  const actions: Array<{
    dimension: string;
    action: string;
    priority: string;
  }> = [];
  const gapDescriptions: Record<string, Record<number, string>> = {
    documentation: {
      2: "Document the process in BPMN format with roles and responsibilities",
      3: "Define formal process ownership and document variants/exceptions",
      4: "Implement version control and regular review cycles",
      5: "Establish automated documentation generation from execution data",
    },
    adherence: {
      2: "Ensure all participants are trained on the documented process",
      3: "Implement deviation detection mechanisms and process controls",
      4: "Measure conformance regularly using process mining",
      5: "Achieve and maintain >90% conformance rate",
    },
    measurement: {
      2: "Define basic metrics (cycle time, throughput, error rate)",
      3: "Implement systematic metric collection with KPI targets",
      4: "Use metrics for data-driven process owner decisions",
      5: "Apply statistical process control and predictive analytics",
    },
    improvement: {
      2: "Establish a process for handling improvement suggestions",
      3: "Implement data-based improvements with PDCA cycles",
      4: "Measure and verify improvement results systematically",
      5: "Foster innovation culture in process design with best practice sharing",
    },
    satisfaction: {
      2: "Collect regular stakeholder feedback on the process",
      3: "Use feedback to drive process changes",
      4: "Measure end-to-end satisfaction with trend tracking",
      5: "Consistently meet or exceed satisfaction targets",
    },
  };

  for (const [dimension, score] of Object.entries(dimensionScores)) {
    if (score < targetLevel) {
      const nextLevel = Math.floor(score) + 1;
      const desc = gapDescriptions[dimension]?.[nextLevel];
      if (desc) {
        actions.push({
          dimension,
          action: desc,
          priority:
            targetLevel - score > 2
              ? "high"
              : targetLevel - score > 1
                ? "medium"
                : "low",
        });
      }
    }
  }
  return actions;
}

// ─── Value Stream Map ───────────────────────────────────────
export const LEAN_8_WASTES = [
  "defects",
  "overproduction",
  "waiting",
  "non_utilized_talent",
  "transportation",
  "inventory",
  "motion",
  "extra_processing",
] as const;

export const createVsmSchema = z.object({
  processId: z.string().uuid(),
  mapType: z.enum(["current_state", "future_state"]),
  title: z.string().min(1).max(500),
  diagramData: z.object({
    steps: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        cycleTimeMinutes: z.number().min(0),
        waitTimeMinutes: z.number().min(0).default(0),
        changeoverTimeMinutes: z.number().min(0).default(0),
        uptime: z.number().min(0).max(100).default(100),
        operators: z.number().int().min(0).default(1),
        wasteTags: z.array(z.enum(LEAN_8_WASTES)).optional(),
      }),
    ),
    informationFlows: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
          type: z.enum(["electronic", "manual", "push", "pull"]),
        }),
      )
      .optional(),
    materialFlows: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
          inventoryCount: z.number().int().min(0).optional(),
        }),
      )
      .optional(),
  }),
});

export const updateVsmSchema = createVsmSchema.partial();

// ─── VSM Metrics Computation ────────────────────────────────
export function computeVsmMetrics(
  steps: Array<{ cycleTimeMinutes: number; waitTimeMinutes: number }>,
): {
  totalLeadTimeMinutes: number;
  totalValueAddMinutes: number;
  valueAddRatio: number;
} {
  const totalLeadTimeMinutes = steps.reduce(
    (sum, s) => sum + s.cycleTimeMinutes + s.waitTimeMinutes,
    0,
  );
  const totalValueAddMinutes = steps.reduce(
    (sum, s) => sum + s.cycleTimeMinutes,
    0,
  );
  const valueAddRatio =
    totalLeadTimeMinutes > 0
      ? (totalValueAddMinutes / totalLeadTimeMinutes) * 100
      : 0;
  return {
    totalLeadTimeMinutes,
    totalValueAddMinutes,
    valueAddRatio: Math.round(valueAddRatio * 100) / 100,
  };
}

// ─── Waste Analysis ─────────────────────────────────────────
export function computeWasteAnalysis(
  steps: Array<{ waitTimeMinutes: number; wasteTags?: string[] }>,
): Array<{ wasteType: string; timeMinutes: number; percentage: number }> {
  const wasteMap = new Map<string, number>();
  let totalWasteTime = 0;

  for (const step of steps) {
    if (step.wasteTags && step.wasteTags.length > 0) {
      const perTag = step.waitTimeMinutes / step.wasteTags.length;
      for (const tag of step.wasteTags) {
        wasteMap.set(tag, (wasteMap.get(tag) || 0) + perTag);
        totalWasteTime += perTag;
      }
    }
  }

  return Array.from(wasteMap.entries()).map(([wasteType, timeMinutes]) => ({
    wasteType,
    timeMinutes: Math.round(timeMinutes * 100) / 100,
    percentage:
      totalWasteTime > 0
        ? Math.round((timeMinutes / totalWasteTime) * 10000) / 100
        : 0,
  }));
}

// ─── Template Adoption ──────────────────────────────────────
export const adoptTemplateSchema = z.object({
  customName: z.string().min(1).max(500).optional(),
});

// ─── Mining Suggestion ──────────────────────────────────────
export const acceptSuggestionSchema = z.object({
  createNewVersion: z.boolean().default(true),
});
