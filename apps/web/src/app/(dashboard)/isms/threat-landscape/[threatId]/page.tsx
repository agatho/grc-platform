"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Loader2,
  RefreshCcw,
  ExternalLink,
  Activity,
  AlertTriangle,
  CheckCircle,
  Plus,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ThreatDetail {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  threatCategory: string | null;
  likelihoodRating: number | null;
  createdAt: string;
}

interface AffectedAsset {
  assetId: string;
  assetName: string;
  tier: string;
  vulnerabilityCount: number;
  controlCoverage: number;
  cveCount: number;
}

export default function ThreatDetailPage() {
  const t = useTranslations("reporting");
  const params = useParams();
  const threatId = params.threatId as string;

  const [threat, setThreat] = useState<ThreatDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/isms/threats/${threatId}`);
      if (res.ok) {
        const { data } = await res.json();
        setThreat(data);
      }
    } finally {
      setLoading(false);
    }
  }, [threatId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <ModuleGate moduleKey="isms">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ModuleGate>
    );
  }

  if (!threat) {
    return (
      <ModuleGate moduleKey="isms">
        <div className="text-center py-24">
          <p className="text-muted-foreground">{t("threatNotFound")}</p>
          <Link href="/isms/threat-landscape">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("backToLandscape")}
            </Button>
          </Link>
        </div>
      </ModuleGate>
    );
  }

  return (
    <ModuleGate moduleKey="isms">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/isms/threat-landscape">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-600" />
                <h1 className="text-2xl font-bold tracking-tight">
                  {threat.code ? `${threat.code} — ` : ""}
                  {threat.title}
                </h1>
              </div>
              <div className="flex gap-2 mt-1">
                {threat.threatCategory && (
                  <Badge variant="outline">{threat.threatCategory}</Badge>
                )}
                {threat.likelihoodRating !== null && (
                  <Badge
                    variant={
                      threat.likelihoodRating >= 4
                        ? "destructive"
                        : threat.likelihoodRating >= 3
                          ? "default"
                          : "secondary"
                    }
                  >
                    {t("likelihood")}: {threat.likelihoodRating}/5
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              {t("planMeasure")}
            </Button>
            <Button onClick={fetchData} variant="ghost" size="icon">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Description */}
        {threat.description && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">
                {threat.description}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Threat Info */}
          <div className="col-span-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {t("threatDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{t("threatCode")}</dt>
                    <dd className="font-medium">{threat.code || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("threatCategory")}
                    </dt>
                    <dd className="font-medium">
                      {threat.threatCategory || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("likelihood")}
                    </dt>
                    <dd className="font-medium">
                      {threat.likelihoodRating !== null
                        ? `${threat.likelihoodRating}/5`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("firstDetected")}
                    </dt>
                    <dd className="font-medium">
                      {new Date(threat.createdAt).toLocaleDateString("de-DE")}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Timeline placeholder */}
          <div className="col-span-4">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-sm">{t("timeline")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
                    <div>
                      <p className="font-medium">{t("threatCreated")}</p>
                      <p className="text-muted-foreground">
                        {new Date(threat.createdAt).toLocaleDateString(
                          "de-DE",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ModuleGate>
  );
}
