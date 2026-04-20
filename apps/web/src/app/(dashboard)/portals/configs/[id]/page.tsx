"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PortalConfigDetail {
  id: string;
  portalType: string;
  name: string;
  description: string | null;
  isActive: boolean;
  requireMfa: boolean;
  sessionTimeoutMinutes: number;
  allowedLanguages: string[];
  welcomeMessage: string | null;
  createdAt: string;
}

export default function PortalConfigDetailPage() {
  return (
    <ModuleGate moduleKey="portals">
      <ConfigDetail />
    </ModuleGate>
  );
}

function ConfigDetail() {
  const t = useTranslations("portals");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [config, setConfig] = useState<PortalConfigDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/portals/configs/${id}`);
      if (res.ok) setConfig((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-12 text-gray-400">{t("notFound")}</div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} /> {t("backToPortals")}
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{t(`types.${config.portalType}`)}</Badge>
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
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold mb-4">{t("settings")}</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">{t("mfaRequired")}</dt>
              <dd className="font-medium">
                {config.requireMfa ? t("yes") : t("no")}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">{t("sessionTimeout")}</dt>
              <dd className="font-medium">
                {config.sessionTimeoutMinutes} min
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">{t("languages")}</dt>
              <dd className="font-medium">
                {config.allowedLanguages.join(", ")}
              </dd>
            </div>
          </dl>
        </div>

        {config.description && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold mb-4">
              {t("detailDescription")}
            </h2>
            <p className="text-sm text-gray-700">{config.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
