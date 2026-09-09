// @vitest-environment jsdom
//
// [ARCTOS-FULL-2026-08-31 / Welle 8b · OP-218, OP-219]
//
// Welle 8a (§7.2) hat gemessen und liegen gelassen: JEDE Modulseite zeigte
// beim Laden kurz den Teaser mit dem ROHEN Modulschluessel, dazu eine
// Konsolenwarnung, die dem Betreiber eine fehlende `module_definition`-Zeile
// meldete, die es gab. Die Ursache liegt in `ModuleConfigProvider`: `orgId`
// kommt aus `useSession()` und ist in zwei verschiedenen Lagen `null` — „die
// Sitzung laedt noch" und „die Sitzung ist da und hat keine Organisation".
// Der Anbieter behandelte beide gleich und meldete `loading: false` mit
// leerer Liste; fuer jedes `ModuleGate` ist das `status: "disabled"`.
//
// Welle 8a hat den Fall nicht angefasst, weil die naheliegende Behebung („bei
// `orgId === null` in `loading` bleiben") ein angemeldetes Konto OHNE
// Mitgliedschaft in einen Dauerladekreis geschickt haette. Diese Welle
// unterscheidet die beiden Lagen statt sie zusammenzuwerfen — und genau das
// pruefen die ersten drei Faelle: waehrend die Sitzung laedt der Ladekreis,
// danach der Teaser.
//
// Ein Aufblitzen laesst sich in einem E2E-Test nicht verlaesslich zusichern;
// als Rendertest ist es eine gewoehnliche Zusicherung.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import React from "react";

const sessionState = { status: "loading" as string };

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data:
      sessionState.status === "authenticated"
        ? { user: { roles: [{ role: "admin" }] } }
        : null,
    status: sessionState.status,
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) =>
    ns ? `${ns}.${key}` : key,
  useLocale: () => "de",
}));

// Fuer den Aktivierungsfall: eine geladene Definition und ein Administrator.
// Der Anbieter selbst wird dafuer NICHT gebraucht — geprueft wird der Zweig
// im Teaser, nicht das Laden.
vi.mock("@/hooks/use-module-config", async (orig) => {
  const echt = await orig<typeof import("@/hooks/use-module-config")>();
  return {
    ...echt,
    useModuleConfig: (key: string) =>
      teaserStub.aktiv
        ? {
            status: "disabled" as const,
            config: {},
            isEnabled: false,
            isPreview: false,
            isAccessible: false,
            isAdmin: true,
            definition: {
              moduleKey: key,
              displayNameDe: "Enterprise Risk Management",
              displayNameEn: "Enterprise Risk Management",
              licenseTier: "core",
              icon: "Box",
            } as never,
            loading: false,
          }
        : echt.useModuleConfig(key as never),
    useAllModuleConfigs: () =>
      teaserStub.aktiv
        ? { configs: [], loading: false, error: null, refetch: () => {} }
        : echt.useAllModuleConfigs(),
  };
});

const teaserStub = { aktiv: false };

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ModuleConfigProvider } from "@/hooks/use-module-config";
import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTeaser } from "@/components/module/module-teaser";

const MODULE_KEY = "erm" as never;

// [OP-245] `ModuleConfigProvider` holt seine Konfigurationen jetzt ueber
// `useQuery`; im Baum steht der Anbieter im Wurzel-Layout, hier stellt ihn
// die Pruefung selbst bereit.
function withQuery(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("Welle 8b — der Teaser-Blitz mit dem rohen Modulschluessel", () => {
  let warn: { mockRestore: () => void };
  let warnungen: string[] = [];

  beforeEach(() => {
    sessionState.status = "loading";
    warnungen = [];
    warn = vi.spyOn(console, "warn").mockImplementation((...args) => {
      warnungen.push(String(args[0]));
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })),
    );
  });

  afterEach(() => {
    cleanup();
    warn.mockRestore();
    vi.unstubAllGlobals();
  });

  it("zeigt waehrend der Sitzung KEINEN Teaser mit dem rohen Schluessel", () => {
    render(
      withQuery(
        <ModuleConfigProvider orgId={null} sessionLoading>
          <ModuleGate moduleKey={MODULE_KEY}>
            <div>Modulinhalt</div>
          </ModuleGate>
        </ModuleConfigProvider>,
      ),
    );
    // Der rohe Schluessel stand als UEBERSCHRIFT auf dem Bildschirm —
    // `definition?.displayNameDe ?? moduleKey`. Genau das ist der Beleg aus
    // dem Wiederholungsprotokoll in Welle 8a §7.2: "…Organisation U erm ©".
    expect(screen.queryByRole("heading", { name: "erm" })).toBeNull();
    expect(screen.queryByText("Modulinhalt")).toBeNull();
  });

  it("meldet keine fehlende module_definition, solange nichts geladen ist", () => {
    // ANDERER Modulschluessel als im Fall darueber, und das ist kein Zufall:
    // `warnedMissingKeys` in `use-module-config.tsx` warnt genau EINMAL je
    // Schluessel. Mit demselben Schluessel waere dieser Fall auch auf dem
    // alten Stand gruen gewesen — nicht weil nicht gewarnt wird, sondern
    // weil die Warnung schon im Fall darueber verbraucht war. Eine Pruefung,
    // die aus diesem Grund besteht, ist keine.
    render(
      withQuery(
        <ModuleConfigProvider orgId={null} sessionLoading>
          <ModuleGate moduleKey={"isms" as never}>
            <div>Modulinhalt</div>
          </ModuleGate>
        </ModuleConfigProvider>,
      ),
    );
    // Die Warnung schickte den Betreiber in die falsche Richtung: sie nannte
    // eine fehlende Zeile in `module_definition`, die es gab.
    expect(warnungen.filter((m) => m.includes("useModuleConfig"))).toEqual([]);
  });

  it("zeigt den Teaser, sobald die Sitzung ohne Organisation dasteht", async () => {
    // Die Kehrseite, an der Welle 8a die Behebung aufgehaengt hat: ein Konto
    // ohne Mitgliedschaft darf KEINEN Dauerladekreis bekommen.
    //
    // Redlichkeit: dieser Fall faellt gegen den alten Stand NICHT — dort war
    // dieses Verhalten schon richtig, es war ja der EINZIGE Zweig. Er steht
    // hier als Regressionsposten, weil die Behebung ihn haette kaputt machen
    // koennen; der Beweis fuer die Behebung liegt im ersten Fall.
    sessionState.status = "authenticated";
    render(
      withQuery(
        <ModuleConfigProvider orgId={null} sessionLoading={false}>
          <ModuleGate moduleKey={MODULE_KEY}>
            <div>Modulinhalt</div>
          </ModuleGate>
        </ModuleConfigProvider>,
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "erm" })).toBeTruthy(),
    );
  });
});

describe("Welle 8b — OP-219: die abgelehnte Aktivierung", () => {
  afterEach(() => {
    teaserStub.aktiv = false;
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sagt es, wenn die Aktivierung abgelehnt wird", async () => {
    teaserStub.aktiv = true;
    // `if (res.ok) { refetch(); }` ohne `else`, dazu ein `catch`, der den
    // Fehler ausdruecklich verwarf ("handled silently") — dieselbe Signatur
    // wie OP-216/OP-217, diesmal im Teaser selbst. Ein Administrator drueckte
    // „Modul aktivieren", die Antwort war 403, und die Seite blieb
    // unveraendert stehen: kein Hinweis, keine Spur, kein Fehler.
    const fetchMock = vi.fn(async () => ({ ok: false, status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ModuleTeaser moduleKey={MODULE_KEY} />);

    const btn = screen.getByRole("button", {
      name: "modules.teaser.activate",
    });
    btn.click();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("alert").textContent).toContain(
        "modules.teaser.activateFailed",
      );
    });
  });
});
