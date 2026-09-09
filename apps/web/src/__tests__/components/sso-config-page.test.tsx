// @vitest-environment jsdom
//
// [OP-249] Der „aktiv"-Schalter der SSO-Konfiguration
// (apps/web/src/app/(dashboard)/admin/sso/page.tsx) hat das Formular frueher
// ueber `fetchConfig()` neu eingehaengt und dabei jede noch nicht gespeicherte
// Eingabe des Administrators verworfen. Entscheidung des Eigentuemers:
// ungespeicherte Eingaben bleiben erhalten. Diese Pruefung haelt das fest —
// tippen, umschalten, und das Getippte muss noch dastehen.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import React from "react";

vi.mock("next-intl", () => ({
  useTranslations:
    (ns?: string) => (key: string, params?: Record<string, unknown>) => {
      const full = ns ? `${ns}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    },
  useLocale: () => "de",
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import SsoConfigPage from "@/app/(dashboard)/admin/sso/page";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function withQuery(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const SERVER_CONFIG = {
  id: "sso-1",
  provider: "saml" as const,
  displayName: "Konzern-IdP",
  samlMetadataUrl: "https://idp.example.com/metadata.xml",
  samlEntityId: "urn:idp:example",
  samlSsoUrl: "https://idp.example.com/sso",
  samlCertificate: "MIICxSERVER",
  samlAttributeMapping: null,
  oidcDiscoveryUrl: null,
  oidcClientId: null,
  oidcClientSecret: null,
  oidcScopes: null,
  oidcClaimMapping: null,
  isActive: true,
  enforceSSO: false,
  defaultRole: "viewer",
  groupRoleMapping: {},
  autoProvision: true,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Der Mock verhaelt sich wie der echte Endpunkt: das PUT schreibt
  // `isActive` fort, ein spaeteres GET liefert den fortgeschriebenen Stand.
  // Nur so scheitert die alte Fassung an der Aussage, um die es geht — an den
  // verlorenen Eingaben — und nicht schon am Zustand des Schalters.
  let serverActive = SERVER_CONFIG.isActive;
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as { isActive?: boolean };
      if (typeof body.isActive === "boolean") serverActive = body.isActive;
      return { ok: true, json: async () => ({ data: null }) };
    }
    return {
      ok: true,
      json: async () => ({
        data: { ...SERVER_CONFIG, isActive: serverActive },
      }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function displayNameInput(): HTMLInputElement {
  return screen.getByPlaceholderText(
    "identity.displayNamePlaceholder",
  ) as HTMLInputElement;
}

function entityIdInput(): HTMLInputElement {
  // Das Entity-ID-Feld traegt kein Label-Attribut; es ist das Textfeld unter
  // der Ueberschrift "identity.entityId".
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="text"]'),
  );
  const found = inputs.find((i) => i.value.startsWith("urn:idp"));
  if (!found) throw new Error("entityId input not found");
  return found;
}

describe("SSO configuration page — active toggle (OP-249)", () => {
  it("keeps unsaved input in the other fields when 'active' is toggled", async () => {
    render(withQuery(<SsoConfigPage />));

    // Formular ist mit dem Serverstand gesaet.
    await waitFor(() => {
      expect(displayNameInput().value).toBe("Konzern-IdP");
    });

    // Der Administrator aendert zwei Felder, ohne zu speichern.
    fireEvent.change(displayNameInput(), {
      target: { value: "Haniel Azure AD" },
    });
    fireEvent.change(entityIdInput(), {
      target: { value: "urn:idp:haniel-neu" },
    });
    expect(displayNameInput().value).toBe("Haniel Azure AD");
    expect(entityIdInput().value).toBe("urn:idp:haniel-neu");

    // ... und schaltet dann „aktiv" um.
    const activeSwitch = screen.getAllByRole("switch")[0];
    expect(activeSwitch.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(activeSwitch);

    // Das Umschalten wird weiterhin persistiert.
    await waitFor(() => {
      const put = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(put).toBeTruthy();
      expect(String((put?.[1] as RequestInit).body)).toBe(
        JSON.stringify({ isActive: false }),
      );
    });

    // ... und der Schalter zeigt den neuen Zustand.
    await waitFor(() => {
      expect(
        screen.getAllByRole("switch")[0].getAttribute("aria-checked"),
      ).toBe("false");
    });
    expect(screen.getByText("identity.inactive")).toBeTruthy();

    // Kern von OP-249: die ungespeicherten Eingaben stehen noch.
    expect(displayNameInput().value).toBe("Haniel Azure AD");
    expect(entityIdInput().value).toBe("urn:idp:haniel-neu");
  });

  it("still seeds every field from the server on a fresh mount", async () => {
    render(withQuery(<SsoConfigPage />));

    await waitFor(() => {
      expect(displayNameInput().value).toBe("Konzern-IdP");
    });
    expect(entityIdInput().value).toBe("urn:idp:example");
    expect(screen.getByText("identity.active")).toBeTruthy();
  });
});
