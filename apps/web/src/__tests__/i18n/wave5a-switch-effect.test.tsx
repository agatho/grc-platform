// @vitest-environment jsdom
/**
 * [ARCTOS-FULL-2026-08-31 / Welle 5a · OP-070]
 *
 * OP-070 sagt: „Das Produkt fuehrt zwei Sprachen und einen Sprachumschalter;
 * auf diesen Seiten wirkt er nicht." Alle anderen Pruefungen dieser Welle
 * lesen Quelltext. Diese hier RENDERT — zweimal, einmal je Sprache — und
 * vergleicht, was auf dem Bildschirm steht. Das ist die einzige Form, in der
 * sich die Aussage von OP-070 direkt widerlegen laesst.
 *
 * Geprueft werden die drei Bausteine mit der groessten Reichweite:
 *
 *   `LegalFooter`  steht in `app/layout.tsx` und damit unter JEDER Seite.
 *   `DataTable`    traegt 27 Listenansichten — und zeigte einem deutschen
 *                  Nutzer ENGLISCHEN Rahmen („No results.", „Page x of y").
 *   `LocaleSwitcher` ist der Umschalter selbst, den externe Besucher bis
 *                  zu dieser Welle gar nicht hatten.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { readFileSync } from "node:fs";
import path from "node:path";

import { LegalFooter } from "@/components/layout/legal-footer";
import { DataTable } from "@/components/ui/data-table";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useParams: () => ({}),
}));

const MESSAGES = path.join(__dirname, "../../../messages");

/**
 * Baut den Nachrichtenbaum GENAU so, wie `src/i18n/request.ts` es tut:
 * `common.json` einmal in die Wurzel gespreizt und einmal als `common`
 * gefuehrt, mit dem verschachtelten `common`-Knoten hineingemischt. Wer hier
 * abkuerzt, testet einen Baum, den die Anwendung nie sieht.
 */
function messagesFor(locale: string): Record<string, unknown> {
  const read = (ns: string) =>
    JSON.parse(
      readFileSync(path.join(MESSAGES, locale, `${ns}.json`), "utf8"),
    ) as Record<string, unknown>;
  const commonFile = read("common");
  const nested = (commonFile.common ?? {}) as Record<string, unknown>;
  return {
    ...commonFile,
    common: { ...commonFile, ...nested },
    dashboard: read("dashboard"),
  };
}

function renderIn(locale: string, ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messagesFor(locale)}>
      {ui}
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("[OP-070] Der Sprachumschalter wirkt auf dem Rahmen jeder Seite", () => {
  it("LegalFooter: die Rechtsverweise wechseln die Sprache", () => {
    renderIn("de", <LegalFooter />);
    expect(screen.getByText("Impressum")).toBeTruthy();
    expect(screen.getByText("Datenschutz")).toBeTruthy();
    cleanup();

    renderIn("en", <LegalFooter />);
    expect(screen.getByText("Imprint")).toBeTruthy();
    expect(screen.getByText("Privacy")).toBeTruthy();
    // Und die deutsche Fassung ist wirklich weg — ein Rueckfall auf DE waere
    // genau der Zustand, den OP-070 beschreibt.
    expect(screen.queryByText("Impressum")).toBeNull();
  });

  it("LegalFooter: die Jahreszahl bleibt eine Jahreszahl", () => {
    // ICU formatiert ein blosses `{year}` mit `Intl.NumberFormat`. Waere der
    // Wert als Zahl uebergeben, stuende hier im deutschen Gebietsschema
    // „2.026". Der Test haelt die Zeichenketten-Uebergabe fest.
    renderIn("de", <LegalFooter />);
    const year = String(new Date().getFullYear());
    const footer = screen.getByRole("contentinfo");
    expect(footer.textContent).toContain(year);
    expect(footer.textContent).not.toContain(
      year.slice(0, 1) + "." + year.slice(1),
    );
  });

  it("DataTable: der Tabellenrahmen war ENGLISCH und ist jetzt zweisprachig", () => {
    const columns = [{ accessorKey: "name", header: "Name" }];

    renderIn("de", <DataTable columns={columns} data={[]} />);
    expect(screen.getByText("Keine Einträge gefunden.")).toBeTruthy();
    // Der alte Zustand: „No results." in einem deutschsprachigen Produkt.
    expect(screen.queryByText("No results.")).toBeNull();
    cleanup();

    renderIn("en", <DataTable columns={columns} data={[]} />);
    expect(screen.getByText("No entries found.")).toBeTruthy();
  });

  it("DataTable: die Seitenblaetterknoepfe tragen einen uebersetzten Namen", () => {
    const columns = [{ accessorKey: "name", header: "Name" }];

    renderIn("de", <DataTable columns={columns} data={[]} />);
    expect(screen.getByLabelText("Vorherige Seite")).toBeTruthy();
    expect(screen.getByLabelText("Nächste Seite")).toBeTruthy();
    cleanup();

    renderIn("en", <DataTable columns={columns} data={[]} />);
    expect(screen.getByLabelText("Previous page")).toBeTruthy();
  });

  it("LocaleSwitcher: bietet beide Sprachen als Endonym an und markiert die aktive", () => {
    renderIn("de", <LocaleSwitcher />);
    const de = screen.getByRole("button", { name: "Deutsch" });
    const en = screen.getByRole("button", { name: "English" });
    // Endonyme: in BEIDEN Gebietsschemata gleich geschrieben, damit ein
    // Besucher seine eigene Sprache erkennt, auch wenn er die aktuelle
    // Oberflaeche nicht liest.
    expect(de.getAttribute("aria-current")).toBe("true");
    expect(en.getAttribute("aria-current")).toBeNull();
    cleanup();

    renderIn("en", <LocaleSwitcher />);
    expect(
      screen
        .getByRole("button", { name: "English" })
        .getAttribute("aria-current"),
    ).toBe("true");
  });

  it("LocaleSwitcher: setzt das Cookie, aus dem request.ts das Gebietsschema liest", () => {
    renderIn("de", <LocaleSwitcher />);
    screen.getByRole("button", { name: "English" }).click();
    // `src/i18n/request.ts` liest ausschliesslich `NEXT_LOCALE`. Ein
    // Umschalter, der irgendein anderes Cookie setzt, sieht richtig aus und
    // wirkt nicht — genau die Fehlerform, um die es in OP-070 geht.
    expect(document.cookie).toContain("NEXT_LOCALE=en");
  });
});
