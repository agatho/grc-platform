"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  Shield,
  Target,
  Crown,
  GitCompare,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AttackPathResult, AttackPathHop } from "@grc/shared";

export default function AttackPathsPage() {
  return (
    <ModuleGate moduleKey="isms">
      <AttackPathsInner />
    </ModuleGate>
  );
}

function AttackPathsInner() {
  const t = useTranslations("attackPaths");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [paths, setPaths] = useState<AttackPathResult[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<AttackPathResult | null>(
    null,
  );
  const [recommendations, setRecommendations] = useState<
    Array<{ controlId: string; controlName: string; eliminatedPaths: number }>
  >([]);

  const computePaths = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/attack-paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxDepth: 10 }),
      });
      if (res.ok) {
        const json = await res.json();
        const newBatchId = json.data.batchId;
        setBatchId(newBatchId);

        if (json.data.pathCount > 0) {
          const pathRes = await fetch(
            `/api/v1/isms/attack-paths/${newBatchId}`,
          );
          if (pathRes.ok) {
            const pathJson = await pathRes.json();
            setPaths(pathJson.data ?? []);
          }

          const recRes = await fetch(
            `/api/v1/isms/attack-paths/${newBatchId}/recommendations`,
          );
          if (recRes.ok) {
            const recJson = await recRes.json();
            setRecommendations(recJson.data ?? []);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/isms/attack-paths/compare")}
          >
            <GitCompare className="mr-2 h-4 w-4" />
            {t("compare")}
          </Button>
          <Button onClick={computePaths} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            {t("calculatePaths")}
          </Button>
        </div>
      </div>

      {/* Attack Path Graph Area (D3.js would be integrated here) */}
      <Card>
        <CardHeader>
          <CardTitle>{t("attackGraph")}</CardTitle>
        </CardHeader>
        <CardContent>
          {paths.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <p>{t("noPathsCalculated")}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {paths.length} {t("pathsFound")}
              </p>
              {/* D3.js force-directed graph would render here */}
              <div className="h-96 rounded-lg border bg-muted/20 flex items-center justify-center">
                <p className="text-muted-foreground">{t("graphPlaceholder")}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Path List */}
      {paths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("criticalPaths")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">{t("entryPoint")}</th>
                    <th className="p-3 text-left">{t("target")}</th>
                    <th className="p-3 text-right">{t("hops")}</th>
                    <th className="p-3 text-right">{t("riskScore")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paths.slice(0, 20).map((path) => (
                    <tr
                      key={path.id}
                      className="cursor-pointer border-b hover:bg-muted/25"
                      onClick={() => setSelectedPath(path)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-orange-500" />
                          {path.entryAssetId.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-red-500" />
                          {path.targetAssetId.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="p-3 text-right">{path.hopCount}</td>
                      <td className="p-3 text-right">
                        <Badge
                          variant={
                            Number(path.riskScore) > 70
                              ? "destructive"
                              : Number(path.riskScore) > 40
                                ? "default"
                                : "secondary"
                          }
                        >
                          {Number(path.riskScore).toFixed(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Shield className="mr-2 inline h-5 w-5" />
              {t("recommendations")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div
                  key={rec.controlId}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div>
                    <p className="font-medium">
                      #{i + 1} {rec.controlName || rec.controlId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("wouldEliminate", { count: rec.eliminatedPaths })}
                    </p>
                  </div>
                  <Badge>
                    {rec.eliminatedPaths} {t("paths")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Path Detail Sheet */}
      <Sheet open={!!selectedPath} onOpenChange={() => setSelectedPath(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("pathDetail")}</SheetTitle>
          </SheetHeader>
          {selectedPath && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="destructive">
                  {t("riskScore")}: {Number(selectedPath.riskScore).toFixed(1)}
                </Badge>
                <Badge variant="outline">
                  {selectedPath.hopCount} {t("hops")}
                </Badge>
              </div>
              <div className="space-y-2">
                {(selectedPath.pathJson as AttackPathHop[]).map((hop, i) => (
                  <div key={i} className="rounded border p-3 text-sm">
                    <p className="font-medium">
                      {hop.assetName || hop.assetId}
                    </p>
                    {hop.cveIds.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {hop.cveIds.map((cve) => (
                          <Badge
                            key={cve}
                            variant="outline"
                            className="text-xs"
                          >
                            {cve}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {hop.controlGaps.length > 0 && (
                      <p className="mt-1 text-destructive">
                        {t("missingControls")}: {hop.controlGaps.join(", ")}
                      </p>
                    )}
                    <p className="mt-1 text-muted-foreground">
                      {t("probability")}:{" "}
                      {(hop.hopProbability * 100).toFixed(0)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
