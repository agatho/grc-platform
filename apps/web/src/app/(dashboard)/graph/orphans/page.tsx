"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Unlink,
  Loader2,
  RefreshCcw,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Network,
  Shield,
  Bug,
  Cpu,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import type { OrphansResponse, OrphanEntityData } from "@grc/shared";
import { GRAPH_ENTITY_COLORS } from "@grc/shared";

function OrphanSection({
  title,
  icon: Icon,
  orphans,
  emptyMessage,
}: {
  title: string;
  icon: React.ElementType;
  orphans: OrphanEntityData[];
  emptyMessage: string;
}) {
  const t = useTranslations("graph");

  if (orphans.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <span className="font-medium">{title}</span>
          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
            0
          </Badge>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-orange-500" />
        <span className="font-medium">{title}</span>
        <Badge variant="destructive">{orphans.length}</Badge>
      </div>
      <div className="space-y-2">
        {orphans.map((orphan) => (
          <div
            key={orphan.entityId}
            className="flex items-center justify-between py-2 px-3 rounded-md border bg-background hover:bg-accent/50"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: GRAPH_ENTITY_COLORS[orphan.entityType] ?? "#6b7280" }}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{orphan.entityName}</div>
                <div className="text-xs text-muted-foreground">
                  {orphan.elementId && <span className="mr-2">{orphan.elementId}</span>}
                  <span>{orphan.missingRelationship}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Link href={`/graph/explorer?entityId=${orphan.entityId}&entityType=${orphan.entityType}`}>
                <Button variant="ghost" size="sm">
                  <Network className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={orphan.fixUrl}>
                <Button variant="outline" size="sm">
                  {t("orphans.fixThis")}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function OrphanDetectionPage() {
  const t = useTranslations("graph");

  const [orphans, setOrphans] = useState<OrphansResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/graph/orphans");
      if (res.ok) {
        const data = await res.json();
        setOrphans(data);
      }
    } catch (err) {
      console.error("Failed to fetch orphans:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalOrphans = orphans
    ? orphans.risksWithoutControls.length +
      orphans.controlsWithoutTests.length +
      orphans.assetsWithoutProtection.length +
      orphans.processesWithoutControls.length
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Unlink className="h-6 w-6" />
            {t("orphans.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("orphans.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Link href="/graph/explorer">
            <Button variant="outline" size="sm">
              {t("explorer.title")}
            </Button>
          </Link>
          <Link href="/graph/dependencies">
            <Button variant="outline" size="sm">
              {t("dependencies.title")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary */}
      {orphans && (
        <Card className={`p-4 ${totalOrphans > 0 ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : "border-green-300 bg-green-50 dark:bg-green-950/20"}`}>
          <div className="flex items-center gap-2">
            {totalOrphans > 0 ? (
              <>
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span className="font-medium text-orange-700 dark:text-orange-400">
                  {t("orphans.totalOrphans", { count: totalOrphans })}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium text-green-700 dark:text-green-400">
                  {t("orphans.noOrphans")}
                </span>
              </>
            )}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : orphans ? (
        <div className="space-y-4">
          <OrphanSection
            title={t("orphans.risksWithoutControls")}
            icon={AlertTriangle}
            orphans={orphans.risksWithoutControls}
            emptyMessage=""
          />
          <OrphanSection
            title={t("orphans.controlsWithoutTests")}
            icon={Shield}
            orphans={orphans.controlsWithoutTests}
            emptyMessage=""
          />
          <OrphanSection
            title={t("orphans.assetsWithoutProtection")}
            icon={Cpu}
            orphans={orphans.assetsWithoutProtection}
            emptyMessage=""
          />
          <OrphanSection
            title={t("orphans.processesWithoutControls")}
            icon={Workflow}
            orphans={orphans.processesWithoutControls}
            emptyMessage=""
          />
        </div>
      ) : null}
    </div>
  );
}
