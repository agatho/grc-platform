"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  Plus,
  Users,
  ShieldCheck,
  Eye,
  AlertTriangle,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PortalConfigItem {
  id: string;
  portalType: string;
  name: string;
  description: string | null;
  isActive: boolean;
  requireMfa: boolean;
  createdAt: string;
}

export default function PortalsPage() {
  return (
    <ModuleGate moduleKey="portals">
      <PortalsDashboard />
    </ModuleGate>
  );
}

function PortalsDashboard() {
  const t = useTranslations("portals");
  const router = useRouter();
  const [configs, setConfigs] = useState<PortalConfigItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/portals/configs");
      if (res.ok) setConfigs((await res.json()).data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const portalTypeIcons: Record<string, React.ReactNode> = {
    vendor: <Users size={18} className="text-blue-600" />,
    auditor: <Eye size={18} className="text-green-600" />,
    board_member: <ShieldCheck size={18} className="text-purple-600" />,
    whistleblower: <AlertTriangle size={18} className="text-orange-600" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/portals/sessions">
            <Button variant="outline" size="sm">
              {t("viewSessions")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {loading && configs.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : configs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t("noConfigs")}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configs.map((config) => (
            <Link
              key={config.id}
              href={`/portals/configs/${config.id}`}
              className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                {portalTypeIcons[config.portalType] ?? (
                  <Users size={18} className="text-gray-400" />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {config.name}
                  </h3>
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {t(`types.${config.portalType}`)}
                  </Badge>
                </div>
              </div>
              {config.description && (
                <p className="text-xs text-gray-500 mt-3 line-clamp-2">
                  {config.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                <Badge
                  variant="outline"
                  className={
                    config.isActive
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }
                >
                  {config.isActive ? t("active") : t("inactive")}
                </Badge>
                {config.requireMfa && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    {t("mfaRequired")}
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
