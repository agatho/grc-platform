"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, ChevronDown, Check } from "lucide-react";

interface OrgInfo {
  id: string;
  name: string;
}

interface OrgSwitcherProps {
  currentOrgId: string | null;
}

export function OrgSwitcher({ currentOrgId }: OrgSwitcherProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("orgSwitcher");
  const [open, setOpen] = useState(false);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Get accessible org IDs from session roles
  const accessibleOrgIds = [
    ...new Set(session?.user?.roles?.map((r) => r.orgId) ?? []),
  ];

  // Fetch org names
  useEffect(() => {
    if (accessibleOrgIds.length === 0) return;
    fetch("/api/v1/organizations?" + new URLSearchParams({ limit: "100" }))
      .then((r) => r.json())
      .then((res) => {
        const list = (res.data ?? [])
          .filter((o: OrgInfo) => accessibleOrgIds.includes(o.id))
          .map((o: OrgInfo) => ({ id: o.id, name: o.name }));
        setOrgs(list);
      })
      .catch(() => {});
  }, [session]);

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
    router.refresh();
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
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
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
              {org.id === currentOrgId && <Check size={14} className="text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
