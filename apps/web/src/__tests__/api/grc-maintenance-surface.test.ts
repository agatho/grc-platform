// grc-maintenance-surface.test.ts — der Wächter zu OP-001.
//
// [ARCTOS-FULL-2026-08-31 · OP-001]
//
// Der Befund ist eine FEHLENDE Fläche, kein falscher Wert. Ein Wächter darüber
// muss deshalb zweierlei können:
//
//   A  **Die Fläche festhalten, die es jetzt gibt** — Seite, Leseroute,
//      Schreibroute und ein Verweis, der die Seite erreichbar macht. Der
//      letzte Punkt ist nicht formal: `processes/[id]/racm` ist gebaut, ohne
//      i18n und von KEINER Stelle im Baum verlinkt — gemessen an `c635a970`
//      nennen nur die Seite selbst, drei Tests und `audit-pack/route.ts` das
//      Wort „racm", und keiner davon ist ein Verweis, dem ein Benutzer folgen
//      koennte. Eine Pflegeoberflaeche, die niemand findet, pflegt nichts.
//   B  **Den Rest ehrlich führen.** Sechs der zehn Tabellen haben weiterhin
//      keine Maske. Die Liste steht hier und MUSS schrumpfen — trägt eine
//      Tabelle eine Maske, wird der Test rot, bis der Eintrag verschwindet.
//
// Dazu die beiden Umrechnungen, an denen ein `||` statt `??` eine Aussage in
// eine Lücke verwandelt hätte.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  createSodRuleSchema,
  putStepBiaSchema,
  updateProcessLaneSchema,
} from "@grc/shared";
import {
  biaValuesFrom,
  lanePatchFrom,
} from "@/app/api/v1/processes/_lib/grc-maintenance";

const SRC = join(__dirname, "../..");
const APP = join(SRC, "app");

/** Die vier gebauten Masken: Tabelle → Seite, Leseroute, Schreibroute. */
const GEBAUT = [
  {
    table: "process_lane",
    page: "app/(dashboard)/processes/[id]/lanes/page.tsx",
    read: "app/api/v1/processes/[id]/lanes/route.ts",
    write: "app/api/v1/processes/[id]/lanes/[laneId]/route.ts",
    href: "/lanes",
  },
  {
    table: "sod_rule",
    page: "app/(dashboard)/processes/sod-rules/page.tsx",
    read: "app/api/v1/processes/sod-rules/route.ts",
    write: "app/api/v1/processes/sod-rules/[ruleId]/route.ts",
    href: "/processes/sod-rules",
  },
  {
    table: "process_step_raci",
    page: "app/(dashboard)/processes/[id]/step-raci/page.tsx",
    read: "app/api/v1/processes/[id]/step-raci/route.ts",
    write: "app/api/v1/processes/[id]/step-raci/[stepId]/route.ts",
    href: "/step-raci",
  },
  {
    table: "process_step_bia",
    page: "app/(dashboard)/processes/[id]/step-bia/page.tsx",
    read: "app/api/v1/processes/[id]/step-bia/route.ts",
    write: "app/api/v1/processes/[id]/step-bia/[stepId]/route.ts",
    href: "/step-bia",
  },
] as const;

/**
 * Die zurückgestellten sechs, mit dem Grund in einem Satz. Die Liste ist eine
 * Übergabe, keine Duldung: sie MUSS schrumpfen, und der Test sagt es, sobald
 * eine dieser Tabellen eine Maske bekommt.
 */
const ZURUECKGESTELLT: ReadonlyArray<{ table: string; grund: string }> = [
  {
    table: "process_step_ropa",
    grund:
      "Drei Tabellen in einem Zug (ROPA, Datenkategorien, Empfänger) — das nächste Arbeitspaket, nicht das nebenbei erledigte.",
  },
  {
    table: "process_step_data_category",
    grund:
      "Fachlich eine Einheit mit process_step_ropa (Migration 0448) — die Kategoriechips sind ohne die ROPA-Zeile darüber nicht darstellbar.",
  },
  {
    table: "process_step_recipient",
    grund:
      "Fachlich eine Einheit mit process_step_ropa; polymorph über kind (vendor|org_unit) und damit zwei Auswahllisten in einer Maske.",
  },
  {
    table: "process_step_document",
    grund:
      "Braucht die Dokumentauswahl aus dem DMS; die Verknüpfung ist ON DELETE RESTRICT und damit ein Nachweis, keine Beschriftung.",
  },
  {
    table: "process_event_activity_map",
    grund:
      "Wird maschinell befüllt (ein Import mit 400 Aktivitätsnamen erzeugt 400 Zeilen); die Maske korrigiert nur — sie hat ohne einen Importpfad nichts zu zeigen.",
  },
  {
    table: "user_diagram_preference",
    grund:
      "Der Schreiber gehört in `components/bpmn/grc-view-select.tsx` — fremde Dateihoheit in dieser Welle (OP-003).",
  },
];

/** Alle zehn Tabellen aus STUFE2-E §6.4. */
const ZEHN = [
  "process_lane",
  "sod_rule",
  "process_step_raci",
  "process_step_ropa",
  "process_step_data_category",
  "process_step_recipient",
  "process_step_bia",
  "process_step_document",
  "process_event_activity_map",
  "user_diagram_preference",
] as const;

describe("OP-001 · Teil A — die gebaute Fläche", () => {
  it.each(GEBAUT)(
    "$table hat Seite, Leseroute und Schreibroute",
    ({ page, read, write }) => {
      expect(existsSync(join(SRC, page)), page).toBe(true);
      expect(existsSync(join(SRC, read)), read).toBe(true);
      expect(existsSync(join(SRC, write)), write).toBe(true);
    },
  );

  it.each(GEBAUT)("$table: die Seite ist übersetzt", ({ page }) => {
    const src = readFileSync(join(SRC, page), "utf8");
    // Die i18n-Ratsche zählt Dateien ohne `useTranslations`. Ein neuer
    // Verstoss hier risse sie — und zwar erst im CI-Lauf. Hier bricht er sofort.
    expect(src).toMatch(/useTranslations\("processGrc"\)/);
  });

  it.each(GEBAUT)(
    "$table: die Seite lädt über den Vertragsclient, nicht über nacktes fetch",
    ({ page }) => {
      const src = readFileSync(join(SRC, page), "utf8");
      expect(src).toMatch(/from "@\/lib\/api-client"/);
      // OP-050: ein nacktes `fetch(` ohne Statusprüfung ist der Weg, auf dem
      // aus einem 422 eine leere Liste wird. Diese vier Seiten dürfen ihn
      // nicht nehmen.
      expect(src).not.toMatch(/[^a-zA-Z.]fetch\(/);
    },
  );

  it.each(GEBAUT)(
    "$table: die Seite zeigt im Fehlerfall den Fehler, nicht den Leerzustand",
    ({ page }) => {
      const src = readFileSync(join(SRC, page), "utf8");
      expect(src).toMatch(/ErrorRetry/);
    },
  );

  it("die Prozessseite verlinkt alle vier Masken", () => {
    const detail = readFileSync(
      join(APP, "(dashboard)/processes/[id]/page.tsx"),
      "utf8",
    );
    for (const { href, table } of GEBAUT) {
      expect(detail, `${table}: kein Verweis auf ${href}`).toContain(href);
    }
  });

  it("die Schreibrouten laufen im Audit-Rahmen", () => {
    // Neun der zehn Tabellen hängen am `audit_trigger` (STUFE2-E §1). Ohne
    // `withAuditContext` stünde die Änderung ohne Urheber in einer
    // hashverketteten Tabelle — der Nachweis wäre da und unbrauchbar.
    for (const { write } of GEBAUT) {
      const src = readFileSync(join(SRC, write), "utf8");
      expect(src, write).toMatch(/withAuditContext/);
      expect(src, write).toMatch(/withErrorHandler/);
    }
  });
});

describe("OP-001 · Teil B — was zurückgestellt ist, ist benannt", () => {
  it("gebaut + zurückgestellt ergibt genau die zehn Tabellen", () => {
    const abgedeckt = [
      ...GEBAUT.map((g) => g.table),
      ...ZURUECKGESTELLT.map((z) => z.table),
    ].sort();
    expect(abgedeckt).toEqual([...ZEHN].sort());
  });

  it("jede zurückgestellte Tabelle trägt einen Grund", () => {
    for (const z of ZURUECKGESTELLT) {
      expect(z.grund.length, z.table).toBeGreaterThan(30);
    }
  });

  it("keine zurückgestellte Tabelle hat heimlich doch eine Maske", () => {
    // Sobald jemand eine baut, wird dieser Test rot — und der Eintrag muss
    // aus der Übergabeliste verschwinden. Eine Ausnahmeliste, die nicht
    // schrumpfen muss, ist keine.
    const alleRouten: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name === "route.ts") alleRouten.push(p);
      }
    };
    walk(join(APP, "api/v1/processes"));

    const schreibend = alleRouten.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /export const (POST|PUT|PATCH|DELETE)/.test(src);
    });
    for (const z of ZURUECKGESTELLT) {
      const camel = z.table.replace(/_([a-z])/g, (_, c: string) =>
        c.toUpperCase(),
      );
      const treffer = schreibend.filter((f) =>
        new RegExp(`\\b${camel}\\b`).test(readFileSync(f, "utf8")),
      );
      expect(treffer, `${z.table} hat jetzt eine Schreibroute`).toEqual([]);
    }
  });
});

describe("OP-001 · Teil C — die beiden Umrechnungen", () => {
  it("lanePatchFrom fasst nur an, was im Aufruf stand", () => {
    const actor = { userId: "u1", now: new Date(0) };
    // Nur `isExternal` gesetzt: der Dienstleister darf NICHT mitgelöscht
    // werden. Genau das täte ein `{ vendorId: v.vendorId ?? null, … }`.
    const patch = lanePatchFrom({ isExternal: true }, actor);
    expect(Object.keys(patch).sort()).toEqual([
      "isExternal",
      "updatedAt",
      "updatedBy",
    ]);
    expect("vendorId" in patch).toBe(false);
  });

  it("lanePatchFrom unterscheidet null (löschen) von fehlend (unverändert)", () => {
    const actor = { userId: "u1", now: new Date(0) };
    expect(lanePatchFrom({ vendorId: null }, actor).vendorId).toBeNull();
    expect("vendorId" in lanePatchFrom({}, actor)).toBe(false);
  });

  it("lanePatchFrom normalisiert das Länderkürzel auf Grossbuchstaben", () => {
    const actor = { userId: "u1", now: new Date(0) };
    // `char(2)` in 0444 — „us" und „US" wären sonst zwei Drittländer.
    expect(
      lanePatchFrom({ thirdCountry: "us" as string }, actor).thirdCountry,
    ).toBe("US");
  });

  it("biaValuesFrom laesst 0 durch: 0 heisst 'traegt nicht', nicht 'leer'", () => {
    const eingabe = {
      criticality: "high" as const,
      workaroundMaxDurationMinutes: 0,
      rpoMinutes: 0,
    };
    const v = biaValuesFrom(eingabe);
    expect(v.workaroundMaxDurationMinutes).toBe(0);
    expect(v.rpoMinutes).toBe(0);

    // [ARCTOS-FULL-2026-08-31 / Welle 4b-5 · OP-173] Der Gegenbeweis — an
    // derselben Eingabe statt an einem Literal.
    //
    // Hier stand `expect(0 || null).toBeNull()`. Das war eine Aussage ueber
    // JavaScript, nicht ueber `biaValuesFrom`: die Zeile waere auch dann gruen
    // geblieben, wenn die Funktion `|| null` benutzt haette, ja sogar dann,
    // wenn es sie gar nicht mehr gaebe. ESLint hat genau das als
    // `no-constant-binary-expression` gemeldet („Unexpected constant truthiness
    // on the left-hand side of a `||` expression") — die Regel benennt eine
    // Zusicherung, die nicht fallen kann.
    //
    // Jetzt laeuft dieselbe Eingabe durch die falsche Normalisierung, und der
    // Test behauptet den UNTERSCHIED. Faellt `biaValuesFrom` auf `|| null`
    // zurueck, wird aus dem Unterschied Gleichheit und die beiden letzten
    // Zusicherungen reissen.
    const mitOderNull = (n: number | undefined) => n || null;
    expect(mitOderNull(eingabe.rpoMinutes)).toBeNull();
    expect(mitOderNull(eingabe.workaroundMaxDurationMinutes)).toBeNull();
    expect(v.rpoMinutes).not.toBe(mitOderNull(eingabe.rpoMinutes));
    expect(v.workaroundMaxDurationMinutes).not.toBe(
      mitOderNull(eingabe.workaroundMaxDurationMinutes),
    );
  });

  it("biaValuesFrom macht aus fehlenden Angaben null, nicht undefined", () => {
    const v = biaValuesFrom({ criticality: "low" });
    expect(v.mtpdMinutes).toBeNull();
    expect(v.workaround).toBeNull();
    expect(v.biaAssessmentId).toBeNull();
  });
});

describe("OP-001 · Teil D — die Verträge der Masken", () => {
  it("die SoD-Selbstpaarung ist zulässig — sie IST der Verstoss", () => {
    // STUFE2-A2-GRC.md §7.3 verbietet ein `CHECK (role_a_id <> role_b_id)`
    // ausdrücklich. Ein `refine` im Schema wäre dieselbe Sperre eine Schicht
    // höher und hätte `computeSod` stumm entwertet.
    const same = "11111111-1111-4111-8111-111111111111";
    const parsed = createSodRuleSchema.safeParse({
      roleAId: same,
      roleBId: same,
    });
    expect(parsed.success).toBe(true);
  });

  it("ein Drittland ohne die Markierung 'extern' wird abgelehnt", () => {
    // F5 zöge daraus eine Vertrauensgrenze, die die Maske gerade verneint hat.
    expect(
      updateProcessLaneSchema.safeParse({
        thirdCountry: "US",
        isExternal: false,
      }).success,
    ).toBe(false);
    expect(
      updateProcessLaneSchema.safeParse({
        thirdCountry: "US",
        isExternal: true,
      }).success,
    ).toBe(true);
  });

  it("ein leerer Lane-PATCH wird abgelehnt", () => {
    expect(updateProcessLaneSchema.safeParse({}).success).toBe(false);
  });

  it("das Länderkürzel muss ISO-3166-1 alpha-2 sein", () => {
    expect(
      updateProcessLaneSchema.safeParse({
        thirdCountry: "USA",
        isExternal: true,
      }).success,
    ).toBe(false);
    expect(
      updateProcessLaneSchema.safeParse({
        thirdCountry: "us",
        isExternal: true,
      }).success,
    ).toBe(false);
  });

  it("die BIA-Kritikalität ist Pflicht und hat keinen Vorgabewert", () => {
    // STUFE2-E §1.5: „ein Vorgabewert wäre hier eine Behauptung."
    expect(putStepBiaSchema.safeParse({}).success).toBe(false);
    const parsed = putStepBiaSchema.safeParse({ criticality: "medium" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.criticality).toBe("medium");
    }
  });

  it("negative Minuten werden abgelehnt, 0 nicht", () => {
    expect(
      putStepBiaSchema.safeParse({ criticality: "low", rtoMinutes: -1 })
        .success,
    ).toBe(false);
    expect(
      putStepBiaSchema.safeParse({
        criticality: "low",
        workaroundMaxDurationMinutes: 0,
      }).success,
    ).toBe(true);
  });
});
