import { z } from "zod";

// Sprint 25: FAIR Monte Carlo — Zod validation schemas

const lossComponentSchema = z
  .object({
    productivity: z.number().min(0).max(100).default(30),
    response: z.number().min(0).max(100).default(20),
    replacement: z.number().min(0).max(100).default(10),
    fines: z.number().min(0).max(100).default(15),
    judgments: z.number().min(0).max(100).default(10),
    reputation: z.number().min(0).max(100).default(15),
  })
  .refine(
    (data) => {
      const sum =
        data.productivity +
        data.response +
        data.replacement +
        data.fines +
        data.judgments +
        data.reputation;
      return Math.abs(sum - 100) < 0.01;
    },
    { message: "Loss components must sum to 100%" },
  );

// ─── FAIR Parameters ────────────────────────────────────────

export const upsertFairParametersSchema = z
  .object({
    // Loss Event Frequency (events per year)
    lefMin: z.number().nonnegative(),
    lefMostLikely: z.number().nonnegative(),
    lefMax: z.number().nonnegative(),
    // Loss Magnitude (EUR per event)
    lmMin: z.number().nonnegative(),
    lmMostLikely: z.number().nonnegative(),
    lmMax: z.number().nonnegative(),
    // Loss components (optional — defaults applied server-side)
    lossComponents: lossComponentSchema.optional(),
  })
  .refine(
    (data) =>
      data.lefMin <= data.lefMostLikely && data.lefMostLikely <= data.lefMax,
    {
      message: "LEF values must satisfy: min <= mostLikely <= max",
      path: ["lefMostLikely"],
    },
  )
  .refine(
    (data) =>
      data.lmMin <= data.lmMostLikely && data.lmMostLikely <= data.lmMax,
    {
      message: "LM values must satisfy: min <= mostLikely <= max",
      path: ["lmMostLikely"],
    },
  )
  .refine((data) => data.lefMax > 0, {
    message: "LEF max must be greater than 0",
    path: ["lefMax"],
  })
  .refine((data) => data.lmMax > 0, {
    message: "LM max must be greater than 0",
    path: ["lmMax"],
  });

// ─── Simulation Request ─────────────────────────────────────

export const runSimulationSchema = z.object({
  iterations: z.number().int().min(1000).max(100000).default(10000),
});

// ─── FAIR Top Risks Query ───────────────────────────────────

export const fairTopRisksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ─── FAIR Compare Query ─────────────────────────────────────

export const fairCompareQuerySchema = z.object({
  riskIds: z.string().transform((val) => val.split(",").filter(Boolean)),
});

// ─── Risk Methodology Setting ───────────────────────────────

const riskMethodologyValues = ["qualitative", "fair", "hybrid"] as const;

export const updateRiskMethodologySchema = z.object({
  riskMethodology: z.enum(riskMethodologyValues),
});

export type LossComponentsInput = z.infer<typeof lossComponentSchema>;
