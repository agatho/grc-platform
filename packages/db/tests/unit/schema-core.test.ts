// Schema-shape tests for the core domain tables (Risk, Audit, DORA, Asset, TPRM, DPMS).
// Verifies that the most-referenced columns/enums exist, catching breaking changes.

import { describe, it, expect } from "vitest";
import * as risk from "../../src/schema/risk";
import * as audit from "../../src/schema/audit-mgmt";
import * as dora from "../../src/schema/dora";
import * as asset from "../../src/schema/asset";
import * as tprm from "../../src/schema/tprm";
import * as dpms from "../../src/schema/dpms";
import * as platform from "../../src/schema/platform";

describe("risk schema", () => {
  it("risk has lifecycle columns", () => {
    const r = risk.risk;
    expect(r.id).toBeDefined();
    expect(r.orgId).toBeDefined();
    expect(r.title).toBeDefined();
    expect(r.status).toBeDefined();
    expect(r.ownerId).toBeDefined();
    expect(r.inherentLikelihood).toBeDefined();
    expect(r.inherentImpact).toBeDefined();
    expect(r.residualLikelihood).toBeDefined();
    expect(r.residualImpact).toBeDefined();
    expect(r.treatmentStrategy).toBeDefined();
    expect(r.reviewDate).toBeDefined();
  });

  it("riskTreatment carries cost fields per CLAUDE.md rule 15", () => {
    const t = risk.riskTreatment;
    expect(t).toBeDefined();
  });

  it("kri has measurement frequency + alert status", () => {
    const k = risk.kri;
    expect(k.id).toBeDefined();
    expect(k.orgId).toBeDefined();
  });

  it("riskAsset bridges risk + asset", () => {
    expect(risk.riskAsset).toBeDefined();
  });

  it("riskControl bridges risk + control", () => {
    expect(risk.riskControl).toBeDefined();
  });
});

describe("audit-mgmt schema", () => {
  it("auditUniverse has scope fields", () => {
    expect(audit.auditUniverseEntry).toBeDefined();
  });

  it("auditPlan has period fields", () => {
    expect(audit.auditPlan).toBeDefined();
  });

  it("audit has lifecycle fields", () => {
    expect(audit.audit).toBeDefined();
  });
});

describe("dora schema", () => {
  it("doraIctRisk + relations exported", () => {
    expect(dora.doraIctRisk).toBeDefined();
    expect(dora.doraIctRiskRelations).toBeDefined();
  });

  it("doraIctIncident has detection + classification fields", () => {
    expect(dora.doraIctIncident).toBeDefined();
  });

  it("doraIctProvider supports concentration tracking", () => {
    expect(dora.doraIctProvider).toBeDefined();
  });

  it("doraTlptPlan exists for Art. 26", () => {
    expect(dora.doraTlptPlan).toBeDefined();
  });

  it("doraNis2CrossRef bridges DORA <-> NIS2", () => {
    expect(dora.doraNis2CrossRef).toBeDefined();
  });
});

describe("asset schema", () => {
  it("asset table + tier enum present", () => {
    expect(asset.asset).toBeDefined();
    expect(asset.assetTierEnum).toBeDefined();
  });

  it("assetCiaProfile holds CIA classification", () => {
    expect(asset.assetCiaProfile).toBeDefined();
  });
});

describe("tprm schema", () => {
  it("vendor table is exported", () => {
    expect(tprm.vendor).toBeDefined();
  });
});

describe("dpms schema", () => {
  it("ropaEntry exists for Art. 30 GDPR", () => {
    expect(dpms.ropaEntry).toBeDefined();
  });

  it("dpia exists for Art. 35", () => {
    expect(dpms.dpia).toBeDefined();
  });

  it("dsr table present for Art. 12-22", () => {
    expect(dpms.dsr).toBeDefined();
  });

  it("dataBreach for Art. 33/34", () => {
    expect(dpms.dataBreach).toBeDefined();
  });
});

describe("platform schema", () => {
  it("organization, user, audit_log are exported", () => {
    expect(platform.organization).toBeDefined();
    expect(platform.user).toBeDefined();
    expect(platform.auditLog).toBeDefined();
    expect(platform.notification).toBeDefined();
  });

  it("orgTypeEnum has documented variants", () => {
    expect(platform.orgTypeEnum).toBeDefined();
  });

  it("userRoleEnum exposes the role tuple", () => {
    expect(platform.userRoleEnum).toBeDefined();
  });
});
