import { describe, it, expect } from "vitest";
import {
  mapDpiaRiskToErm,
  mapFriaRightToErm,
  mapAiIncidentToErm,
  decideRiskSync,
  buildSyncBatch,
  type DpiaRiskSource,
  type FriaRightSource,
  type AiIncidentSource,
} from "../src/state-machines/cross-risk-sync";

describe("mapDpiaRiskToErm", () => {
  const src: DpiaRiskSource = {
    id: "dr-1",
    orgId: "org-1",
    dpiaId: "dpia-1",
    riskDescription: "Excessive personal data collection in marketing funnel.",
    severity: "high",
    likelihood: "medium",
    impact: "high",
  };

  it("maps qualitative scales to 1-5", () => {
    const draft = mapDpiaRiskToErm(src);
    expect(draft.inherentLikelihood).toBe(3);
    expect(draft.inherentImpact).toBe(5);
    expect(draft.riskScoreInherent).toBe(15);
  });

  it("assigns compliance category + isms source", () => {
    const draft = mapDpiaRiskToErm(src);
    expect(draft.riskCategory).toBe("compliance");
    expect(draft.riskSource).toBe("isms");
  });

  it("catalogSource + catalogEntryId for idempotency", () => {
    const draft = mapDpiaRiskToErm(src);
    expect(draft.catalogSource).toBe("dpms_dpia_risk");
    expect(draft.catalogEntryId).toBe("dr-1");
  });

  it("truncates long description in title", () => {
    const longDesc = "x".repeat(200);
    const draft = mapDpiaRiskToErm({ ...src, riskDescription: longDesc });
    expect(draft.title.length).toBeLessThanOrEqual(110);
    expect(draft.title).toMatch(/^\[DPIA\]/);
  });

  it("defaults to medium scale for unknown levels", () => {
    const draft = mapDpiaRiskToErm({ ...src, likelihood: "???" });
    expect(draft.inherentLikelihood).toBe(3);
  });
});

describe("mapFriaRightToErm", () => {
  const src: FriaRightSource = {
    friaId: "fria-1",
    orgId: "org-1",
    right: "equality_non_discrimination",
    impact: "high",
    residualRisk: "medium",
    mitigation: "Bias testing across demographics.",
  };

  it("maps fundamental-right impact scales", () => {
    const draft = mapFriaRightToErm(src);
    expect(draft.inherentImpact).toBe(5);
    expect(draft.inherentLikelihood).toBe(3);
    expect(draft.riskScoreInherent).toBe(15);
  });

  it("negligible => 1", () => {
    const draft = mapFriaRightToErm({ ...src, impact: "negligible", residualRisk: "negligible" });
    expect(draft.inherentImpact).toBe(1);
    expect(draft.riskScoreInherent).toBe(1);
  });

  it("composite catalogEntryId = friaId:right", () => {
    const draft = mapFriaRightToErm(src);
    expect(draft.catalogEntryId).toBe("fria-1:equality_non_discrimination");
  });
});

describe("mapAiIncidentToErm", () => {
  const src: AiIncidentSource = {
    id: "inc-1",
    orgId: "org-1",
    aiSystemId: "ai-1",
    title: "Model drift caused false rejections",
    severity: "medium",
    isSerious: false,
    harmType: "property_damage",
    affectedPersonsCount: 10,
  };

  it("serious => 5x5", () => {
    const draft = mapAiIncidentToErm({ ...src, isSerious: true });
    expect(draft.inherentLikelihood).toBe(5);
    expect(draft.inherentImpact).toBe(5);
    expect(draft.riskScoreInherent).toBe(25);
  });

  it("non-serious medium => 3x3", () => {
    const draft = mapAiIncidentToErm(src);
    expect(draft.inherentLikelihood).toBe(3);
    expect(draft.inherentImpact).toBe(3);
  });

  it("non-serious low => 3x2", () => {
    const draft = mapAiIncidentToErm({ ...src, severity: "low" });
    expect(draft.inherentImpact).toBe(2);
  });

  it("cyber category for AI incidents", () => {
    const draft = mapAiIncidentToErm(src);
    expect(draft.riskCategory).toBe("cyber");
  });
});

describe("decideRiskSync", () => {
  const draft = mapDpiaRiskToErm({
    id: "dr",
    orgId: "o",
    dpiaId: "d",
    riskDescription: "r",
    severity: "low",
    likelihood: "low",
    impact: "low",
  });

  it("below default threshold => skip", () => {
    const decision = decideRiskSync(draft);
    expect(decision.shouldSync).toBe(false);
    expect(decision.score).toBe(1);
  });

  it("above threshold => sync", () => {
    const highDraft = mapDpiaRiskToErm({
      id: "dr",
      orgId: "o",
      dpiaId: "d",
      riskDescription: "r",
      severity: "high",
      likelihood: "high",
      impact: "high",
    });
    const decision = decideRiskSync(highDraft);
    expect(decision.shouldSync).toBe(true);
    expect(decision.score).toBe(25);
  });

  it("custom threshold applies", () => {
    const mediumDraft = mapDpiaRiskToErm({
      id: "dr",
      orgId: "o",
      dpiaId: "d",
      riskDescription: "r",
      severity: "medium",
      likelihood: "medium",
      impact: "medium",
    });
    // medium x medium x medium = 3x3 = 9
    expect(decideRiskSync(mediumDraft, 1).shouldSync).toBe(true);
    expect(decideRiskSync(mediumDraft, 9).shouldSync).toBe(true);
    expect(decideRiskSync(mediumDraft, 20).shouldSync).toBe(false);
  });
});

describe("buildSyncBatch", () => {
  it("filters low-score candidates", () => {
    const result = buildSyncBatch({
      dpiaRisks: [
        {
          id: "1",
          orgId: "o",
          dpiaId: "d",
          riskDescription: "r",
          severity: "low",
          likelihood: "low",
          impact: "low",
        },
        {
          id: "2",
          orgId: "o",
          dpiaId: "d",
          riskDescription: "r",
          severity: "high",
          likelihood: "high",
          impact: "high",
        },
      ],
      friaRights: [],
      aiIncidents: [],
    });
    expect(result.totalCandidates).toBe(2);
    expect(result.eligibleForSync).toBe(1);
    expect(result.filteredByThreshold).toBe(1);
    expect(result.drafts[0].catalogEntryId).toBe("2");
  });

  it("processes all three source types", () => {
    const result = buildSyncBatch({
      dpiaRisks: [
        {
          id: "d1",
          orgId: "o",
          dpiaId: "dp",
          riskDescription: "r",
          severity: "high",
          likelihood: "high",
          impact: "high",
        },
      ],
      friaRights: [
        {
          friaId: "f1",
          orgId: "o",
          right: "dignity",
          impact: "high",
          residualRisk: "high",
          mitigation: "m",
        },
      ],
      aiIncidents: [
        {
          id: "i1",
          orgId: "o",
          aiSystemId: null,
          title: "t",
          severity: "high",
          isSerious: true,
          harmType: null,
          affectedPersonsCount: null,
        },
      ],
    });
    expect(result.totalCandidates).toBe(3);
    expect(result.eligibleForSync).toBe(3);
    expect(result.drafts.some((d) => d.catalogSource === "dpms_dpia_risk")).toBe(true);
    expect(result.drafts.some((d) => d.catalogSource === "ai_act_fria_right")).toBe(true);
    expect(result.drafts.some((d) => d.catalogSource === "ai_act_incident")).toBe(true);
  });

  it("empty input", () => {
    const result = buildSyncBatch({ dpiaRisks: [], friaRights: [], aiIncidents: [] });
    expect(result.totalCandidates).toBe(0);
    expect(result.eligibleForSync).toBe(0);
  });
});
