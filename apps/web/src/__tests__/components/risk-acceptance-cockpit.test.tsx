// @vitest-environment jsdom
//
// Light render test for the Risk-Acceptance review cockpit
// (apps/web/src/app/(dashboard)/risk-acceptances/page.tsx): the page
// renders rows from GET /api/v1/risk-acceptances, highlights soon-to-
// expire acceptances and re-fetches with `expiringBefore` when the
// "expiring soon only" toggle is activated.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import React from "react";

// ── Runtime stubs (same idiom as all-components-smoke.test.tsx) ──────

vi.mock("next-intl", () => ({
  useTranslations:
    (ns?: string) =>
    (key: string, params?: Record<string, unknown>) => {
      const full = ns ? `${ns}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    },
  useLocale: () => "de",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/risk-acceptances",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => React.createElement("a", { href }, children),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Module gating: pretend the ERM module is enabled for the org.
vi.mock("@/hooks/use-module-config", () => ({
  useModuleConfig: () => ({ status: "enabled", loading: false }),
}));

import RiskAcceptancesPage from "@/app/(dashboard)/risk-acceptances/page";

// ── Fetch fixture ─────────────────────────────────────────────────────

function isoInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const LIST_PAYLOAD = {
  data: [
    {
      id: "acc-1",
      riskId: "risk-1",
      riskTitle: "Legacy VPN bleibt bis Migration in Betrieb",
      status: "active",
      acceptedAt: "2026-06-01T10:00:00.000Z",
      acceptedBy: "user-1",
      acceptedByName: "Carla CISO",
      acceptedByEmail: "carla@example.com",
      riskScoreAtAcceptance: 12,
      riskLevelAtAcceptance: "high",
      validUntil: isoInDays(10), // inside the 30-day warning window
      acceptanceConditions: null,
      justification:
        "Kompensierende Kontrollen aktiv, Migration auf ZTNA in Q3 geplant.",
      revokedAt: null,
      tags: ["vpn"],
    },
    {
      id: "acc-2",
      riskId: "risk-2",
      riskTitle: "Altsystem ohne Herstellersupport",
      status: "revoked",
      acceptedAt: "2026-01-15T09:00:00.000Z",
      acceptedBy: "user-2",
      acceptedByName: "Adam Admin",
      acceptedByEmail: "adam@example.com",
      riskScoreAtAcceptance: 20,
      riskLevelAtAcceptance: "critical",
      validUntil: null,
      acceptanceConditions: null,
      justification: "Ablösung war für Q1 geplant, Budget wurde gestrichen.",
      revokedAt: "2026-03-01T08:00:00.000Z",
      tags: [],
    },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => LIST_PAYLOAD,
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("Risk-Acceptance cockpit page", () => {
  it("renders acceptance rows from the list endpoint", async () => {
    render(<RiskAcceptancesPage />);

    expect(
      await screen.findByText("Legacy VPN bleibt bis Migration in Betrieb"),
    ).toBeTruthy();
    expect(screen.getByText("Altsystem ohne Herstellersupport")).toBeTruthy();
    // Acceptor identity from the user join
    expect(screen.getByText("Carla CISO")).toBeTruthy();
    // Status badges (mocked t → namespaced keys)
    expect(screen.getByText("risk.acceptance.status.active")).toBeTruthy();
    expect(screen.getByText("risk.acceptance.status.revoked")).toBeTruthy();

    // First call hits the org-wide list without an expiry filter
    const firstUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(firstUrl).toContain("/api/v1/risk-acceptances?");
    expect(firstUrl).not.toContain("expiringBefore");
  });

  it("highlights active acceptances expiring within 30 days", async () => {
    render(<RiskAcceptancesPage />);
    await screen.findByText("Legacy VPN bleibt bis Migration in Betrieb");

    // The <30-day active row gets the "expires in {days} days" chip;
    // the revoked row (no validUntil) shows "unlimited".
    expect(
      screen.getByText(/risk\.acceptance\.expiry\.expiresInDays/),
    ).toBeTruthy();
    expect(
      screen.getByText("risk.acceptance.expiry.unlimited"),
    ).toBeTruthy();
  });

  it("re-fetches with expiringBefore when the expiring-soon toggle is enabled", async () => {
    render(<RiskAcceptancesPage />);
    await screen.findByText("Legacy VPN bleibt bis Migration in Betrieb");

    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(
      screen.getByText("risk.acceptance.filter.expiringSoonOnly"),
    );

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
    const lastUrl = String(fetchMock.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toContain("expiringBefore=");
    expect(lastUrl).toContain("sort=validUntil");
  });
});
