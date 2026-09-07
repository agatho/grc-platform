import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import {
  validateTiaQuality,
  assessTransferRisk,
  ADEQUACY_COUNTRIES,
  type TiaSnapshot,
} from "../src/state-machines/dpms-tia";
import {
  decideRetention,
  validateConsentType,
  isConsentStillValid,
  type RetentionScheduleRule,
  type ConsentTypeMeta,
} from "../src/state-machines/dpms-retention";

const longAssessment = "x".repeat(250);

const validTiaSnapshot: TiaSnapshot = {
  title: "TIA AWS-EU-US Transfer",
  transferCountry: "US",
  legalBasis: "sccs",
  schremsIiAssessment: longAssessment,
  riskRating: "medium",
  supportingDocuments: "SCC-2021/914 Module 2 signed 2026-03",
  responsibleId: "dpo-uuid",
  assessmentDate: "2026-03-15",
  nextReviewDate: "2027-03-15",
};

describe("validateTiaQuality", () => {
  it("passes with full snapshot", () => {
    const blockers = validateTiaQuality(validTiaSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks schrems_ii_assessment too short", () => {
    const blockers = validateTiaQuality({
      ...validTiaSnapshot,
      schremsIiAssessment: "short",
    });
    expect(
      blockers.some((b) => b.code === "schrems_ii_assessment_too_short"),
    ).toBe(true);
  });
  it("warns missing responsible", () => {
    const blockers = validateTiaQuality({
      ...validTiaSnapshot,
      responsibleId: null,
    });
    const warn = blockers.find((b) => b.code === "missing_responsible");
    expect(warn?.severity).toBe("warning");
  });
});

describe("assessTransferRisk", () => {
  it("adequacy for CH", () => {
    const r = assessTransferRisk("CH");
    expect(r.hasAdequacy).toBe(true);
    expect(r.recommendedMechanism).toBe("adequacy");
  });
  it("adequacy for US (DPF)", () => {
    const r = assessTransferRisk("US");
    expect(r.hasAdequacy).toBe(true);
  });
  it("no adequacy for CN", () => {
    const r = assessTransferRisk("CN");
    expect(r.hasAdequacy).toBe(false);
    expect(r.requiresFallback).toBe(true);
    expect(r.recommendedMechanism).toBe("sccs");
  });
  it("case-insensitive", () => {
    expect(assessTransferRisk("ch").hasAdequacy).toBe(true);
    expect(assessTransferRisk(" gb ").hasAdequacy).toBe(true);
  });
});

describe("decideRetention", () => {
  const schedule: RetentionScheduleRule = {
    id: "s1",
    entityType: "customer_record",
    retentionPeriodDays: 365,
    basis: "legal_obligation",
    legalReference: "§147 HGB",
    triggerEvent: "contract_end",
    deletionStrategy: "anonymize",
  };

  it("not due yet (contract ended yesterday)", () => {
    const triggerEventAt = new Date();
    triggerEventAt.setDate(triggerEventAt.getDate() - 1);
    const d = decideRetention({ schedule, recordId: "r1", triggerEventAt });
    expect(d.shouldDelete).toBe(false);
  });

  it("overdue 10 days", () => {
    const triggerEventAt = new Date();
    triggerEventAt.setDate(triggerEventAt.getDate() - 375);
    const d = decideRetention({ schedule, recordId: "r1", triggerEventAt });
    expect(d.shouldDelete).toBe(true);
    expect(d.daysOverdue).toBeGreaterThanOrEqual(9);
  });

  it("blocked by litigation-hold", () => {
    const triggerEventAt = new Date();
    triggerEventAt.setDate(triggerEventAt.getDate() - 400);
    const d = decideRetention({
      schedule,
      recordId: "r1",
      triggerEventAt,
      activeExceptions: [
        { id: "hold1", reason: "Rechtsstreit XYZ", validUntil: null },
      ],
    });
    expect(d.shouldDelete).toBe(false);
    expect(d.blockedByException?.id).toBe("hold1");
  });

  it("expired exception doesnt block", () => {
    const triggerEventAt = new Date();
    triggerEventAt.setDate(triggerEventAt.getDate() - 400);
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const d = decideRetention({
      schedule,
      recordId: "r1",
      triggerEventAt,
      activeExceptions: [
        { id: "hold1", reason: "Abgelaufen", validUntil: past },
      ],
    });
    expect(d.shouldDelete).toBe(true);
  });
});

describe("validateConsentType", () => {
  it("valid consent type", () => {
    const meta: ConsentTypeMeta = {
      name: "Newsletter",
      requiredForService: false,
      granularity: "single",
      defaultDurationDays: 365,
      canBeWithdrawnEasily: true,
    };
    const r = validateConsentType(meta);
    expect(r.valid).toBe(true);
  });

  it("flags required_for_service + bundled coupling", () => {
    const r = validateConsentType({
      name: "Alles",
      requiredForService: true,
      granularity: "bundled",
      defaultDurationDays: 365,
      canBeWithdrawnEasily: true,
    });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.includes("Koppelungsverbot"))).toBe(true);
  });

  it("flags easy-withdraw false", () => {
    const r = validateConsentType({
      name: "Test",
      requiredForService: false,
      granularity: "single",
      defaultDurationDays: 365,
      canBeWithdrawnEasily: false,
    });
    expect(r.valid).toBe(false);
  });

  it("warns about > 2 years duration", () => {
    const r = validateConsentType({
      name: "Test",
      requiredForService: false,
      granularity: "single",
      defaultDurationDays: 1000,
      canBeWithdrawnEasily: true,
    });
    expect(r.valid).toBe(false);
  });
});

describe("isConsentStillValid", () => {
  it("valid when not withdrawn or expired", () => {
    expect(
      isConsentStillValid({
        grantedAt: new Date(),
        withdrawnAt: null,
        expiresAt: null,
      }),
    ).toBe(true);
  });
  it("invalid after withdrawal", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(
      isConsentStillValid({
        grantedAt: new Date(),
        withdrawnAt: past,
        expiresAt: null,
      }),
    ).toBe(false);
  });
  it("invalid after expiration", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(
      isConsentStillValid({
        grantedAt: new Date(),
        withdrawnAt: null,
        expiresAt: past,
      }),
    ).toBe(false);
  });
});

// ── [N-2 · Welle 6a] `ADEQUACY_COUNTRIES` stand in der Importliste dieser
// Suite und wurde von keiner Zusicherung angefasst. Beim Nachziehen der
// fehlenden Pruefung kam der Befund heraus, der in
// `src/types/eam-advanced.ts` dokumentiert ist: es gab eine zweite,
// verdeckte Liste mit dem Nicht-ISO-Code "UK".
describe("ADEQUACY_COUNTRIES — ISO 3166-1 alpha-2, und nur einmal", () => {
  it("fuehrt das Vereinigte Koenigreich als GB, nicht als UK", () => {
    expect(ADEQUACY_COUNTRIES.has("GB")).toBe(true);
    // "UK" ist kein ISO-3166-1-alpha-2-Code. Stuende er hier, traefe ihn
    // kein Laendercode aus der Datenbank.
    expect(ADEQUACY_COUNTRIES.has("UK")).toBe(false);
  });

  it("besteht ausschliesslich aus zweistelligen Grossbuchstaben-Codes", () => {
    for (const code of ADEQUACY_COUNTRIES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("stimmt mit der Entscheidung von assessTransferRisk ueberein", () => {
    // Die Liste und die Funktion duerfen nicht auseinanderlaufen — genau
    // das war der Befund an der zweiten Kopie.
    for (const code of ADEQUACY_COUNTRIES) {
      expect(assessTransferRisk(code).hasAdequacy).toBe(true);
    }
    expect(assessTransferRisk("RU").hasAdequacy).toBe(false);
  });
});

describe("ADEQUACY_COUNTRIES — genau eine Deklaration im Paket", () => {
  // Der eigentliche Befund war nicht der Inhalt, sondern die ZAHL: derselbe
  // Name wurde zweimal exportiert, der Stern-Export aus `types.ts` vom
  // namentlichen Export in `index.ts` verdeckt, und die verdeckte Kopie war
  // die falsche. Eine Zusicherung auf den Inhalt haette das nie gesehen —
  // sie las ja die richtige Liste. Diese hier zaehlt.
  function alleQuelldateien(dir: string, acc: string[] = []): string[] {
    for (const eintrag of readdirSync(dir)) {
      const p = join(dir, eintrag);
      if (statSync(p).isDirectory()) alleQuelldateien(p, acc);
      else if (p.endsWith(".ts") || p.endsWith(".tsx")) acc.push(p);
    }
    return acc;
  }

  it("wird in packages/shared/src genau einmal deklariert", () => {
    const treffer = alleQuelldateien(join(__dirname, "../src")).filter((f) =>
      /^\s*export const ADEQUACY_COUNTRIES\b/m.test(readFileSync(f, "utf8")),
    );
    expect(treffer.map((f) => f.replace(/.*\/src\//, "src/"))).toEqual([
      "src/state-machines/dpms-tia.ts",
    ]);
  });
});
