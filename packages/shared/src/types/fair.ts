// Sprint 25: FAIR Monte Carlo types

export type RiskMethodology = "qualitative" | "fair" | "hybrid";
export type FairSimulationStatus = "pending" | "running" | "completed" | "failed";

export interface LossComponents {
  productivity: number;
  response: number;
  replacement: number;
  fines: number;
  judgments: number;
  reputation: number;
}

export interface FAIRParameters {
  id: string;
  riskId: string;
  orgId: string;
  lefMin: string;
  lefMostLikely: string;
  lefMax: string;
  lmMin: string;
  lmMostLikely: string;
  lmMax: string;
  lossComponents: LossComponents;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface FAIRSimulationResult {
  id: string;
  riskId: string;
  orgId: string;
  parametersId?: string;
  iterations: number;
  status: FairSimulationStatus;
  aleP5?: string;
  aleP25?: string;
  aleP50?: string;
  aleP75?: string;
  aleP95?: string;
  aleMean?: string;
  aleStdDev?: string;
  histogram?: FAIRHistogramBucket[];
  lossExceedance?: FAIRExceedancePoint[];
  sensitivity?: FAIRSensitivityEntry[];
  errorMessage?: string;
  computedAt?: string;
  createdAt: string;
  createdBy?: string;
}

// HistogramBucket, ExceedancePoint, SensitivityEntry types
// are defined in utils/fair-monte-carlo.ts and re-exported from index.ts
// Use those canonical types. Here we re-use them by reference.

export interface FAIRHistogramBucket {
  bucket: number;
  bucketMax: number;
  count: number;
  percentage: number;
}

export interface FAIRExceedancePoint {
  threshold: number;
  probability: number;
}

export interface FAIRSensitivityEntry {
  parameter: string;
  impact: number;
  label: string;
}

export interface FAIRTopRisk {
  riskId: string;
  riskTitle: string;
  riskCategory: string;
  aleP50: number;
  aleP95: number;
  aleMean: number;
  status: string;
  ownerName?: string;
}

export interface FAIRAggregateResult {
  totalAleP50: number;
  totalAleP95: number;
  totalAleMean: number;
  riskCount: number;
  byCategory: {
    category: string;
    aleP50: number;
    aleP95: number;
    count: number;
  }[];
}
