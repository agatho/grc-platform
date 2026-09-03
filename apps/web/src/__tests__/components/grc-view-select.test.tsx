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
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { GRC_VIEWS } from "@grc/bpmn/grc";
import {
  GrcViewSelect,
  GRC_VIEW_OPTIONS,
  GRC_VIEWS_WITH_FRAMEWORK,
  formatStand,
} from "@/components/bpmn/grc-view-select";

// [ARCTOS-FULL-2026-08-31 · OP-003] Die Komponente liest die Prozesskennung
// notfalls aus der Route. Ohne Prozessbezug tut sie nichts — genau das ist der
// Zustand der meisten Tests hier.
vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
}));
let mockParams: Record<string, string> = {};

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

/** Antworten des Vorlieben- und des Overlay-Endpunkts, je Test gesetzt. */
let fetchCalls: { url: string; init?: RequestInit }[] = [];
let preferenceBody: unknown = {
  data: { activeView: null, frameworkCode: null },
};
let overlayBody: unknown = { data: { elements: {} } };

beforeEach(() => {
  mockParams = {};
  fetchCalls = [];
  preferenceBody = { data: { activeView: null, frameworkCode: null } };
  overlayBody = { data: { elements: {} } };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      fetchCalls.push({ url, ...(init ? { init } : {}) });
      const body = url.includes("/preference") ? preferenceBody : overlayBody;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      } as Response);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

describe("GRC_VIEWS_WITH_FRAMEWORK", () => {
  it("nennt genau die Sichten, die den Layer `framework` fuehren", () => {
    // [ARCTOS-FULL-2026-08-31 · OP-016] Der Waechter zur zweiten bewussten
    // Wiederholung. Ein Rahmenwerk in einer Sicht anzubieten, die den
    // framework-Layer gar nicht aktiviert, waere ein Bedienelement ohne
    // Wirkung — und ein Rahmenwerk NICHT anzubieten, wo er aktiv ist, liesse
    // den Abdeckungsgrad in der Kopfzeile dauerhaft leer.
    const mitFramework = Object.values(GRC_VIEWS)
      .filter((view) => view.layers.includes("framework"))
      .map((view) => view.id)
      .sort();
    expect([...GRC_VIEWS_WITH_FRAMEWORK].sort()).toEqual(mitFramework);
  });
});

describe("Sichtwahl mit Gedaechtnis (OP-003)", () => {
  it("fragt ohne Prozessbezug niemanden", async () => {
    render(<GrcViewSelect value={null} onChange={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByLabelText("bpmn.grcView.label")).toBeTruthy();
    });
    expect(fetchCalls).toHaveLength(0);
  });

  it("laedt die gespeicherte Sicht und wendet sie an", async () => {
    mockParams = { id: "p-1" };
    preferenceBody = {
      data: { activeView: "privacy", frameworkCode: null },
    };
    const onChange = vi.fn();
    render(<GrcViewSelect value={null} onChange={onChange} />);
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("privacy");
    });
    expect(fetchCalls[0]?.url).toBe(
      "/api/v1/processes/p-1/diagram-overlay/preference",
    );
  });

  it("ueberschreibt eine bereits getroffene Wahl NICHT", async () => {
    // Eine Voreinstellung, die die ausdrueckliche Wahl derselben Sitzung
    // zurueckdreht, waere eine Oberflaeche, die die eigene Eingabe zuruecknimmt.
    mockParams = { id: "p-1" };
    preferenceBody = { data: { activeView: "privacy", frameworkCode: null } };
    const onChange = vi.fn();
    render(<GrcViewSelect value="continuity" onChange={onChange} />);
    await waitFor(() => {
      expect(fetchCalls.length).toBeGreaterThan(0);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("speichert jede Wahl — auch das Ausschalten", async () => {
    mockParams = { id: "p-1" };
    render(<GrcViewSelect value={null} onChange={() => undefined} />);
    await waitFor(() => expect(fetchCalls.length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText("bpmn.grcView.label"), {
      target: { value: "compliance" },
    });
    await waitFor(() => {
      expect(fetchCalls.some((c) => c.init?.method === "PUT")).toBe(true);
    });
    const put = fetchCalls.find((c) => c.init?.method === "PUT");
    expect(JSON.parse(String(put?.init?.body))).toEqual({
      activeView: "compliance",
      frameworkCode: null,
    });

    // Ausschalten ist auch eine Wahl. Wuerde sie nicht gespeichert, kaeme die
    // Sicht bei jedem Seitenaufruf ungefragt zurueck.
    fireEvent.change(screen.getByLabelText("bpmn.grcView.label"), {
      target: { value: "" },
    });
    await waitFor(() => {
      const puts = fetchCalls.filter((c) => c.init?.method === "PUT");
      expect(puts.length).toBe(2);
      expect(JSON.parse(String(puts[1]?.init?.body))).toEqual({
        activeView: null,
        frameworkCode: null,
      });
    });
  });

  it("bleibt bedienbar, wenn der Vorlieben-Endpunkt scheitert", async () => {
    // Eine Anzeigevoreinstellung ist kein Nachweis (0452). Ein Fehlschlag darf
    // die Diagrammflaeche nicht anhalten.
    mockParams = { id: "p-1" };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("netz weg"))),
    );
    const onChange = vi.fn();
    render(<GrcViewSelect value={null} onChange={onChange} />);
    const select = screen.getByLabelText("bpmn.grcView.label");
    fireEvent.change(select, { target: { value: "privacy" } });
    expect(onChange).toHaveBeenCalledWith("privacy");
  });
});

describe("Rahmenwerkauswahl (OP-016)", () => {
  const FRAMEWORKS = {
    data: {
      elements: {
        Task_1: {
          frameworks: [
            {
              frameworkId: "iso-27001",
              frameworkName: "ISO/IEC 27001:2022 Annex A",
            },
            { frameworkId: "eu-dora", frameworkName: "EU DORA" },
          ],
        },
      },
    },
  };

  it("zeigt kein Feld in einer Sicht ohne framework-Layer", async () => {
    mockParams = { id: "p-1" };
    overlayBody = FRAMEWORKS;
    render(<GrcViewSelect value="privacy" onChange={() => undefined} />);
    await waitFor(() => expect(fetchCalls.length).toBeGreaterThan(0));
    expect(screen.queryByLabelText("bpmn.grcView.frameworkLabel")).toBeNull();
    // Und holt die Liste gar nicht erst.
    expect(fetchCalls.some((c) => c.url.includes("layers=framework"))).toBe(
      false,
    );
  });

  it("bietet in der Compliance-Sicht die zugeordneten Rahmenwerke an", async () => {
    mockParams = { id: "p-1" };
    overlayBody = FRAMEWORKS;
    render(<GrcViewSelect value="compliance" onChange={() => undefined} />);
    const select = await screen.findByLabelText("bpmn.grcView.frameworkLabel");
    const values = Array.from(select.querySelectorAll("option")).map(
      (o) => (o as HTMLOptionElement).value,
    );
    // Nach Anzeigename sortiert, „alle" zuerst.
    expect(values).toEqual(["", "eu-dora", "iso-27001"]);
  });

  it("zeigt kein Feld, wenn der Prozess kein Rahmenwerk zuordnet", async () => {
    // Eine Auswahlliste, die man nicht belegen kann, ist schlechter als keine.
    mockParams = { id: "p-1" };
    overlayBody = { data: { elements: {} } };
    render(<GrcViewSelect value="compliance" onChange={() => undefined} />);
    await waitFor(() => {
      expect(fetchCalls.some((c) => c.url.includes("layers=framework"))).toBe(
        true,
      );
    });
    expect(screen.queryByLabelText("bpmn.grcView.frameworkLabel")).toBeNull();
  });

  it("speichert die Wahl und bittet um einen neuen Datensatz", async () => {
    mockParams = { id: "p-1" };
    overlayBody = FRAMEWORKS;
    const onReload = vi.fn();
    render(
      <GrcViewSelect
        value="compliance"
        onChange={() => undefined}
        onReloadRequest={onReload}
      />,
    );
    const select = await screen.findByLabelText("bpmn.grcView.frameworkLabel");
    fireEvent.change(select, { target: { value: "iso-27001" } });
    await waitFor(() => {
      expect(fetchCalls.some((c) => c.init?.method === "PUT")).toBe(true);
    });
    const put = fetchCalls.find((c) => c.init?.method === "PUT");
    expect(JSON.parse(String(put?.init?.body))).toEqual({
      activeView: "compliance",
      frameworkCode: "iso-27001",
    });
    // Ohne erneutes Holen bliebe `diagram.framework` im Datensatz das alte.
    expect(onReload).toHaveBeenCalled();
  });
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
