import { z } from "zod";

// Sprint 35: GRC Monitoring Agents Zod Schemas

export const agentConfigSchema = z.object({
  scanFrequencyMinutes: z.number().int().min(5).max(10080).default(60),
  thresholds: z.record(z.number()).default({}),
  scope: z.array(z.string()).max(100).optional(),
  enabled: z.boolean().optional().default(true),
});

export const createAgentSchema = z.object({
  agentType: z.enum([
    "evidence_review",
    "compliance_monitor",
    "vendor_signal",
    "sla_monitor",
  ]),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  config: agentConfigSchema,
  isActive: z.boolean().default(false),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  config: agentConfigSchema.optional(),
  isActive: z.boolean().optional(),
});

export const updateRecommendationSchema = z.object({
  status: z.enum(["accepted", "dismissed"]),
  dismissReason: z.string().max(2000).optional(),
});

export const agentRunOptionsSchema = z.object({
  dryRun: z.boolean().default(false),
});

export const agentDefaultConfigs: Record<
  string,
  {
    name: string;
    description: string;
    config: z.infer<typeof agentConfigSchema>;
  }
> = {
  evidence_review: {
    name: "Evidence Review Agent",
    description: "Reviews evidence freshness and quality for controls",
    config: {
      scanFrequencyMinutes: 60,
      thresholds: { evidenceAgeDays: 90, qualityThreshold: 0.7 },
      enabled: true,
    },
  },
  compliance_monitor: {
    name: "Compliance Monitor Agent",
    description: "Monitors regulatory changes and compliance drift",
    config: {
      scanFrequencyMinutes: 1440,
      thresholds: { relevanceScore: 0.5, driftWeeks: 4 },
      enabled: true,
    },
  },
  vendor_signal: {
    name: "Vendor Signal Agent",
    description: "Scans for vendor risk signals including CVEs and news",
    config: {
      scanFrequencyMinutes: 240,
      thresholds: { severityThreshold: 0.6 },
      enabled: true,
    },
  },
  sla_monitor: {
    name: "SLA Monitor Agent",
    description: "Monitors cross-module deadlines and proactively escalates",
    config: {
      scanFrequencyMinutes: 60,
      thresholds: { leadTimeDays: 7, criticalLeadTimeDays: 3 },
      enabled: true,
    },
  },
};
