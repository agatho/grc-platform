// @vitest-environment jsdom
/**
 * Die Sichtwahl über der Diagrammfläche.
 *
 * Der eigentliche Zweck dieser Datei sind die beiden Wächter am Anfang:
 *
 *  1. `GRC_VIEW_OPTIONS` wiederholt die neun Sichten, damit die Prozessseite
 *     die GRC-Schicht nicht als Wert importieren muss (sonst zöge jede
 *     Prozessseite 23 Layer in ihr Bündel). Eine Wiederholung ohne Wächter
 *     driftet — Test 1 ist der Wächter.
 *  2. [ARCTOS-FULL-2026-08-31 · OP-071] Die Beschriftungen stehen seit OP-071
 *     im Katalog und der Schlüssel wird zur Laufzeit zusammengesetzt
 *     (`grcView.views.${id}`). Für `scripts/audit-i18n-usage.mjs` ist das eine
 *     dynamische Aufrufstelle, die es bewusst nicht prüft — sonst müsste es
 *     raten. Test 2 prüft stattdessen konkret: zu jeder der neun Sichten gibt
 *     es in **beiden** Sprachen eine Beschriftung, und keine der beiden
 *     Dateien führt eine Sicht, die es nicht gibt.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GRC_VIEWS } from "@grc/bpmn/grc";
import {
  GrcViewSelect,
  GRC_VIEW_OPTIONS,
  formatStand,
} from "@/components/bpmn/grc-view-select";

// Wie in den übrigen Komponententests: die Übersetzung gibt den Schlüssel
// zurück. Was der Katalog sagt, prüft Test 2 gegen die Dateien selbst — ein
// Mock, der Text erfindet, könnte das nicht.
vi.mock("next-intl", () => ({
  useTranslations:
    (ns?: string) => (key: string, params?: Record<string, unknown>) => {
      const full = ns ? `${ns}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    },
  useLocale: () => "de",
}));

const LOCALES = ["de", "en"] as const;

function grcViewMessages(locale: string): Record<string, unknown> {
  const path = join(
    __dirname,
    "..",
    "..",
    "..",
    "messages",
    locale,
    "bpmn.json",
  );
  const bundle = JSON.parse(readFileSync(path, "utf8")) as {
    grcView?: Record<string, unknown>;
  };
  return bundle.grcView ?? {};
}

describe("GRC_VIEW_OPTIONS", () => {
  it("führt genau die Sichten der GRC-Schicht", () => {
    expect([...GRC_VIEW_OPTIONS].sort()).toEqual(Object.keys(GRC_VIEWS).sort());
  });
});

describe("Beschriftungen der Sichten", () => {
  for (const locale of LOCALES) {
    it(`nennt jede Sicht in ${locale} — und keine, die es nicht gibt`, () => {
      const messages = grcViewMessages(locale);
      const views = (messages["views"] ?? {}) as Record<string, unknown>;
      expect(Object.keys(views).sort()).toEqual([...GRC_VIEW_OPTIONS].sort());
      for (const [id, title] of Object.entries(views)) {
        expect(typeof title, `${locale}.grcView.views.${id}`).toBe("string");
        expect((title as string).trim().length).toBeGreaterThan(0);
      }
      // Die vier Zeichenketten der Umgebung, ebenfalls in beiden Sprachen.
      for (const key of ["label", "off", "loading", "error", "computedAt"]) {
        expect(typeof messages[key], `${locale}.grcView.${key}`).toBe("string");
      }
      // Die Platzhalter müssen die sein, die der Code füllt — ein fehlender
      // Platzhalter verschluckt die Ursache bzw. den Zeitstempel lautlos.
      expect(String(messages["error"])).toContain("{reason}");
      expect(String(messages["computedAt"])).toContain("{timestamp}");
    });
  }
});

describe("GrcViewSelect", () => {
  it("meldet `null` für »aus« und die Kennung für eine Sicht", () => {
    const onChange = vi.fn();
    render(<GrcViewSelect value={null} onChange={onChange} />);
    const select = screen.getByLabelText("bpmn.grcView.label");
    fireEvent.change(select, { target: { value: "privacy" } });
    expect(onChange).toHaveBeenCalledWith("privacy");
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("bietet alle neun Sichten plus »aus« an", () => {
    render(<GrcViewSelect value={null} onChange={() => undefined} />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(GRC_VIEW_OPTIONS.length + 1);
    expect(options.map((o) => (o as HTMLOptionElement).value)).toEqual([
      "",
      ...GRC_VIEW_OPTIONS,
    ]);
  });

  it("nennt den Datenstand, sobald eine Sicht aktiv ist", () => {
    render(
      <GrcViewSelect
        value="risk-control"
        onChange={() => undefined}
        computedAt="2026-09-02T10:00:00Z"
      />,
    );
    // Der Zeitstempel geht als Platzhalter durch — geprüft wird, dass er
    // formatiert ankommt und nicht als ISO-Rohwert.
    const stand = screen.getByText(/^bpmn\.grcView\.computedAt/u);
    expect(stand.textContent).not.toContain("2026-09-02T10:00:00Z");
    expect(stand.textContent).toContain(formatStand("2026-09-02T10:00:00Z"));
  });

  it("zeigt im Fehlerfall den Fehler statt eines erfundenen Standes", () => {
    render(
      <GrcViewSelect
        value="risk-control"
        onChange={() => undefined}
        error="overlay 500"
      />,
    );
    const line = screen.getByText(/^bpmn\.grcView\.error/u);
    expect(line.textContent).toContain("overlay 500");
  });

  it("sagt nichts über den Stand, solange die Sicht aus ist", () => {
    render(
      <GrcViewSelect
        value={null}
        onChange={() => undefined}
        computedAt="2026-09-02T10:00:00Z"
      />,
    );
    expect(screen.queryByText(/^bpmn\.grcView\.computedAt/u)).toBeNull();
  });

  it("gibt einen unlesbaren Zeitstempel unverändert aus statt »Invalid Date«", () => {
    expect(formatStand("kein-datum")).toBe("kein-datum");
  });
});
