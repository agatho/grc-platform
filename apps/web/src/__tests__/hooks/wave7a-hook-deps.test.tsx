// @vitest-environment jsdom
/**
 * [ARCTOS-FULL-2026-08-31 / Welle 7a · OP-080]
 *
 * Drei Produktdefekte, die `react-hooks/exhaustive-deps` freigelegt hat,
 * nachdem die Regel eingeschaltet war. Jeder wird hier an dem gemessen, was
 * der Nutzer sieht — nicht an der Abhängigkeitsliste.
 *
 * 1. `openTab` gab für einen bereits offenen Reiter `prev` unverändert
 *    zurück. Beschriftung, Ziel und Sinnbild blieben also für immer die aus
 *    dem Augenblick der Anlage.
 * 2. Die Reiterbeschriftung von `/work-items` folgte deshalb keinem
 *    Sprachwechsel — und der Effekt, der sie anmeldet, hätte ihn ohnehin
 *    nicht bemerkt, weil `t` nicht in seiner Abhängigkeitsliste stand.
 * 3. Auf `/search` erreichte der Schlagwortfilter die Anfrage nicht:
 *    `handleSearch` war mit `[query, scope]` gemerkt und las `tagFilter` aus
 *    dem Abschluss des letzten Tastendrucks.
 * 4. Und der Befund, der beim SCHREIBEN von Prüfung 2 auffiel, weil sie
 *    zunächst nicht fallen konnte: **die Reiterleiste zeigte nie die Seite,
 *    mit der sie geöffnet wurde.** Der Anbieter setzte beim Aufbau
 *    `setTabs(hydrated)` mit einem festen Wert, und weil Kindeffekte vor
 *    denen des Elternteils laufen, warf er die soeben angemeldete Anmeldung
 *    der Seite wieder weg.
 *
 * NACHWEIS, DASS DIESE PRÜFUNGEN GEGEN DEN ALTEN STAND FALLEN — gemessen,
 * nicht behauptet; die Zahlen stehen in `docs/UMSETZUNG-WELLE-7A.md` §5:
 *
 *   Prüfung 1 gegen altes `use-tab-navigation.tsx`  → rot (Beschriftung bleibt)
 *   Prüfung 2 gegen alte `work-items/page.tsx`      → rot (Reiter bleibt deutsch)
 *   Prüfung 3 gegen alte `search/page.tsx`          → rot (kein `tags=` in der URL)
 *   Prüfung 4 gegen altes `use-tab-navigation.tsx`  → rot (0 statt 1 Reiter)
 *
 * Zu Punkt 2 gehört eine Warnung in eigener Sache, im Sinne von OP-205: Eine
 * Prüfung, die nur „die Seitenüberschrift wechselt die Sprache" behauptete,
 * wäre WERTLOS — das tat sie vorher auch. Der Unterschied liegt allein in der
 * REITERLEISTE, und genau dort wird hier gelesen. Die Überschrift wird
 * zusätzlich geprüft, damit ein Fehlschlag unterscheidbar bleibt: wechselt
 * auch sie nicht, ist der Aufbau der Prüfung kaputt und nicht das Produkt.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { useEffect } from "react";

import { TabProvider, useTabNavigation } from "@/hooks/use-tab-navigation";
import { TabBar } from "@/components/layout/tab-bar";
import WorkItemsPage from "@/app/(dashboard)/work-items/page";
import SearchPage from "@/app/(dashboard)/search/page";

const MESSAGES = path.join(__dirname, "../../../messages");

/**
 * Der vollstaendige, GEBAUTE Nachrichtenbaum — derselbe, den die App laedt.
 *
 * [ARCTOS-FULL-2026-08-31 · Welle 8g] `messages/<locale>.json` ist
 * Bauausgabe von `scripts/build-messages.ts` und steht in `.gitignore`
 * (Zeile 42/43). Lokal war sie immer da, in CI nie: die Test-Jobs bauen sie
 * nicht, und der rohe `ENOENT` sagte niemandem, warum. Dieselbe Klasse wie
 * C-15 und OP-066 — eine Eingabe, die im Repository nicht existiert.
 *
 * Behoben wird das am Manifest (`pretest` / `pretest:coverage` bauen das
 * Buendel, wie `prebuild` es fuer den Bau tut). Diese Meldung bleibt trotzdem
 * stehen: wer die Suite an den npm-Skripten vorbei startet, soll lesen
 * koennen, was fehlt, statt einen Dateipfad zu sehen.
 */
function messagesFor(locale: string): Record<string, unknown> {
  const datei = path.join(MESSAGES, `${locale}.json`);
  if (!existsSync(datei)) {
    throw new Error(
      `Das gebaute Nachrichtenbuendel ${locale}.json fehlt.\n` +
        `  Erwartet: ${datei}\n` +
        "  Es ist Bauausgabe und steht in .gitignore. Erzeugen mit:\n" +
        "    npx tsx apps/web/scripts/build-messages.ts\n" +
        "  Ueber `npm test` geschieht das automatisch (pretest).",
    );
  }
  return JSON.parse(readFileSync(datei, "utf8")) as Record<string, unknown>;
}

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/work-items",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

// `/search` liegt hinter `ModuleGate`. Das Modul-Tor ist nicht Gegenstand
// dieser Welle; ohne diese Attrappe zeigt die Seite nur den Ladekreis.
vi.mock("@/hooks/use-module-config", () => ({
  useModuleConfig: () => ({ status: "enabled", loading: false }),
}));

function Wrap({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  // [OP-245] Die Seiten holen ihre Daten jetzt ueber `useQuery`; die
  // Pruefung stellt den Anbieter bereit, wie es das Wurzel-Layout tut.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale={locale} messages={messagesFor(locale)}>
        <TabProvider>
          <TabBar />
          {children}
        </TabProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  push.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1 — Der Mechanismus: `openTab` aktualisiert einen offenen Reiter
// ---------------------------------------------------------------------------

describe("[OP-080] openTab aktualisiert einen bereits offenen Reiter", () => {
  function Registrar({ label }: { label: string }) {
    const { openTab } = useTabNavigation();
    useEffect(() => {
      openTab({ id: "x", label, href: "/x", icon: "Layers" });
    }, [openTab, label]);
    return null;
  }

  it("übernimmt eine geänderte Beschriftung, statt `prev` zurückzugeben", async () => {
    const { rerender } = render(
      <Wrap locale="de">
        <Registrar label="Alter Name" />
      </Wrap>,
    );
    await waitFor(() => expect(screen.getByText("Alter Name")).toBeTruthy());

    rerender(
      <Wrap locale="de">
        <Registrar label="Neuer Name" />
      </Wrap>,
    );

    // Vor Welle 7a: `openTab` fand den Reiter und gab `prev` zurück — hier
    // stand weiterhin „Alter Name".
    await waitFor(() => expect(screen.getByText("Neuer Name")).toBeTruthy());
    expect(screen.queryByText("Alter Name")).toBeNull();
  });

  it("erzeugt bei unverändertem Reiter KEINEN neuen Zustand (keine Schleife)", async () => {
    // Die Behebung darf nicht in die andere Falle laufen: `setTabs` mit einem
    // jedes Mal neuen Feld würde den Persistenz-Effekt (`[tabs, initialized]`)
    // endlos wecken. Gemessen wird das an der Zahl der Schreibvorgänge in den
    // Sitzungsspeicher: sie muss sich beruhigen.
    const spy = vi.spyOn(Storage.prototype, "setItem");
    render(
      <Wrap locale="de">
        <Registrar label="Stabil" />
      </Wrap>,
    );
    await waitFor(() => expect(screen.getByText("Stabil")).toBeTruthy());
    const after = spy.mock.calls.filter((c) => c[0] === "arctos_tabs").length;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const later = spy.mock.calls.filter((c) => c[0] === "arctos_tabs").length;
    expect(later).toBe(after);
  });
});

// ---------------------------------------------------------------------------
// 2 — Die Wirkung: die Reiterleiste folgt der Sprache
// ---------------------------------------------------------------------------

describe("[OP-080] /work-items: die Reiterbeschriftung folgt der Sprache", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          String(url).includes("/types") ? { data: [] } : { data: [] },
      })),
    );
  });

  it("wechselt von Arbeitsobjekte nach Work Items", async () => {
    const { rerender } = render(
      <Wrap locale="de">
        <WorkItemsPage />
      </Wrap>,
    );

    // GELESEN WIRD DIE REITERLEISTE, nicht die Seitenüberschrift. Der
    // Beschriftungsknopf eines Reiters trägt `title={tab.label}` und ist das
    // einzige Element mit diesem Merkmal — `getByTitle` kann deshalb nicht
    // versehentlich die Überschrift der Seite treffen. Eine erste Fassung
    // dieser Prüfung las `getAllByText(...)` und war damit GRÜN, obwohl der
    // Reiter noch gar nicht existierte: sie hatte die Überschrift gefunden.
    // Das ist die Bauart aus OP-205, hier an der eigenen Prüfung.
    await waitFor(() =>
      expect(screen.getByTitle("Arbeitsobjekte")).toBeTruthy(),
    );

    rerender(
      <Wrap locale="en">
        <WorkItemsPage />
      </Wrap>,
    );

    // Kontrolle des Aufbaus: die Seite selbst wechselte auch vorher schon.
    // Fällt DIESE Zusicherung, ist die Prüfung kaputt, nicht das Produkt.
    await waitFor(() =>
      expect(screen.getAllByText("Work Items").length).toBeGreaterThan(0),
    );
    // Die eigentliche Aussage.
    await waitFor(() => expect(screen.getByTitle("Work Items")).toBeTruthy());
    expect(screen.queryByTitle("Arbeitsobjekte")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3 — Der Schlagwortfilter auf /search erreicht die Anfrage
// ---------------------------------------------------------------------------

describe("[OP-080] /search: der Schlagwortfilter erreicht die Anfrage", () => {
  it("schickt `tags=` mit, wenn das Schlagwort NACH dem Suchbegriff gesetzt wird", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        if (String(url).startsWith("/api/v1/tags")) {
          return {
            ok: true,
            json: async () => ({
              data: [{ name: "Kritisch", color: "#ef4444", category: null }],
            }),
          };
        }
        return { ok: true, json: async () => ({ data: [] }) };
      }),
    );

    render(
      <NextIntlClientProvider locale="de" messages={messagesFor("de")}>
        <SearchPage />
      </NextIntlClientProvider>,
    );

    await waitFor(() =>
      expect(calls.some((c) => c.startsWith("/api/v1/tags"))).toBe(true),
    );

    // 1. Suchbegriff tippen. DANACH wird `handleSearch` mit dem damaligen —
    //    noch leeren — `tagFilter` gemerkt.
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "vertrag" } });

    // 2. Schlagwort setzen. `query` und `scope` ändern sich dabei NICHT,
    //    also gab `useCallback` vor Welle 7a die alte Funktion zurück.
    fireEvent.click(screen.getByText("+ Tag hinzufügen"));
    fireEvent.click(await screen.findByText("Kritisch"));

    // 3. Suchen.
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(calls.some((c) => c.startsWith("/api/v1/search"))).toBe(true),
    );
    const searchCall = calls.find((c) => c.startsWith("/api/v1/search"))!;
    expect(searchCall).toContain("q=vertrag");
    // Vor Welle 7a fehlte genau dieser Teil: die Anfrage ging ohne den
    // Filter hinaus, den der Nutzer auf dem Bildschirm gesetzt sah.
    expect(searchCall).toContain("tags=Kritisch");
  });
});

// ---------------------------------------------------------------------------
// 4 — Die Reiterleiste zeigt die Seite, mit der sie geöffnet wurde
// ---------------------------------------------------------------------------

describe("[OP-080] TabProvider verwirft die Anmeldung der Seite nicht mehr", () => {
  function Registrar() {
    const { openTab } = useTabNavigation();
    useEffect(() => {
      openTab({ id: "x", label: "Reiter X", href: "/x", icon: "Layers" });
    }, [openTab]);
    return null;
  }

  it("bei leerem Sitzungsspeicher bleibt der eigene Reiter stehen", async () => {
    sessionStorage.clear();
    render(
      <Wrap locale="de">
        <Registrar />
      </Wrap>,
    );
    // Vor Welle 7a: `setTabs(hydrated)` mit festem Wert lief NACH dem
    // Kindeffekt und ersetzte ihn durch die leere Liste — gemessen 0 Reiter.
    await waitFor(() => expect(screen.getByTitle("Reiter X")).toBeTruthy());
  });

  it("ein gespeicherter Reiter überlebt daneben", async () => {
    sessionStorage.setItem(
      "arctos_tabs",
      JSON.stringify([
        { id: "y", label: "Alt", href: "/y", pinned: false, openedAt: 1 },
      ]),
    );
    render(
      <Wrap locale="de">
        <Registrar />
      </Wrap>,
    );
    // Vor Welle 7a stand hier NUR „Alt"; die Anmeldung der Seite war weg.
    await waitFor(() => expect(screen.getByTitle("Reiter X")).toBeTruthy());
    expect(screen.getByTitle("Alt")).toBeTruthy();
  });
});
