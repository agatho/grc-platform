// Cross-Module Risk-Sync (Epic 6.2)
//
// Mappt DPIA-Risks (dpia_risk) und AI-Risks (aiFria.rightsAssessed + aiIncident)
// in das Enterprise Risk Register (risk).

export type DpiaSeverity = "high" | "medium" | "low";
export type DpiaLikelihood = "high" | "medium" | "low";
export type DpiaImpact = "high" | "medium" | "low";

export interface DpiaRiskSource {
  id: string;
  orgId: string;
  dpiaId: string;
  riskDescription: string;
  severity: string;
  likelihood: string;
  impact: string;
}

export interface SyncedRiskDraft {
  title: string;
  description: string;
  riskCategory:
    | "strategic"
    | "operational"
    | "financial"
    | "compliance"
    | "cyber"
    | "reputational"
    | "esg";
  riskSource: "isms" | "erm" | "bcm" | "project" | "process";
  inherentLikelihood: number; // 1-5
  inherentImpact: number; // 1-5
  riskScoreInherent: number;
  /** Persistiert als catalogSource + catalogEntryId fuer Idempotenz */
  catalogSource: string;
  catalogEntryId: string;
}

// ─── Qualitative -> Quantitative Scale ────────────────────────

const LEVEL_TO_SCALE: Record<string, number> = {
  low: 1,
  medium: 3,
  high: 5,
};

function toScale(level: string): number {
  return LEVEL_TO_SCALE[level.toLowerCase()] ?? 3;
}

// ─── DPIA -> ERM Mapping ──────────────────────────────────────

export function mapDpiaRiskToErm(src: DpiaRiskSource): SyncedRiskDraft {
  const lh = toScale(src.likelihood);
  const im = toScale(src.impact);
  const title =
    src.riskDescription.length > 100
      ? src.riskDescription.slice(0, 97) + "..."
      : src.riskDescription;

  return {
    title: `[DPIA] ${title}`,
    description: `Source: DPIA ${src.dpiaId}. ${src.riskDescription}`,
    riskCategory: "compliance",
    riskSource: "isms",
    inherentLikelihood: lh,
    inherentImpact: im,
    riskScoreInherent: lh * im,
    catalogSource: "dpms_dpia_risk",
    catalogEntryId: src.id,
  };
}

// ─── AI-Act FRIA Rights-Risk -> ERM Mapping ───────────────────

export type FundamentalRightImpact = "high" | "medium" | "low" | "negligible";

export interface FriaRightSource {
  friaId: string;
  orgId: string;
  right: string;
  impact: FundamentalRightImpact;
  residualRisk: FundamentalRightImpact;
  mitigation: string;
}

export function mapFriaRightToErm(src: FriaRightSource): SyncedRiskDraft {
  const impactScale: Record<FundamentalRightImpact, number> = {
    high: 5,
    medium: 3,
    low: 2,
    negligible: 1,
  };
  const lh = impactScale[src.residualRisk]; // residual-risk als likelihood-proxy
  const im = impactScale[src.impact];

  return {
    title: `[AI-Act FRIA] ${src.right} impact`,
    description: `Source: FRIA ${src.friaId}. Fundamental right: ${src.right}. Mitigation: ${src.mitigation}`,
    riskCategory: "compliance",
    riskSource: "isms",
    inherentLikelihood: lh,
    inherentImpact: im,
    riskScoreInherent: lh * im,
    catalogSource: "ai_act_fria_right",
    catalogEntryId: `${src.friaId}:${src.right}`,
  };
}

// ─── AI-Incident -> ERM Mapping ───────────────────────────────

export interface AiIncidentSource {
  id: string;
  orgId: string;
  aiSystemId: string | null;
  title: string;
  severity: string;
  isSerious: boolean;
  harmType: string | null;
  affectedPersonsCount: number | null;
}

export function mapAiIncidentToErm(src: AiIncidentSource): SyncedRiskDraft {
  // Serious + harm: likelihood=5 (already materialized), impact=5
  // Non-serious: likelihood=3, impact based on severity
  const lh = src.isSerious ? 5 : 3;
  const im = src.isSerious
    ? 5
    : src.severity === "high"
      ? 4
      : src.severity === "low"
        ? 2
        : 3;

  return {
    title: `[AI-Incident] ${src.title}`,
    description: `Source: AI-Incident ${src.id}. ${src.harmType ? `Harm type: ${src.harmType}. ` : ""}${
      src.affectedPersonsCount ? `Affected: ${src.affectedPersonsCount}. ` : ""
    }`,
    riskCategory: "cyber",
    riskSource: "isms",
    inherentLikelihood: lh,
    inherentImpact: im,
    riskScoreInherent: lh * im,
    catalogSource: "ai_act_incident",
    catalogEntryId: src.id,
  };
}

// ─── Sync Decision Logic ──────────────────────────────────────
//
// Fuer Idempotenz: wenn Risk mit gleichem (catalogSource, catalogEntryId)
// existiert => update, sonst insert. Threshold-Check: nur syncen wenn Score
// >= 6 (medium x medium = 9, low x medium = 3 -> filtere low-priority).

export interface SyncDecision {
  shouldSync: boolean;
  reason: string;
  score: number;
}

export function decideRiskSync(
  draft: SyncedRiskDraft,
  minScore = 6,
): SyncDecision {
  if (draft.riskScoreInherent < minScore) {
    return {
      shouldSync: false,
      reason: `Score ${draft.riskScoreInherent} < threshold ${minScore}. Nicht ERM-worthy.`,
      score: draft.riskScoreInherent,
    };
  }
  return {
    shouldSync: true,
    reason: `Score ${draft.riskScoreInherent} >= threshold ${minScore}. Sync in ERM.`,
    score: draft.riskScoreInherent,
  };
}

// ─── Sync Batch Aggregate ─────────────────────────────────────

export interface SyncBatchInput {
  dpiaRisks: DpiaRiskSource[];
  friaRights: FriaRightSource[];
  aiIncidents: AiIncidentSource[];
  minScore?: number;
}

export interface SyncBatchResult {
  totalCandidates: number;
  eligibleForSync: number;
  filteredByThreshold: number;
  drafts: SyncedRiskDraft[];
  skipped: Array<{ catalogEntryId: string; reason: string }>;
}

export function buildSyncBatch(input: SyncBatchInput): SyncBatchResult {
  const minScore = input.minScore ?? 6;
  const drafts: SyncedRiskDraft[] = [];
  const skipped: Array<{ catalogEntryId: string; reason: string }> = [];

  const processCandidate = (draft: SyncedRiskDraft) => {
    const decision = decideRiskSync(draft, minScore);
    if (decision.shouldSync) {
      drafts.push(draft);
    } else {
      skipped.push({
        catalogEntryId: draft.catalogEntryId,
        reason: decision.reason,
      });
    }
  };

  for (const d of input.dpiaRisks) processCandidate(mapDpiaRiskToErm(d));
  for (const f of input.friaRights) processCandidate(mapFriaRightToErm(f));
  for (const i of input.aiIncidents) processCandidate(mapAiIncidentToErm(i));

  const totalCandidates =
    input.dpiaRisks.length + input.friaRights.length + input.aiIncidents.length;

  return {
    totalCandidates,
    eligibleForSync: drafts.length,
    filteredByThreshold: skipped.length,
    drafts,
    skipped,
  };
}
