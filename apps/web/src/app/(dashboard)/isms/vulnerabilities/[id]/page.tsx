"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  Bug,
  Loader2,
  AlertTriangle,
  Shield,
  Server,
  History,
  Activity,
  Calendar,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Vulnerability {
  id: string;
  title: string;
  description: string | null;
  cveReference: string | null;
  affectedAssetId: string | null;
  severity: string;
  status: string;
  mitigationControlId: string | null;
  createdAt: string;
}

interface Asset {
  id: string;
  name: string;
  assetTier: string;
}

export default function VulnerabilityDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <VulnerabilityDetailInner />
    </ModuleGate>
  );
}

function VulnerabilityDetailInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("isms");

  const [vuln, setVuln] = useState<Vulnerability | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/isms/vulnerabilities/${id}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data ?? json;
        setVuln(data);

        // Fetch linked asset if available
        if (data.affectedAssetId) {
          try {
            const assetRes = await fetch(
              `/api/v1/assets/${data.affectedAssetId}`,
            );
            if (assetRes.ok) {
              const assetJson = await assetRes.json();
              setAsset(assetJson.data ?? assetJson);
            }
          } catch {
            /* asset fetch failed */
          }
        }
      }
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

  if (!vuln) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Bug size={32} className="mb-3 text-gray-400" />
        <p className="text-sm font-medium">Schwachstelle nicht gefunden</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => router.push("/isms/vulnerabilities")}
        >
          <ArrowLeft size={14} className="mr-1" /> Zurück zur Liste
        </Button>
      </div>
    );
  }

  const severityColor: Record<string, string> = {
    critical: "bg-red-100 text-red-900 border-red-300",
    high: "bg-orange-100 text-orange-900 border-orange-300",
    medium: "bg-yellow-100 text-yellow-900 border-yellow-300",
    low: "bg-green-100 text-green-900 border-green-300",
    info: "bg-blue-100 text-blue-900 border-blue-300",
  };

  const statusColor: Record<string, string> = {
    open: "bg-red-100 text-red-900 border-red-300",
    in_remediation: "bg-yellow-100 text-yellow-900 border-yellow-300",
    mitigated: "bg-green-100 text-green-900 border-green-300",
    accepted: "bg-blue-100 text-blue-900 border-blue-300",
    closed: "bg-gray-100 text-gray-900 border-gray-300",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/isms/vulnerabilities")}
          className="mt-1 shrink-0"
        >
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Bug size={20} className="text-orange-600 shrink-0" />
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {vuln.title}
            </h1>
            {vuln.cveReference && (
              <Badge variant="outline" className="font-mono text-xs">
                {vuln.cveReference}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`text-xs ${severityColor[vuln.severity] ?? ""}`}
            >
              {vuln.severity}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${statusColor[vuln.status] ?? ""}`}
            >
              {vuln.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Bug size={14} className="mr-1.5" />
            Übersicht
          </TabsTrigger>
          <TabsTrigger value="asset">
            <Server size={14} className="mr-1.5" />
            Betroffenes Asset
          </TabsTrigger>
          <TabsTrigger value="mitigation">
            <ShieldCheck size={14} className="mr-1.5" />
            Maßnahmen
          </TabsTrigger>
          <TabsTrigger value="history">
            <History size={14} className="mr-1.5" />
            Verlauf
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  Schwachstellendetails
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt className="text-gray-500 font-medium">Titel</dt>
                    <dd className="text-gray-900 mt-0.5">{vuln.title}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 font-medium">Schweregrad</dt>
                    <dd className="mt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${severityColor[vuln.severity] ?? ""}`}
                      >
                        {vuln.severity}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 font-medium">Status</dt>
                    <dd className="mt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${statusColor[vuln.status] ?? ""}`}
                      >
                        {vuln.status}
                      </Badge>
                    </dd>
                  </div>
                  {vuln.cveReference && (
                    <div>
                      <dt className="text-gray-500 font-medium">
                        CVE-Referenz
                      </dt>
                      <dd className="mt-0.5">
                        <a
                          href={`https://nvd.nist.gov/vuln/detail/${vuln.cveReference}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 hover:underline inline-flex items-center gap-1"
                        >
                          {vuln.cveReference}
                          <ExternalLink size={12} />
                        </a>
                      </dd>
                    </div>
                  )}
                  {vuln.description && (
                    <div className="sm:col-span-2">
                      <dt className="text-gray-500 font-medium">
                        Beschreibung
                      </dt>
                      <dd className="text-gray-900 mt-0.5 whitespace-pre-wrap">
                        {vuln.description}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metadaten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar size={14} className="shrink-0" />
                  <span>
                    Erstellt:{" "}
                    {new Date(vuln.createdAt).toLocaleDateString("de-DE")}
                  </span>
                </div>
                {asset && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Server size={14} className="shrink-0" />
                    <Link
                      href={`/isms/assets/${asset.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {asset.name}
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Affected Asset */}
        <TabsContent value="asset" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Betroffenes Asset</CardTitle>
            </CardHeader>
            <CardContent>
              {asset ? (
                <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
                  <Server size={24} className="text-blue-600 shrink-0" />
                  <div className="flex-1">
                    <Link
                      href={`/isms/assets/${asset.id}`}
                      className="text-sm font-medium text-blue-700 hover:underline"
                    >
                      {asset.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {asset.assetTier}
                    </p>
                  </div>
                  <Link href={`/isms/assets/${asset.id}`}>
                    <Button variant="outline" size="sm">
                      Details anzeigen
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
                  <Server size={28} className="text-gray-400 mb-3" />
                  <p className="text-sm text-gray-500">
                    Kein Asset zugeordnet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mitigation */}
        <TabsContent value="mitigation" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gegenmaßnahmen</CardTitle>
            </CardHeader>
            <CardContent>
              {vuln.mitigationControlId ? (
                <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
                  <ShieldCheck size={24} className="text-green-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Verknüpfte Kontrolle
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ID: {vuln.mitigationControlId}
                    </p>
                  </div>
                  <Link href={`/controls/${vuln.mitigationControlId}`}>
                    <Button variant="outline" size="sm">
                      Kontrolle anzeigen
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
                  <ShieldCheck size={28} className="text-gray-400 mb-3" />
                  <p className="text-sm text-gray-500">
                    Keine Gegenmaßnahme zugeordnet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Änderungsverlauf</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
                <Activity size={28} className="text-gray-400 mb-3" />
                <p className="text-sm text-gray-500">Verlauf wird geladen...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
