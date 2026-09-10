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

describe("Laenderlisten — genau eine Deklaration je Name im Paket", () => {
  // Der eigentliche Befund war nicht der Inhalt, sondern die ZAHL: derselbe
  // Name wurde zweimal exportiert, der Stern-Export aus `types.ts` vom
  // namentlichen Export in `index.ts` verdeckt, und die verdeckte Kopie war
  // die falsche. Eine Zusicherung auf den Inhalt haette das nie gesehen —
  // sie las ja die richtige Liste. Diese hier zaehlt.
  //
  // [Welle 8c] Die Zusicherung zaehlte bis hierher nur `ADEQUACY_COUNTRIES`.
  // `EU_EEA_COUNTRIES` lag im selben Zustand (Array in `types/eam-advanced.ts`,
  // ohne Verwender) und blieb dabei unsichtbar — bis in dieser Welle beim
  // Beheben von OP-201 eine zweite Deklaration entstand und die Verdeckung
  // wiederherstellte. Der Fehler war also nicht, dass niemand hinsah, sondern
  // dass die Zusicherung EINEN Namen fest verdrahtet hatte. Sie zaehlt jetzt
  // beide, und neue Listen werden hier eingetragen, nicht neu geschrieben.
  const LISTEN: Array<[name: string, heimat: string]> = [
    ["ADEQUACY_COUNTRIES", "src/state-machines/dpms-tia.ts"],
    ["EU_EEA_COUNTRIES", "src/state-machines/dpms-tia.ts"],
  ];

  function alleQuelldateien(dir: string, acc: string[] = []): string[] {
    for (const eintrag of readdirSync(dir)) {
      const p = join(dir, eintrag);
      if (statSync(p).isDirectory()) alleQuelldateien(p, acc);
      else if (p.endsWith(".ts") || p.endsWith(".tsx")) acc.push(p);
    }
    return acc;
  }

  const quellen = alleQuelldateien(join(__dirname, "../src")).map((f) => ({
    pfad: f.replace(/.*\/src\//, "src/"),
    inhalt: readFileSync(f, "utf8"),
  }));

  it.each(LISTEN)(
    "%s wird in packages/shared/src genau einmal deklariert",
    (name, heimat) => {
      const treffer = quellen
        .filter((q) =>
          new RegExp(`^\\s*export const ${name}\\b`, "m").test(q.inhalt),
        )
        .map((q) => q.pfad);
      expect(treffer).toEqual([heimat]);
    },
  );

  it.each(LISTEN)(
    "%s wird aus dem Barrel namentlich gereicht, nicht nur per Stern-Export",
    (name, heimat) => {
      // Die Verdeckung entsteht genau dort, wo BEIDES gilt: ein namentlicher
      // Export in `index.ts` und ein Stern-Export derselben Datei. Solange es
      // nur eine Deklaration gibt, ist der namentliche Export der eindeutige
      // Weg — und diese Zusicherung haelt fest, dass er auf die Heimatdatei
      // zeigt.
      const barrel = readFileSync(join(__dirname, "../src/index.ts"), "utf8");
      const bloecke = [
        ...barrel.matchAll(/export \{([\s\S]*?)\} from "([^"]+)";/g),
      ];
      const treffer = bloecke
        .filter(([, namen]) =>
          new RegExp(`(^|[\\s,])${name}\\s*,`, "m").test(namen ?? ""),
        )
        .map(([, , quelle]) => `src/${(quelle ?? "").replace(/^\.\//, "")}.ts`);
      expect(treffer).toEqual([heimat]);
    },
  );
});
