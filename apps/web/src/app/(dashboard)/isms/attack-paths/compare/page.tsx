"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, GitCompare, Loader2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AttackPathComparison } from "@grc/shared";

export default function AttackPathComparePage() {
  return (
    <ModuleGate moduleKey="isms">
      <CompareInner />
    </ModuleGate>
  );
}

function CompareInner() {
  const t = useTranslations("attackPaths");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [beforeBatchId, setBeforeBatchId] = useState("");
  const [afterBatchId, setAfterBatchId] = useState("");
  const [comparison, setComparison] = useState<AttackPathComparison | null>(null);

  const runCompare = useCallback(async () => {
    if (!beforeBatchId || !afterBatchId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/attack-paths/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beforeBatchId, afterBatchId }),
      });
      if (res.ok) {
        const json = await res.json();
        setComparison(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [beforeBatchId, afterBatchId]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/isms/attack-paths")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{t("compareTitle")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("selectBatches")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("beforeBatch")}</Label>
              <Input
                value={beforeBatchId}
                onChange={(e) => setBeforeBatchId(e.target.value)}
                placeholder={t("batchIdPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("afterBatch")}</Label>
              <Input
                value={afterBatchId}
                onChange={(e) => setAfterBatchId(e.target.value)}
                placeholder={t("batchIdPlaceholder")}
              />
            </div>
          </div>
          <Button onClick={runCompare} disabled={loading || !beforeBatchId || !afterBatchId}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitCompare className="mr-2 h-4 w-4" />}
            {t("runComparison")}
          </Button>
        </CardContent>
      </Card>

      {comparison && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-green-600">{comparison.eliminated}</p>
              <p className="text-sm text-muted-foreground">{t("pathsEliminated")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-blue-600">{comparison.shortened}</p>
              <p className="text-sm text-muted-foreground">{t("pathsShortened")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-orange-600">{comparison.newPaths}</p>
              <p className="text-sm text-muted-foreground">{t("newPathsDetected")}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
