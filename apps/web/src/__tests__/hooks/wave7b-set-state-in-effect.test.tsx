// @vitest-environment jsdom
/**
 * [ARCTOS-FULL-2026-08-31 / Welle 7b · OP-080]
 *
 * `react-hooks/set-state-in-effect` — die zwanzig Fundstellen, die Welle 7a
 * bewusst nicht angefasst hat. Hier stehen die Defekte, die beim Abtragen
 * sichtbar geworden sind, jeder an dem gemessen, was der Nutzer sieht.
 *
 * NACHWEIS, DASS DIESE PRUEFUNGEN GEGEN DEN ALTEN STAND FALLEN — gemessen,
 * nicht behauptet; die Ausgaben stehen in `docs/UMSETZUNG-WELLE-7B.md` §6:
 *
 *   1  gegen altes `use-nav-preferences.tsx`      → rot (Gruppe faellt zu)
 *   2  gegen altes `use-layout-preference.tsx`    → rot (Muell wird Layout)
 *   3  gegen altes `use-layout-preference.tsx`    → rot (Anbieter faellt aus)
 *   4  gegen altes `entity-documents-panel.tsx`   → rot (veraltete Liste)
 *
 * Pruefung 1 war im ersten Anlauf GRUEN gegen den alten Stand — sie las eine
 * Festschreibung zu frueh. Die Spur und die Behebung stehen an der Pruefung
 * selbst; das ist im Sinne von OP-205 und OP-211 der wichtigste Teil dieser
 * Datei. Zur Gestalt B steht hier KEINE Pruefung, mit Begruendung ganz unten.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import { useMemo } from "react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  NavPreferencesProvider,
  useNavPreferences,
} from "@/hooks/use-nav-preferences";
import { LayoutProvider, useLayout } from "@/hooks/use-layout-preference";
import { EntityDocumentsPanel } from "@/components/documents/entity-documents-panel";

const MESSAGES = path.join(__dirname, "../../../messages");

function messagesFor(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(MESSAGES, `${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "u-1", name: "Tester", roles: [{ role: "admin" }] } },
    status: "authenticated",
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/risks",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

function withQuery(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// 1 — Die Gruppe der aufgerufenen Seite fiel wieder zu
// ---------------------------------------------------------------------------

describe("[OP-080] NavPreferences: die aktive Gruppe ueberlebt die geladenen Einstellungen", () => {
  /**
   * Bildet nach, was `components/layout/sidebar.tsx` tut: die Gruppe des
   * aktuellen Pfads wird WAEHREND DES ERSTEN RENDERNS angemeldet, also lange
   * bevor `/api/v1/users/me/nav-preferences` geantwortet hat.
   */
  function SidebarLike({ activeGroupKey }: { activeGroupKey: string }) {
    const { setActiveGroup, isGroupCollapsed, prefs } = useNavPreferences();
    useMemo(
      () => setActiveGroup(activeGroupKey),
      [activeGroupKey, setActiveGroup],
    );
    return (
      <div>
        <span data-testid="erm">
          {isGroupCollapsed("erm") ? "zu" : "offen"}
        </span>
        <span data-testid="isms">
          {isGroupCollapsed("isms") ? "zu" : "offen"}
        </span>
        {/* Der WACHTPOSTEN der Pruefung — siehe die Bemerkung unten. */}
        <span data-testid="stand">{JSON.stringify(prefs.collapsedGroups)}</span>
      </div>
    );
  }

  it("die Gruppe des Pfads bleibt offen, wenn der Server eine ANDERE gespeichert hat", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            pinnedRoutes: [],
            // Der Nutzer hatte zuletzt „isms" aufgeklappt — NICHT „erm".
            collapsedGroups: ["isms"],
            sidebarMode: "condensed",
          },
        }),
      })),
    );

    render(
      withQuery(
        <NavPreferencesProvider>
          <SidebarLike activeGroupKey="erm" />
        </NavPreferencesProvider>,
      ),
    );

    // WORAUF GEWARTET WIRD, ENTSCHEIDET, OB DIESE PRUEFUNG FALLEN KANN.
    //
    // Die erste Fassung wartete auf `loading === false` und war damit GRUEN
    // gegen den alten Stand — sie las eine Festschreibung zu frueh. Die Spur
    // des alten Standes, gemessen (`docs/UMSETZUNG-WELLE-7B.md` §6.1):
    //
    //   render loading=true  collapsedGroups=[]       erm=zu     isms=zu
    //   render loading=true  collapsedGroups=[]       erm=offen  isms=zu
    //   render loading=false collapsedGroups=[]       erm=offen  isms=zu   ← hier las sie
    //   render loading=false collapsedGroups=["isms"] erm=offen  isms=zu
    //   render loading=false collapsedGroups=["isms"] erm=zu     isms=offen ← der Defekt
    //
    // `loading` wird frei, BEVOR die gespiegelten Einstellungen ueberhaupt im
    // Anbieter angekommen sind. Gewartet wird deshalb darauf, dass der
    // gespeicherte Stand WIRKLICH da ist, und danach wird die Warteschlange
    // geleert — erst dann steht fest, was der Nutzer zu sehen bekommt.
    await waitFor(() =>
      expect(screen.getByTestId("stand").textContent).toBe('["isms"]'),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Vor Welle 7b: der Effekt `setExpandedGroups(new Set(prefs.collapsedGroups))`
    // lief NACH der Anmeldung der Seitenleiste und ersetzte sie — gemessen
    // „zu" fuer erm und „offen" fuer isms. Der Nutzer sah die Gruppe seiner
    // eigenen Seite aufgehen und einen Augenblick spaeter wieder zuklappen.
    expect(screen.getByTestId("erm").textContent).toBe("offen");
    expect(screen.getByTestId("isms").textContent).toBe("zu");
  });
});

// ---------------------------------------------------------------------------
// 2 + 3 — Der Browserspeicher als aeusserer Speicher
// ---------------------------------------------------------------------------

describe("[OP-080] LayoutProvider liest den Browserspeicher geprueft", () => {
  function Show() {
    const { layout } = useLayout();
    return <span data-testid="layout">{layout}</span>;
  }

  it("ein unbekannter Wert im Speicher wird NICHT zum Layoutnamen", async () => {
    // Eine aeltere Fassung, ein fremdes Skript, eine halb geschriebene
    // Zeichenkette — alles drei landet hier.
    localStorage.setItem("arctos-layout", "compact");

    render(
      <LayoutProvider>
        <Show />
      </LayoutProvider>,
    );

    // Vor Welle 7b stand hier `localStorage.getItem(...) as LayoutMode`, eine
    // BEHAUPTUNG: gemessen „compact", und damit traf weder die klassische noch
    // die moderne Ansicht zu.
    await waitFor(() =>
      expect(screen.getByTestId("layout").textContent).toBe("modern"),
    );
  });

  it("ein gesperrter Browserspeicher legt den Anbieter nicht lahm", async () => {
    // Safari im privaten Modus, gesperrter Speicher von Drittanbietern: der
    // ZUGRIFF wirft, nicht erst das Schreiben.
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      });

    // Vor Welle 7b lag der Zugriff ungeschuetzt in einem Effekt; die Ausnahme
    // riss den Anbieter und mit ihm den ganzen Teilbaum mit.
    expect(() =>
      render(
        <LayoutProvider>
          <Show />
        </LayoutProvider>,
      ),
    ).not.toThrow();

    expect(screen.getByTestId("layout").textContent).toBe("modern");
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 4 — Zwei Suchanfragen, die in der falschen Reihenfolge zurueckkommen
// ---------------------------------------------------------------------------

describe("[OP-080] Dokumentensuche: die JUENGSTE Anfrage bestimmt die Liste", () => {
  it("eine spaet eintreffende alte Antwort ueberschreibt die neue nicht", async () => {
    // Nach Suchbegriff abgelegt, nicht nach Reihenfolge: beim Oeffnen laeuft
    // bereits eine Anfrage mit leerem Begriff, und die soll die Zaehlung nicht
    // verschieben.
    const pending = new Map<string, () => void>();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.startsWith("/api/v1/entity-documents")) {
          return { ok: true, json: async () => ({ data: [] }) };
        }
        // `/api/v1/documents?...` — die Suche im Verknuepfungsdialog.
        const search = new URL(u, "http://x").searchParams.get("search") ?? "";
        const body = {
          ok: true,
          json: async () => ({
            data: [
              {
                id: `doc-${search}`,
                title: `Treffer fuer ${search || "(leer)"}`,
                category: "policy",
                status: "approved",
              },
            ],
          }),
        };
        return new Promise((resolve) => {
          pending.set(search, () => resolve(body));
        });
      }),
    );

    render(
      withQuery(
        <NextIntlClientProvider locale="de" messages={messagesFor("de")}>
          <EntityDocumentsPanel entityType="asset" entityId="a-1" />
        </NextIntlClientProvider>,
      ),
    );

    // Den Verknuepfungsdialog oeffnen.
    await waitFor(() =>
      expect(screen.getByText("Dokument anhaengen")).toBeTruthy(),
    );
    fireEvent.click(screen.getByText("Dokument anhaengen"));

    const input = await screen.findByPlaceholderText(/Dokumente suchen/i);

    // Zwei Tastenfolgen kurz hintereinander: „A", dann „AB".
    fireEvent.change(input, { target: { value: "A" } });
    await waitFor(() => expect(pending.has("A")).toBe(true));
    fireEvent.change(input, { target: { value: "AB" } });
    await waitFor(() => expect(pending.has("AB")).toBe(true));

    // Die Antworten kommen in der FALSCHEN Reihenfolge zurueck — erst die
    // juengere, dann die aeltere. Genau das passiert im Netz staendig.
    await act(async () => {
      pending.get("AB")!();
      await new Promise((r) => setTimeout(r, 0));
      pending.get("A")!();
      await new Promise((r) => setTimeout(r, 0));
    });

    // Vor Welle 7b schrieb jeder Abruf sein Ergebnis mit `setAvailableDocs`
    // ungeprueft in denselben Zustand; die zuletzt eintreffende Antwort gewann.
    // Der Nutzer sah die Treffer zu „A", waehrend „AB" in der Suchzeile stand.
    await waitFor(() =>
      expect(screen.queryByText("Treffer fuer AB")).toBeTruthy(),
    );
    expect(screen.queryByText("Treffer fuer A")).toBeNull();
    expect((input as HTMLInputElement).value).toBe("AB");
  });
});

// ---------------------------------------------------------------------------
// Was hier NICHT steht, und warum — Gestalt B
// ---------------------------------------------------------------------------
//
// Fuer die vier Fundstellen der Gestalt B (Formular beim Oeffnen
// zuruecksetzen) steht hier KEINE Pruefung. Nicht aus Nachlaessigkeit,
// sondern weil zwei Anlaeufe gemessen haben, dass es dort nichts zu
// widerlegen gibt — und eine Pruefung, die nicht fallen kann, ist in diesem
// Audit schlimmer als keine.
//
//   1. Ein Zeuge mit `useLayoutEffect` als Geschwister der Seite: gruen gegen
//      den alten Stand, gemessen `seen=[]`. Er rendert nur mit, wenn sein
//      eigener Elternteil rendert; der Zustand, der den Dialog oeffnet, liegt
//      aber INNERHALB der Seite. Das Messgeraet nahm an keiner der fraglichen
//      Festschreibungen teil.
//   2. Ein Aufzeichner am Setzer von `HTMLInputElement.prototype.value`:
//      ebenfalls gruen, gemessen `written=[]`. React legt fuer ein
//      gesteuertes Feld einen eigenen Setzer auf dem ELEMENT an, der den des
//      Prototyps verdeckt.
//
// Was beide Messungen zusammen zeigen: der Rueckstelleffekt des alten Standes
// lief, BEVOR Radix den Dialoginhalt ueberhaupt einhaengte — `DialogContent`
// erscheint eine Festschreibung spaeter als die Eigenschaft `open`. Der
// veraltete Entwurf wurde also nie festgeschrieben. Die Umstellung der Gestalt
// B ist damit eine reine Strukturaenderung: sie traegt die Fundstelle ab und
// nimmt der Klasse die Grundlage, aber sie behebt keinen sichtbaren Defekt,
// und genau das steht hier statt einer Pruefung, die das Gegenteil behaupten
// wuerde. Ihre Absicherung ist der E2E-Lauf ueber `/tasks`, `/organizations`
// und `/settings/notifications/scheduled`.
