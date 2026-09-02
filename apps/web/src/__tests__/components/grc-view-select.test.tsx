// @vitest-environment jsdom
/**
 * Die Sichtwahl über der Diagrammfläche.
 *
 * Der eigentliche Zweck dieser Datei ist der erste Test: `GRC_VIEW_OPTIONS`
 * wiederholt die neun Sichten, damit die Prozessseite die GRC-Schicht nicht als
 * Wert importieren muss (sonst zöge jede Prozessseite 23 Layer in ihr Bündel).
 * Eine Wiederholung ohne Wächter driftet — dieser Test ist der Wächter.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GRC_VIEWS } from "@grc/bpmn/grc";
import {
  GrcViewSelect,
  GRC_VIEW_OPTIONS,
  formatStand,
} from "@/components/bpmn/grc-view-select";

describe("GRC_VIEW_OPTIONS", () => {
  it("führt genau die Sichten der GRC-Schicht, mit deren Titeln", () => {
    expect(GRC_VIEW_OPTIONS.map((view) => view.id).sort()).toEqual(
      Object.keys(GRC_VIEWS).sort(),
    );
    for (const option of GRC_VIEW_OPTIONS) {
      expect(option.title).toBe(GRC_VIEWS[option.id].title);
    }
  });
});

describe("GrcViewSelect", () => {
  it("meldet `null` für »aus« und die Kennung für eine Sicht", () => {
    const onChange = vi.fn();
    render(<GrcViewSelect value={null} onChange={onChange} />);
    const select = screen.getByLabelText("GRC-Sicht");
    fireEvent.change(select, { target: { value: "privacy" } });
    expect(onChange).toHaveBeenCalledWith("privacy");
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("nennt den Datenstand, sobald eine Sicht aktiv ist", () => {
    render(
      <GrcViewSelect
        value="risk-control"
        onChange={() => undefined}
        computedAt="2026-09-02T10:00:00Z"
      />,
    );
    expect(screen.getByText(/^Stand: /u)).toBeTruthy();
  });

  it("zeigt im Fehlerfall den Fehler statt eines erfundenen Standes", () => {
    render(
      <GrcViewSelect
        value="risk-control"
        onChange={() => undefined}
        error="overlay 500"
      />,
    );
    expect(screen.getByText(/nicht geladen/u)).toBeTruthy();
  });

  it("sagt nichts über den Stand, solange die Sicht aus ist", () => {
    render(
      <GrcViewSelect
        value={null}
        onChange={() => undefined}
        computedAt="2026-09-02T10:00:00Z"
      />,
    );
    expect(screen.queryByText(/^Stand: /u)).toBeNull();
  });

  it("gibt einen unlesbaren Zeitstempel unverändert aus statt »Invalid Date«", () => {
    expect(formatStand("kein-datum")).toBe("kein-datum");
  });
});
