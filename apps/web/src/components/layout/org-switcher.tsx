"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Building2, ChevronDown, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface OrgInfo {
  id: string;
  name: string;
}

interface OrgSwitcherProps {
  currentOrgId: string | null;
}

export function OrgSwitcher({ currentOrgId }: OrgSwitcherProps) {
  const { data: session } = useSession();
  const t = useTranslations("orgSwitcher");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Get accessible org IDs from session roles.
  // [Welle 7a · OP-080] `useMemo` statt eines bei jedem Rendern neu gebauten
  // Feldes: sonst ist der Wert bei jedem Rendern ein anderer, und jede
  // ehrliche Abhaengigkeitsliste, die ihn nennt, laeuft in eine Schleife.
  // Genau daran scheiterte die alte Fassung — sie nannte ersatzweise
  // `session` und war damit eine von Hand gefuehrte Kopie.
  const accessibleOrgIds = useMemo(
    () => [...new Set(session?.user?.roles?.map((r) => r.orgId) ?? [])],
    [session],
  );

  // #NIGHT-042: shared react-query cache so the header's org-switcher
  // doesn't re-fire /organizations?limit=100 on every navigation or
  // when another component (e.g. /organizations/page.tsx) also mounts.
  const { data: orgList } = useQuery<OrgInfo[]>({
    queryKey: ["organizations", "switcher"],
    queryFn: async () => {
      const r = await fetch(
        "/api/v1/organizations?" + new URLSearchParams({ limit: "100" }),
      );
      if (!r.ok) return [];
      const res = await r.json();
      return (res.data ?? []) as OrgInfo[];
    },
    enabled: accessibleOrgIds.length > 0,
  });

  // [Welle 7a · OP-080] Die Liste der erreichbaren Organisationen ist
  // ABGELEITETER Wert und war Zustand: ein Effekt spiegelte das Ergebnis von
  // react-query in ein `useState`. Das kostete einen zusaetzlichen
  // Renderdurchlauf je Aenderung — der Kopf zeigte kurz „keine Auswahl", weil
  // `orgs.length <= 1` im ersten Durchlauf noch galt — und zwang die
  // Abhaengigkeitsliste zur Unwahrheit. Jetzt wird sie beim Rendern
  // berechnet; damit entfaellt der Effekt und mit ihm die falsche Liste.
  const orgs = useMemo(
    () =>
      (orgList ?? [])
        .filter((o) => accessibleOrgIds.includes(o.id))
        .map((o) => ({ id: o.id, name: o.name })),
    [orgList, accessibleOrgIds],
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentOrg = orgs.find((o) => o.id === currentOrgId);

  async function switchOrg(orgId: string) {
    setOpen(false);
    await fetch("/api/v1/auth/switch-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    // Hard reload so the server re-runs the session callback with the new
    // arctos-org-id cookie, and every client component (header, sidebar,
    // module-gated pages) picks up the new currentOrgId. router.refresh()
    // alone left the client-cached useSession() stale.
    window.location.reload();
  }

  if (orgs.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <Building2 size={16} className="text-gray-400" />
        <span className="font-medium">{currentOrg?.name ?? t("label")}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <Building2 size={16} className="text-gray-400" />
        <span>{currentOrg?.name ?? t("label")}</span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          <p className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
            {t("switchTo")}
          </p>
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => switchOrg(org.id)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <span>{org.name}</span>
              {org.id === currentOrgId && (
                <Check size={14} className="text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
