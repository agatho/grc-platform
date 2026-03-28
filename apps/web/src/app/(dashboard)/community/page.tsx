"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, RefreshCcw, Server, Users, Code, Shield } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface EditionConfig {
  id: string;
  editionType: string;
  enabledModules: string[];
  maxUsers: number;
  maxEntities: number;
  pluginSdkEnabled: boolean;
  apiAccessEnabled: boolean;
  deploymentType: string;
  telemetryOptIn: boolean;
}

export default function CommunityPage() {
  return (
    <ModuleGate moduleKey="community">
      <CommunityDashboard />
    </ModuleGate>
  );
}

function CommunityDashboard() {
  const t = useTranslations("community");
  const router = useRouter();
  const [config, setConfig] = useState<EditionConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/community/edition-config");
      if (res.ok) setConfig((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading && !config) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/community/contributions">
            <Button variant="outline" size="sm"><Code size={14} className="mr-1" />{t("contributions")}</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {config ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold mb-4">{t("editionInfo")}</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">{t("edition")}</dt>
                <dd><Badge className={config.editionType === "enterprise" ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"}>{config.editionType}</Badge></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{t("deployment")}</dt>
                <dd className="font-medium">{config.deploymentType.replace(/_/g, " ")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{t("maxUsers")}</dt>
                <dd className="font-medium">{config.maxUsers}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{t("maxEntities")}</dt>
                <dd className="font-medium">{config.maxEntities}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold mb-4">{t("features")}</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">{t("enabledModules")}</dt>
                <dd className="font-medium">{config.enabledModules.length} {t("modules")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{t("pluginSdk")}</dt>
                <dd><Badge variant="outline" className={config.pluginSdkEnabled ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>{config.pluginSdkEnabled ? t("enabled") : t("disabled")}</Badge></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{t("apiAccess")}</dt>
                <dd><Badge variant="outline" className={config.apiAccessEnabled ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>{config.apiAccessEnabled ? t("enabled") : t("disabled")}</Badge></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{t("telemetry")}</dt>
                <dd className="font-medium">{config.telemetryOptIn ? t("optedIn") : t("optedOut")}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">{t("noConfig")}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <Server size={18} className="text-blue-500 mb-2" />
          <h3 className="text-sm font-semibold">{t("dockerCompose")}</h3>
          <p className="text-xs text-gray-500 mt-1">{t("dockerComposeDesc")}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <Shield size={18} className="text-purple-500 mb-2" />
          <h3 className="text-sm font-semibold">{t("kubernetes")}</h3>
          <p className="text-xs text-gray-500 mt-1">{t("kubernetesDesc")}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <Users size={18} className="text-green-500 mb-2" />
          <h3 className="text-sm font-semibold">{t("communityForum")}</h3>
          <p className="text-xs text-gray-500 mt-1">{t("communityForumDesc")}</p>
        </div>
      </div>
    </div>
  );
}
