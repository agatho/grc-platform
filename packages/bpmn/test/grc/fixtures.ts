/**
 * Erfundene, aber plausible GRC-Daten zu echten Korpusdiagrammen.
 *
 * Die Diagramme stammen aus `test/corpus/` — also aus dem Bestand von ARCTOS
 * (Seed-SQL, PRDs, E2E-Tests) bzw. aus bewusst gebauten Härtefällen. Die
 * GRC-Daten dazu sind erfunden, aber so gewählt, wie sie in einem echten
 * Mandanten aussähen: ein Beschaffungsprozess mit einer unwirksamen Kontrolle,
 * ein Bankantrag mit einem Dienstleister im Drittland, eine Tourenplanung, deren
 * Dispositionssystem ausfällt.
 *
 * Alle Zeitangaben beziehen sich auf `AS_OF` — kein Test hängt an `Date.now()`.
 */

import type {
  GrcElementData,
  GrcOverlayData,
  GrcRoleRef,
} from "../../src/grc/contract";

/** Bezugszeitpunkt aller Fristen in den Fixtures. */
export const AS_OF = "2026-03-01T09:00:00.000Z";

function iso(daysFromAsOf: number): string {
  return new Date(Date.parse(AS_OF) + daysFromAsOf * 86_400_000).toISOString();
}

export const ROLES = {
  einkauf: { id: "role-einkauf", name: "Einkauf", short: "EK" },
  buchhaltung: { id: "role-buchhaltung", name: "Buchhaltung", short: "BH" },
  leitung: { id: "role-leitung", name: "Bereichsleitung", short: "BL" },
  vertrieb: { id: "role-vertrieb", name: "Vertrieb", short: "VT" },
  sachbearbeitung: {
    id: "role-sachbearbeitung",
    name: "Sachbearbeitung",
    short: "SB",
  },
  genehmigung: {
    id: "role-genehmigung",
    name: "Kreditentscheidung",
    short: "KE",
  },
  dispo: { id: "role-dispo", name: "Disposition", short: "DI" },
  revision: { id: "role-revision", name: "Interne Revision", short: "IR" },
} satisfies Record<string, GrcRoleRef>;

function base(elements: Record<string, GrcElementData>): GrcOverlayData {
  return {
    computedAt: AS_OF,
    ttlSeconds: 300,
    elements,
    diagram: { asOf: AS_OF },
  };
}

/* ------------------------------------------------------------------ *
 * repo-prd-sales-with-gateway — Sicht „Risiko & Kontrolle"
 * ------------------------------------------------------------------ */

/**
 * Vertriebsprozess mit einem klassischen Befund: Am Schritt „Angebot erstellen"
 * hängt ein hohes Restrisiko (Preisfreigabe), dessen einzige Kontrolle als
 * unwirksam getestet wurde. Genau der Fall, wegen dem man das Diagramm öffnet.
 */
export function salesRiskControlData(): GrcOverlayData {
  return {
    ...base({
      Task_qualify: {
        lineOfDefense: "first",
        risks: [
          {
            id: "risk-1",
            title: "Unvollständige Bedarfsaufnahme",
            residualScore: 8,
            inherentScore: 12,
            controlIds: ["ctrl-1"],
            owner: "Vertriebsleitung",
          },
        ],
        controls: [
          {
            id: "ctrl-1",
            title: "Vier-Augen-Prüfung der Anfrage",
            effectiveness: "effective",
            isKey: false,
            lastTestedAt: iso(-40),
            lastTestResult: "passed",
            lastEvidenceAt: iso(-40),
            evidenceDueAt: iso(325),
            ownerRole: ROLES.vertrieb,
          },
        ],
        raci: { responsible: ROLES.vertrieb, accountable: ROLES.leitung },
        comments: { openThreads: 2, totalThreads: 5, lastAuthor: "M. Krause" },
      },
      Gateway_1: {
        risks: [
          {
            id: "risk-2",
            title: "Fehlklassifikation qualifizierter Anfragen",
            residualScore: 6,
            controlIds: [],
          },
        ],
      },
      Task_offer: {
        lineOfDefense: "first",
        risks: [
          {
            id: "risk-3",
            title: "Angebot unter Deckungsbeitragsgrenze",
            residualScore: 16,
            inherentScore: 20,
            controlIds: ["ctrl-2"],
            owner: "Kaufmännische Leitung",
            treatment: "reduce",
          },
          {
            id: "risk-4",
            title: "Zusage nicht lieferbarer Termine",
            residualScore: 9,
            controlIds: ["ctrl-3"],
          },
        ],
        controls: [
          {
            id: "ctrl-2",
            title: "Preisfreigabe ab 50.000 €",
            effectiveness: "ineffective",
            isKey: true,
            lastTestedAt: iso(-410),
            lastTestResult: "failed",
            lastEvidenceAt: iso(-410),
            evidenceDueAt: iso(-45),
            ownerRole: ROLES.leitung,
          },
          {
            id: "ctrl-3",
            title: "Verfügbarkeitsprüfung im ERP",
            effectiveness: "effective",
            lastTestedAt: iso(-95),
            lastTestResult: "passed",
            lastEvidenceAt: iso(-95),
            evidenceDueAt: iso(270),
            ownerRole: ROLES.vertrieb,
          },
        ],
        findings: [
          {
            id: "find-1",
            title: "Preisfreigabe wird umgangen",
            severity: "critical",
            status: "open",
            dueAt: iso(-12),
          },
          {
            id: "find-2",
            title: "Angebotsvorlage veraltet",
            severity: "low",
            status: "open",
            dueAt: iso(9),
          },
        ],
        raci: {
          responsible: ROLES.vertrieb,
          accountable: ROLES.leitung,
          consulted: [ROLES.buchhaltung],
        },
        comments: { openThreads: 1, totalThreads: 1, blocking: 1 },
      },
      Task_reject: {
        lineOfDefense: "second",
        raci: { responsible: ROLES.vertrieb },
        findings: [
          {
            id: "find-3",
            title: "Absagegründe nicht dokumentiert",
            severity: "medium",
            status: "open",
          },
        ],
      },
    }),
  };
}

/* ------------------------------------------------------------------ *
 * repo-prd-procurement — Sicht „Compliance & Nachweis"
 * ------------------------------------------------------------------ */

/**
 * Beschaffungsprozess vor einer ISO-27001-Prüfung: zwei Schritte mit frischem
 * Nachweis, einer überfällig, einer ganz ohne — und eine Anforderung, die
 * nirgends abgedeckt ist.
 */
export function procurementComplianceData(): GrcOverlayData {
  const data = base({
    Task_pr: {
      controls: [
        {
          id: "c-pr-1",
          title: "Bedarfsfreigabe durch Kostenstellenverantwortliche",
          effectiveness: "effective",
          lastTestedAt: iso(-20),
          lastTestResult: "passed",
          lastEvidenceAt: iso(-20),
          evidenceDueAt: iso(345),
          ownerRole: ROLES.leitung,
        },
      ],
      frameworks: [
        {
          id: "fm-1",
          frameworkId: "iso27001",
          frameworkName: "ISO/IEC 27001:2022",
          requirementRef: "A.5.19",
          requirementTitle: "Informationssicherheit in Lieferantenbeziehungen",
          coverage: "covered",
        },
      ],
      raci: { responsible: ROLES.einkauf, accountable: ROLES.leitung },
    },
    Task_approve_pr: {
      controls: [
        {
          id: "c-ap-1",
          title: "Freigabe nach Wertgrenze",
          effectiveness: "effective",
          isKey: true,
          lastTestedAt: iso(-330),
          lastTestResult: "partial",
          lastEvidenceAt: iso(-330),
          evidenceDueAt: iso(21),
          ownerRole: ROLES.leitung,
        },
      ],
      frameworks: [
        {
          id: "fm-2",
          frameworkId: "iso27001",
          frameworkName: "ISO/IEC 27001:2022",
          requirementRef: "A.5.20",
          requirementTitle: "Sicherheitsanforderungen in Lieferantenverträgen",
          coverage: "partial",
        },
      ],
      findings: [
        {
          id: "find-p1",
          title: "Wertgrenzen seit 2024 nicht angepasst",
          severity: "medium",
          status: "open",
          dueAt: iso(30),
        },
      ],
      raci: { responsible: ROLES.leitung },
    },
    Task_rfq: {
      controls: [
        {
          id: "c-rfq-1",
          title: "Drei-Angebote-Regel",
          effectiveness: "partial",
          lastTestedAt: iso(-500),
          lastTestResult: "failed",
          lastEvidenceAt: iso(-500),
          evidenceDueAt: iso(-135),
          ownerRole: ROLES.einkauf,
        },
      ],
      frameworks: [
        {
          id: "fm-3",
          frameworkId: "iso27001",
          frameworkName: "ISO/IEC 27001:2022",
          requirementRef: "A.5.21",
          requirementTitle: "Sicherheit in der IKT-Lieferkette",
          coverage: "gap",
        },
      ],
      comments: { openThreads: 3, totalThreads: 4 },
      raci: { responsible: ROLES.einkauf },
    },
    Task_po: {
      controls: [
        {
          id: "c-po-1",
          title: "Bestellfreigabe im ERP",
          effectiveness: "untested",
          isKey: true,
          ownerRole: ROLES.einkauf,
        },
      ],
      frameworks: [
        {
          id: "fm-4",
          frameworkId: "iso27001",
          frameworkName: "ISO/IEC 27001:2022",
          requirementRef: "A.5.20",
          requirementTitle: "Sicherheitsanforderungen in Lieferantenverträgen",
          coverage: "covered",
        },
      ],
      findings: [
        {
          id: "find-p2",
          title: "Bestellung ohne Rahmenvertrag",
          severity: "high",
          status: "open",
          dueAt: iso(-3),
        },
      ],
      raci: { responsible: ROLES.einkauf, accountable: ROLES.einkauf },
    },
  });

  return {
    ...data,
    diagram: {
      ...data.diagram,
      processName: "Beschaffung",
      framework: {
        frameworkId: "iso27001",
        frameworkName: "ISO/IEC 27001:2022",
        requirementRefs: ["A.5"],
      },
    },
  };
}

/**
 * Derselbe Beschaffungsprozess, aber mit einer Aufgabentrennungsregel:
 * „Bestellung aufgeben" und „PR genehmigen" dürfen nicht in einer Hand liegen —
 * und liegen es hier, weil beide dem Einkauf zugeordnet sind.
 */
export function procurementSodData(): GrcOverlayData {
  const data = procurementComplianceData();
  return {
    ...data,
    elements: {
      ...data.elements,
      Task_approve_pr: {
        ...data.elements["Task_approve_pr"],
        raci: { responsible: ROLES.einkauf, accountable: ROLES.einkauf },
      },
    },
    diagram: {
      ...data.diagram,
      sodRules: [
        {
          id: "sod-1",
          roleAId: ROLES.einkauf.id,
          roleBId: ROLES.einkauf.id,
          severity: "critical",
          rationale:
            "Genehmigung und Bestellung dürfen nicht von derselben Rolle verantwortet werden.",
          frameworkRef: "IDW PS 261 / SOX 404",
        },
      ],
    },
  };
}

/* ------------------------------------------------------------------ *
 * synth-collaboration-pools-lanes — Sicht „Datenschutz" und „Organisation"
 * ------------------------------------------------------------------ */

/**
 * Kreditantrag einer Bank mit ausgelagerter Bonitätsprüfung: die Lane
 * „Kreditentscheidung" wird von einem Dienstleister mit Sitz in den USA
 * betrieben. Damit überschreitet der Antrag — mit Bonitätsdaten — eine
 * Vertrauensgrenze.
 */
export function bankPrivacyData(): GrcOverlayData {
  const data = base({
    Task_Bank_Pruefen: {
      ropa: {
        isProcessingActivity: true,
        purpose: "Prüfung der Kreditwürdigkeit",
        legalBasis: "Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung)",
        dataCategories: [
          { id: "dc-1", title: "Antragsdaten" },
          { id: "dc-2", title: "Bonitätsdaten" },
        ],
        retentionMonths: 120,
        retentionBasis: "§ 147 AO",
        requiresDpia: false,
      },
      comments: { openThreads: 1, totalThreads: 2 },
    },
    Task_Bank_Entscheiden: {
      ropa: {
        isProcessingActivity: true,
        purpose: "Kreditentscheidung einschließlich Scoring",
        legalBasis: "Art. 6 Abs. 1 lit. b DSGVO",
        dataCategories: [
          { id: "dc-2", title: "Bonitätsdaten" },
          {
            id: "dc-3",
            title: "Gesundheitsdaten (Restschuldversicherung)",
            isSpecialCategory: true,
          },
        ],
        retentionMonths: 6,
        retentionBasis: "Löschkonzept Ziffer 4.2",
        requiresDpia: true,
        transferThirdCountry: true,
        transferCountry: "US",
        transferSafeguard: undefined,
      },
    },
    Task_Kunde_Antrag: {
      ropa: {
        isProcessingActivity: true,
        purpose: "Antragstellung",
        dataCategories: [{ id: "dc-1", title: "Antragsdaten" }],
        retentionMonths: 24,
      },
    },
  });

  return {
    ...data,
    edges: {
      MessageFlow_1: { carriesPersonalData: true },
      MessageFlow_2: { carriesPersonalData: true },
      Flow_B2: { carriesPersonalData: true },
    },
    lanes: {
      Lane_Sachbearbeitung: {
        name: "Sachbearbeitung",
        kind: "lane",
        role: ROLES.sachbearbeitung,
        orgUnit: { id: "ou-1", title: "Kreditbearbeitung Inland" },
        trainingRatio: 0.92,
      },
      Lane_Genehmigung: {
        name: "Kreditentscheidung",
        kind: "lane",
        role: ROLES.genehmigung,
        vendor: { id: "v-1", name: "ScoreWorks Inc.", riskClass: "hoch" },
        isExternal: true,
        thirdCountry: "US",
        trainingRatio: 0.61,
      },
      Participant_Bank: { name: "Bank", kind: "pool" },
      Participant_Kunde: { name: "Kunde", kind: "pool", isExternal: true },
    },
    diagram: { ...data.diagram, processName: "Kreditantrag" },
  };
}

/**
 * Derselbe Bankprozess unter der Aufgabentrennungsfrage: Prüfung und
 * Entscheidung liegen laut RACI beide bei der Sachbearbeitung, obwohl die
 * Entscheidung in einer eigenen Lane liegt — Lane und Verantwortung
 * widersprechen sich, und genau das ist der Befund.
 */
export function bankSodData(): GrcOverlayData {
  const data = bankPrivacyData();
  return {
    ...data,
    elements: {
      ...data.elements,
      Task_Bank_Pruefen: {
        ...data.elements["Task_Bank_Pruefen"],
        lineOfDefense: "first",
        raci: {
          responsible: ROLES.sachbearbeitung,
          accountable: ROLES.sachbearbeitung,
        },
        controls: [
          {
            id: "c-bank-1",
            title: "Plausibilitätsprüfung der Antragsdaten",
            effectiveness: "effective",
            ownerRole: ROLES.sachbearbeitung,
            lastEvidenceAt: iso(-30),
          },
        ],
      },
      Task_Bank_Entscheiden: {
        ...data.elements["Task_Bank_Entscheiden"],
        raci: {
          responsible: ROLES.sachbearbeitung,
          accountable: ROLES.sachbearbeitung,
        },
      },
    },
    diagram: {
      ...data.diagram,
      sodRules: [
        {
          id: "sod-bank",
          roleAId: ROLES.sachbearbeitung.id,
          roleBId: ROLES.sachbearbeitung.id,
          severity: "high",
          rationale:
            "Antragsprüfung und Kreditentscheidung dürfen nicht in einer Hand liegen.",
          frameworkRef: "MaRisk BTO 1.1",
        },
      ],
    },
  };
}

/* ------------------------------------------------------------------ *
 * repo-seed-order-callactivity — Roll-up über die Call Activity
 * ------------------------------------------------------------------ */

/**
 * Auftragsabwicklung, die die Tourenplanung als eigenen Prozess aufruft. Der
 * aufgerufene Prozess trägt das eigentliche Risiko — im Diagramm des Aufrufers
 * ist das heute nirgends sichtbar.
 */
export function orderRollupData(): GrcOverlayData {
  return base({
    Task_OA_Annahme: {
      risks: [
        {
          id: "r-oa-1",
          title: "Auftragsdaten unvollständig erfasst",
          residualScore: 6,
          controlIds: ["c-oa-1"],
        },
      ],
      controls: [
        {
          id: "c-oa-1",
          title: "Pflichtfeldprüfung im Auftragsformular",
          effectiveness: "effective",
          lastEvidenceAt: iso(-15),
          evidenceDueAt: iso(350),
          ownerRole: ROLES.vertrieb,
        },
      ],
      raci: { responsible: ROLES.vertrieb },
      comments: { openThreads: 1, totalThreads: 3 },
    },
    CallActivity_OA_Touren: {
      calledProcess: {
        processId: "proc-1405",
        name: "Tourenplanung",
        rollup: {
          riskCount: 3,
          maxResidualScore: 20,
          residualScoreSum: 34,
          coverageRatio: 0.35,
          openFindings: 2,
        },
      },
      raci: { responsible: ROLES.dispo, accountable: ROLES.leitung },
    },
    Task_OA_Auslieferung: {
      risks: [
        {
          id: "r-oa-2",
          title: "Auslieferung ohne Empfangsbestätigung",
          residualScore: 12,
          controlIds: [],
        },
      ],
      findings: [
        {
          id: "f-oa-1",
          title: "Empfangsbestätigungen fehlen stichprobenweise",
          severity: "high",
          status: "open",
          dueAt: iso(5),
        },
      ],
      lineOfDefense: "first",
    },
  });
}

/* ------------------------------------------------------------------ *
 * repo-seed-tour-planning — Ausfallsimulation
 * ------------------------------------------------------------------ */

/**
 * Tourenplanung, deren Dispositionssystem ausfällt: „Route optimieren" hängt
 * direkt daran, „Fahrzeuge disponieren" hat ein Ausweichverfahren, das vier
 * Stunden trägt.
 */
export function tourOutageData(): GrcOverlayData {
  const data = base({
    Task_TP_Route: {
      assets: [
        {
          id: "asset-dispo",
          title: "DispoSuite",
          criticality: "very_high",
          cia: "H/H/H",
          openVulnerabilities: 2,
        },
      ],
      bia: {
        criticality: "very_high",
        mtpdMinutes: 240,
        rtoMinutes: 120,
        rpoMinutes: 15,
      },
      risks: [
        {
          id: "r-tp-1",
          title: "Routen nicht planbar bei Systemausfall",
          residualScore: 20,
          controlIds: [],
        },
      ],
      raci: { responsible: ROLES.dispo },
    },
    Task_TP_Dispo: {
      assets: [
        { id: "asset-erp", title: "ERP", criticality: "high", cia: "H/M/M" },
      ],
      bia: {
        criticality: "high",
        mtpdMinutes: 480,
        rtoMinutes: 240,
        rpoMinutes: 60,
        workaround: "Manuelle Disposition über Telefonliste",
        workaroundMaxDurationMinutes: 240,
      },
      raci: { responsible: ROLES.dispo, accountable: ROLES.leitung },
      comments: { openThreads: 2, totalThreads: 2 },
    },
    End_1405: {
      bia: { criticality: "medium", mtpdMinutes: 720 },
    },
  });

  return {
    ...data,
    diagram: {
      ...data.diagram,
      processName: "Tourenplanung",
      outage: {
        assetId: "asset-dispo",
        assetName: "DispoSuite",
        elapsedMinutes: 135,
      },
    },
  };
}

/* ------------------------------------------------------------------ *
 * synth-collaboration-pools-lanes — Risikokonzentration je Lane
 * ------------------------------------------------------------------ */

/**
 * Risiken an den beiden Bankaktivitäten. Sie liegen in verschiedenen Lanes
 * desselben Pools — damit lässt sich die Risikokonzentration je Lane und je Pool
 * zeigen (§3.4/A1: „Eine Lane zeigt die Risikokonzentration ihrer Aktivitäten").
 */
export function laneRiskConcentrationData(): GrcOverlayData {
  const data = base({
    Task_Bank_Pruefen: {
      risks: [
        {
          id: "r-n-2",
          title: "Antragsdaten nicht plausibilisiert",
          residualScore: 7,
          controlIds: ["c-n-2"],
        },
      ],
      controls: [
        {
          id: "c-n-2",
          title: "Plausibilitätsprüfung",
          effectiveness: "effective",
          lastEvidenceAt: iso(-10),
          evidenceDueAt: iso(355),
          ownerRole: ROLES.sachbearbeitung,
        },
      ],
      comments: { openThreads: 1, totalThreads: 1 },
    },
    Task_Bank_Entscheiden: {
      risks: [
        {
          id: "r-n-1",
          title: "Kreditentscheidung ohne Vier-Augen-Prinzip",
          residualScore: 18,
          controlIds: ["c-n-1"],
        },
      ],
      controls: [
        {
          id: "c-n-1",
          title: "Zweitvotum ab 100.000 €",
          effectiveness: "ineffective",
          isKey: true,
          lastEvidenceAt: iso(-200),
          evidenceDueAt: iso(-20),
          ownerRole: ROLES.genehmigung,
        },
      ],
      raci: { responsible: ROLES.genehmigung },
    },
  });
  return {
    ...data,
    lanes: {
      Lane_Sachbearbeitung: {
        name: "Sachbearbeitung",
        kind: "lane",
        role: ROLES.sachbearbeitung,
      },
      Lane_Genehmigung: {
        name: "Kreditentscheidung",
        kind: "lane",
        role: ROLES.genehmigung,
      },
    },
  };
}

/* ------------------------------------------------------------------ *
 * synth-large-flat-process — Conformance und Slot-Budget
 * ------------------------------------------------------------------ */

/**
 * 60 Aktivitäten, sechs Objektarten gleichzeitig: der Belastungsfall für das
 * Slot-Budget aus §3.3.2 und zugleich die Conformance-Heatmap mit ausgewiesener
 * Abdeckungsquote.
 */
export function largeProcessData(): GrcOverlayData {
  const elements: Record<string, GrcElementData> = {};
  const edges: Record<
    string,
    { frequency?: number; observation?: "observed" | "unobserved" }
  > = {};

  for (let i = 0; i < 60; i += 1) {
    const id = `L_T${String(i)}`;
    const mapped = i % 11 !== 7;
    elements[id] = {
      ...(i % 3 === 0
        ? {
            risks: [
              {
                id: `r-l-${String(i)}`,
                title: `Verarbeitungsfehler in Schritt ${String(i + 1)}`,
                residualScore: i % 7 === 0 ? 16 : 6 + (i % 5),
                controlIds: i % 6 === 0 ? [] : [`c-l-${String(i)}`],
              },
            ],
            controls:
              i % 6 === 0
                ? []
                : [
                    {
                      id: `c-l-${String(i)}`,
                      title: `Prüfschritt ${String(i + 1)}`,
                      effectiveness: i % 9 === 0 ? "partial" : "effective",
                      lastEvidenceAt: iso(-30 - (i % 90)),
                      evidenceDueAt: iso(120 - (i % 200)),
                      ownerRole: ROLES.buchhaltung,
                    },
                  ],
          }
        : {}),
      ...(i % 5 === 0
        ? {
            findings: [
              {
                id: `f-l-${String(i)}`,
                title: `Abweichung an Schritt ${String(i + 1)}`,
                severity: i % 10 === 0 ? "high" : "medium",
                status: "open",
                dueAt: iso(i % 10 === 0 ? -5 : 20),
              },
            ],
          }
        : {}),
      ...(i % 4 === 0 ? { comments: { openThreads: 1, totalThreads: 2 } } : {}),
      ...(i % 2 === 0
        ? {
            simulation: {
              durationMinutes: 5 + (i % 40),
              costPerExecution: 4 + (i % 25),
              executions: 800 + i * 13,
            },
          }
        : {}),
      conformance: {
        matchKind: mapped ? (i % 4 === 1 ? "normalized" : "exact") : "unmapped",
        observedCases: mapped ? 1200 - i * 7 : undefined,
        meanDurationMinutes: mapped ? 10 + ((i * 17) % 300) : undefined,
        isBottleneck: i === 23 || i === 41,
        reworkLoops: i === 12 ? 3 : undefined,
      },
      ...(i % 8 === 0
        ? {
            ropa: {
              isProcessingActivity: true,
              dataCategories: [{ id: "dc-l", title: "Kundendaten" }],
              retentionMonths: i % 16 === 0 ? 6 : 36,
            },
          }
        : {}),
      raci: {
        responsible: i % 2 === 0 ? ROLES.buchhaltung : ROLES.einkauf,
      },
    };
  }

  for (let i = 0; i < 61; i += 1) {
    edges[`L_F${String(i)}`] = {
      frequency: i === 30 ? 0 : 1200 - i * 9,
      observation: i === 30 ? "unobserved" : "observed",
    };
  }

  return {
    computedAt: AS_OF,
    elements,
    edges,
    diagram: {
      asOf: AS_OF,
      processName: "Großer Prozess",
      conformance: {
        coverageRatio: 0.87,
        unmappedActivities: ["Schritt 8", "Schritt 19", "Schritt 30"],
        totalTraces: 12_400,
        conformantTraces: 10_100,
        deviations: [
          {
            fromElementId: "L_T3",
            toElementId: "L_T9",
            frequency: 1488,
            share: 0.12,
          },
        ],
      },
    },
  };
}

/** Derselbe große Prozess, aber ohne ausgewiesene Abdeckungsquote (§3.8). */
export function largeProcessWithoutCoverage(): GrcOverlayData {
  const data = largeProcessData();
  const conformance = data.diagram?.conformance;
  return {
    ...data,
    diagram: {
      ...data.diagram,
      conformance: {
        ...conformance,
        coverageRatio: undefined,
      },
    },
  };
}

/* ------------------------------------------------------------------ *
 * repo-seed-goods-receipt — Aufbewahrung/Löschung
 * ------------------------------------------------------------------ */

export function goodsReceiptRetentionData(): GrcOverlayData {
  return base({
    Task_WE_Annahme: {
      ropa: {
        isProcessingActivity: true,
        purpose: "Wareneingangserfassung mit Fahrerdaten",
        legalBasis: "Art. 6 Abs. 1 lit. f DSGVO",
        dataCategories: [
          { id: "dc-fahrer", title: "Fahrerdaten" },
          { id: "dc-liefer", title: "Lieferscheindaten" },
        ],
        retentionMonths: 3,
        retentionBasis: "Löschkonzept Ziffer 7.1",
      },
      documents: [{ id: "doc-1", title: "AA-WE-001 Wareneingang" }],
      comments: { openThreads: 1, totalThreads: 1 },
    },
    Task_WE_Sortierung: {
      ropa: {
        isProcessingActivity: false,
        retentionMonths: 132,
        retentionBasis: "§ 257 HGB",
      },
      documents: [{ id: "doc-2", title: "AA-WE-002 Behandlungsklassen" }],
    },
  });
}
