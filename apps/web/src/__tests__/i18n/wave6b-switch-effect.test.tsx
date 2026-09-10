// @vitest-environment jsdom
/**
 * [ARCTOS-FULL-2026-08-31 / Welle 6b · OP-070]
 *
 * `wave6b-surfaces.test.ts` liest Quelltext. Diese Datei RENDERT — zweimal,
 * einmal je Sprache — und vergleicht, was auf dem Bildschirm steht. Das ist
 * die einzige Form, in der sich die Aussage von OP-070 direkt widerlegen
 * laesst.
 *
 * Zwei Seiten, jede fuer einen der beiden Befunde dieser Welle:
 *
 *   `SettingsPage`  war ueber `titleDe`/`titleEn`-Paare BEREITS zweisprachig —
 *                   mit EINER Ausnahme: das Abzeichen trug den fertigen Text
 *                   „neu", auch auf der englischen Seite.
 *   `RlsAuditPage`  war der LETZTE Bildschirmpfad mit fest verdrahtetem
 *                   Gebietsschema. Welle 5a hatte ihre Teilaenderung dort
 *                   zurueckgenommen; hier steht der Beleg, dass das Datum
 *                   jetzt dem Gebietsschema folgt — und dass die beiden
 *                   Spalten, um die es auf der Seite geht, endlich einen
 *                   zugaenglichen Namen tragen.
 *
 * EIN WORT ZUM NACHWEIS, dass diese Pruefungen gegen den ALTEN Stand fallen.
 * Beide Seiten WAREN fuer den Nutzer bereits zweisprachig — ueber ihre eigene
 * Mechanik. „Plattform-Einstellungen" wechselte auch vorher zu „Platform
 * settings", und das Datum stand im deutschen Zweig auf `de-DE`, im
 * englischen auf `en-US`. Eine Pruefung, die nur DAS behauptet, faellt gegen
 * den alten Stand NICHT — sie ist ein Regressionsposten, kein Nachweis.
 *
 * Deshalb traegt jede der beiden Pruefungen hier zusaetzlich die Aussage, die
 * vorher FALSCH war: das Abzeichen („neu" auch auf der englischen Seite) und
 * die namenlosen Haken der Spalten RLS und FORCE. Der strukturelle Nachweis
 * fuer das feste Gebietsschema steht in `wave6b-surfaces.test.ts` §2 — dort
 * faellt er.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import path from "node:path";

import { formatCurrency } from "@/lib/format-date";
import SettingsPage from "@/app/(dashboard)/settings/page";
import RlsAuditPage from "@/app/(dashboard)/admin/rls-audit/page";

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
    admin: read("admin"),
    aiAct: read("ai-act"),
  };
}

function renderIn(locale: string, ui: React.ReactNode) {
  // [OP-245] Die Seiten holen ihre Daten jetzt ueber `useQuery`; im Baum
  // steht der Anbieter im Wurzel-Layout, hier stellt ihn die Pruefung bereit.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale={locale} messages={messagesFor(locale)}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("[OP-070] Welle 6b — der Umschalter wirkt auf settings und rls-audit", () => {
  it("SettingsPage: die Seite wechselt die Sprache — und das Abzeichen jetzt mit", () => {
    renderIn("de", <SettingsPage />);
    expect(screen.getByText("Plattform-Einstellungen")).toBeTruthy();
    expect(screen.getByText("Nutzer, Rollen & Zugriff")).toBeTruthy();
    expect(screen.getByText("Sprachen & Übersetzungen")).toBeTruthy();
    // Das Abzeichen: vorher stand in der Tabelle `badge: "neu"` — der fertige
    // TEXT, nicht sein Schluessel.
    expect(screen.getByText("neu")).toBeTruthy();
    cleanup();

    renderIn("en", <SettingsPage />);
    expect(screen.getByText("Platform settings")).toBeTruthy();
    expect(screen.getByText("Users, roles & access")).toBeTruthy();
    expect(screen.getByText("Languages & translations")).toBeTruthy();
    // Und die deutsche Fassung ist wirklich weg — das Abzeichen eingeschlossen.
    // DAS ist die Aussage, die gegen den alten Stand faellt: ein
    // englischsprachiger Nutzer las auf einer sonst vollstaendig englischen
    // Seite „NEU".
    expect(screen.getByText("new")).toBeTruthy();
    expect(screen.queryByText("Plattform-Einstellungen")).toBeNull();
    expect(screen.queryByText("neu")).toBeNull();
  });

  // ── rls-audit ────────────────────────────────────────────────────────────

  const REPORT = {
    generatedAt: "2026-12-31T12:00:00.000Z",
    counts: {
      totalTables: 617,
      tenantTables: 429,
      platformTables: 188,
      tenantsOk: 428,
      tenantsMissingRls: 1,
      tenantsMissingForce: 0,
      tenantsMissingPolicies: 0,
    },
    tables: [
      {
        tableName: "risk",
        scope: "tenant",
        rlsEnabled: false,
        rlsForced: false,
        policies: [],
        coveredCommands: [],
        status: "missing_rls",
      },
    ],
  };

  function stubFetch() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        ok: true,
        json: async () => ({ data: REPORT }),
      })),
    );
  }

  it("formatCurrency: Geldbetraege folgen dem Gebietsschema", () => {
    // [Welle 6b] `formatNumber` gab es seit FE-HIGH-2; fuer GELD gab es
    // nichts — und genau deshalb steht in 19 Bildschirmdateien
    // `new Intl.NumberFormat("de-DE", { style: "currency" })`, eine Form, die
    // weder der Detektor noch der Wachposten aus Welle 5a sieht (dort steht
    // sie beziffert in `wave6b-surfaces.test.ts` §8).
    //
    // Der Unterschied, um den es geht: Stellung des Waehrungszeichens und
    // Dezimaltrennzeichen. „1.234,50 €" gegen „€1,234.50".
    const de = formatCurrency("de", 1234.5, "EUR");
    const en = formatCurrency("en", 1234.5, "EUR");
    expect(de).toMatch(/1\.234,50/);
    expect(en).toMatch(/1,234\.50/);
    expect(de).not.toBe(en);
    // Und der Nullfall gibt denselben Gedankenstrich wie `formatNumber`,
    // damit eine Tabelle nicht zwei Schreibweisen fuer „kein Wert" fuehrt.
    expect(formatCurrency("de", null, "EUR")).toBe("—");
  });

  it("RlsAuditPage: Sprache, Datum und die Namen der beiden Spalten", async () => {
    stubFetch();
    const { container: deBox } = renderIn("de", <RlsAuditPage />);
    await waitFor(() =>
      expect(screen.getByText("1 von 429 Mandanten-Tabellen haben Lücken")),
    );
    expect(screen.getByText("RLS-Audit")).toBeTruthy();
    expect(screen.getByText("Nur Lücken")).toBeTruthy();
    // Das Datum folgt dem Gebietsschema: TT.MM.JJJJ. Der alte Stand kam hier
    // zum selben Ergebnis — er schrieb `toLocaleString("de-DE")` fest in den
    // deutschen Zweig. Beweiskraeftig ist deshalb nicht diese Zeile, sondern
    // §2 in `wave6b-surfaces.test.ts`; hier steht sie als Regressionsposten.
    expect(deBox.textContent).toMatch(/31\.12\.2026/);
    expect(deBox.textContent).not.toMatch(/12\/31\/2026/);
    // DAS faellt gegen den alten Stand: die Haken und Kreuze der Spalten RLS
    // und FORCE waren reine Symbole ohne zugaenglichen Namen. Ein
    // Screenreader las „risk, tenant, (nichts), (nichts), …" — die beiden
    // Spalten, um die es auf dieser Seite ueberhaupt geht, fehlten.
    expect(screen.getAllByLabelText("RLS fehlt").length).toBeGreaterThan(0);
    cleanup();

    stubFetch();
    const { container: enBox } = renderIn("en", <RlsAuditPage />);
    await waitFor(() =>
      expect(screen.getByText("1 of 429 tenant tables have gaps")),
    );
    expect(screen.getByText("RLS audit")).toBeTruthy();
    expect(screen.getByText("Gaps only")).toBeTruthy();
    expect(enBox.textContent).toMatch(/12\/31\/2026/);
    expect(enBox.textContent).not.toMatch(/31\.12\.2026/);
    expect(screen.getAllByLabelText("RLS missing").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nur Lücken")).toBeNull();
  });
});
