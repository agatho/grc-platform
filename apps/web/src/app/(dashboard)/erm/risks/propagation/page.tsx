"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Play, Plus, GitBranch, Zap, BarChart3 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  OrgEntityRelationship,
  OrgRelationshipType,
  RiskPropagationResult,
} from "@grc/shared";

const RELATIONSHIP_TYPES: OrgRelationshipType[] = [
  "shared_it",
  "shared_vendor",
  "shared_process",
  "financial_dependency",
  "data_flow",
];

export default function PropagationPage() {
  return (
    <ModuleGate moduleKey="erm">
      <PropagationInner />
    </ModuleGate>
  );
}

function PropagationInner() {
  const t = useTranslations("propagation");
  const router = useRouter();
  const [relationships, setRelationships] = useState<OrgEntityRelationship[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] =
    useState<RiskPropagationResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [targetOrgId, setTargetOrgId] = useState("");
  const [relType, setRelType] = useState<OrgRelationshipType>("shared_it");
  const [strength, setStrength] = useState(50);

  const fetchRelationships = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/v1/erm/propagation/relationships?limit=100",
      );
      if (res.ok) {
        const json = await res.json();
        setRelationships(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRelationships();
  }, [fetchRelationships]);

  const createRelationship = useCallback(async () => {
    if (!targetOrgId) return;
    const res = await fetch("/api/v1/erm/propagation/relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceOrgId: "current", // Will be set server-side
        targetOrgId,
        relationshipType: relType,
        strength,
      }),
    });
    if (res.ok) {
      setDialogOpen(false);
      void fetchRelationships();
    }
  }, [targetOrgId, relType, strength, fetchRelationships]);

  const runSimulation = useCallback(async (riskId: string) => {
    setSimulating(true);
    try {
      const res = await fetch("/api/v1/erm/propagation/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskId, simulatedLikelihood: 5 }),
      });
      if (res.ok) {
        const json = await res.json();
        setSimulationResult(json.data);
      }
    } finally {
      setSimulating(false);
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
            onClick={() => router.push("/erm/risks/propagation/heatmap")}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            {t("heatmap")}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("addRelationship")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("defineRelationship")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("targetOrg")}</Label>
                  <Input
                    value={targetOrgId}
                    onChange={(e) => setTargetOrgId(e.target.value)}
                    placeholder={t("orgIdPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("relationshipType")}</Label>
                  <Select
                    value={relType}
                    onValueChange={(v) => setRelType(v as OrgRelationshipType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIP_TYPES.map((rt) => (
                        <SelectItem key={rt} value={rt}>
                          {t(`relTypes.${rt}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    {t("couplingStrength")}: {strength}%
                  </Label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={strength}
                    onChange={(e) => setStrength(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <Button onClick={createRelationship}>{t("save")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Relationship Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            <GitBranch className="mr-2 inline h-5 w-5" />
            {t("relationships")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">{t("source")}</th>
                    <th className="p-3 text-left">{t("target")}</th>
                    <th className="p-3 text-left">{t("type")}</th>
                    <th className="p-3 text-right">{t("strength")}</th>
                  </tr>
                </thead>
                <tbody>
                  {relationships.map((rel) => (
                    <tr key={rel.id} className="border-b">
                      <td className="p-3">{rel.sourceOrgId.slice(0, 8)}...</td>
                      <td className="p-3">{rel.targetOrgId.slice(0, 8)}...</td>
                      <td className="p-3">
                        <Badge variant="outline">{rel.relationshipType}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Badge
                          variant={
                            rel.strength > 70
                              ? "destructive"
                              : rel.strength > 40
                                ? "default"
                                : "secondary"
                          }
                        >
                          {rel.strength}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {relationships.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-muted-foreground"
                      >
                        {t("noRelationships")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Simulation Result */}
      {simulationResult && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Zap className="mr-2 inline h-5 w-5" />
              {t("simulationResult")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-4">
              <Badge>
                {t("affectedEntities")}:{" "}
                {simulationResult.totalAffectedEntities}
              </Badge>
              <Badge variant="outline">
                {t("maxDepth")}: {simulationResult.maxDepth}
              </Badge>
            </div>
            <div className="space-y-2">
              {(
                simulationResult.resultsJson as Array<{
                  orgId: string;
                  level: number;
                  propagatedScore: number;
                  via: string;
                }>
              ).map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {t("level")} {entry.level}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {entry.orgId.slice(0, 8)}...
                    </span>
                    <Badge variant="outline" className="ml-2">
                      {entry.via}
                    </Badge>
                  </div>
                  <Badge variant="destructive">
                    {entry.propagatedScore.toFixed(1)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
