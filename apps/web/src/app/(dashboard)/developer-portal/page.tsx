"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Key,
  Plus,
  Shield,
  Activity,
  Code2,
  AppWindow,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  keyLast4: string;
  status: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  rateLimitPerMinute: number;
  createdAt: string;
}

interface UsageStats {
  totalRequests: number;
  avgResponseTime: number;
  successRate: string;
  errorCount: number;
}

export default function DeveloperPortalPage() {
  const t = useTranslations("developerPortal");
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, statsRes] = await Promise.all([
        fetch("/api/v1/api-keys"),
        fetch("/api/v1/api-keys/usage/stats"),
      ]);
      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setApiKeys(keysData.data ?? []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRevoke = async (id: string) => {
    await fetch(`/api/v1/api-keys/${id}`, { method: "DELETE" });
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/developer-portal/playground">
            <Button variant="outline">
              <Code2 className="mr-2 h-4 w-4" />
              {t("playground")}
            </Button>
          </Link>
          <Link href="/developer-portal/api-keys/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("createApiKey")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.totalRequests")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalRequests?.toLocaleString() ?? "0"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.avgResponseTime")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avgResponseTime ? `${Math.round(stats.avgResponseTime)}ms` : "N/A"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.successRate")}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.successRate ?? "0"}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.apiKeys")}</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiKeys.filter((k) => k.status === "active").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/developer-portal/api-keys">
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardHeader>
              <Key className="h-8 w-8 text-primary mb-2" />
              <CardTitle>{t("nav.apiKeys")}</CardTitle>
              <CardDescription>{t("nav.apiKeysDesc")}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/developer-portal/apps">
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardHeader>
              <AppWindow className="h-8 w-8 text-primary mb-2" />
              <CardTitle>{t("nav.developerApps")}</CardTitle>
              <CardDescription>{t("nav.developerAppsDesc")}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/developer-portal/playground">
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardHeader>
              <Code2 className="h-8 w-8 text-primary mb-2" />
              <CardTitle>{t("nav.playground")}</CardTitle>
              <CardDescription>{t("nav.playgroundDesc")}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("apiKeysTable.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("apiKeysTable.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">{t("apiKeysTable.name")}</th>
                    <th className="text-left py-2 px-3 font-medium">{t("apiKeysTable.key")}</th>
                    <th className="text-left py-2 px-3 font-medium">{t("apiKeysTable.status")}</th>
                    <th className="text-left py-2 px-3 font-medium">{t("apiKeysTable.lastUsed")}</th>
                    <th className="text-left py-2 px-3 font-medium">{t("apiKeysTable.rateLimit")}</th>
                    <th className="text-right py-2 px-3 font-medium">{t("apiKeysTable.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="border-b">
                      <td className="py-2 px-3 font-medium">{key.name}</td>
                      <td className="py-2 px-3 font-mono text-xs">
                        {key.keyPrefix}...{key.keyLast4}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={key.status === "active" ? "default" : "destructive"}>
                          {key.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        {key.lastUsedAt
                          ? new Date(key.lastUsedAt).toLocaleDateString()
                          : t("apiKeysTable.neverUsed")}
                      </td>
                      <td className="py-2 px-3">{key.rateLimitPerMinute}/min</td>
                      <td className="py-2 px-3 text-right">
                        {key.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(key.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
