"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Network,
  ShieldAlert,
  Settings2,
  FileText,
  Layers,
  Building2,
  AlertTriangle,
  Search,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import type { EntityReference } from "@grc/shared";

// ── Props ─────────────────────────────────────────────────────

interface WhereUsedTabProps {
  entityType: string;
  entityId: string;
}

// ── Entity type metadata ──────────────────────────────────────

const ENTITY_TYPE_META: Record<
  string,
  { label: string; icon: typeof ShieldAlert; color: string; href: (id: string) => string }
> = {
  risk: {
    label: "Risks",
    icon: AlertTriangle,
    color: "text-red-600",
    href: (id) => `/risks/${id}`,
  },
  control: {
    label: "Controls",
    icon: ShieldAlert,
    color: "text-blue-600",
    href: (id) => `/controls/${id}`,
  },
  process: {
    label: "Processes",
    icon: Settings2,
    color: "text-green-600",
    href: (id) => `/processes/${id}`,
  },
  process_step: {
    label: "Process Steps",
    icon: Layers,
    color: "text-green-500",
    href: (id) => `/processes?step=${id}`,
  },
  asset: {
    label: "Assets",
    icon: Building2,
    color: "text-purple-600",
    href: (id) => `/assets/${id}`,
  },
  document: {
    label: "Documents",
    icon: FileText,
    color: "text-amber-600",
    href: (id) => `/documents/${id}`,
  },
  finding: {
    label: "Findings",
    icon: Search,
    color: "text-orange-600",
    href: (id) => `/findings/${id}`,
  },
  incident: {
    label: "Incidents",
    icon: AlertTriangle,
    color: "text-red-500",
    href: (id) => `/isms/incidents/${id}`,
  },
  vendor: {
    label: "Vendors",
    icon: Building2,
    color: "text-indigo-600",
    href: (id) => `/vendors/${id}`,
  },
  audit: {
    label: "Audits",
    icon: Search,
    color: "text-teal-600",
    href: (id) => `/audit/${id}`,
  },
  kri: {
    label: "KRIs",
    icon: Network,
    color: "text-yellow-600",
    href: (id) => `/risks?kri=${id}`,
  },
};

function getEntityMeta(type: string) {
  return (
    ENTITY_TYPE_META[type] ?? {
      label: type.replace(/_/g, " "),
      icon: Layers,
      color: "text-gray-600",
      href: () => "#",
    }
  );
}

// ── Relationship badge ────────────────────────────────────────

const RELATIONSHIP_COLORS: Record<string, string> = {
  mitigates: "bg-blue-100 text-blue-700",
  affects: "bg-red-100 text-red-700",
  implemented_in: "bg-green-100 text-green-700",
  documented_in: "bg-amber-100 text-amber-700",
  found_in: "bg-orange-100 text-orange-700",
  affected: "bg-red-100 text-red-600",
  tested_by: "bg-teal-100 text-teal-700",
  linked_to: "bg-gray-100 text-gray-700",
  depends_on: "bg-purple-100 text-purple-700",
};

// ── Impact depth colors ───────────────────────────────────────

const DEPTH_COLORS: Record<number, string> = {
  1: "border-red-400 bg-red-50",
  2: "border-orange-400 bg-orange-50",
  3: "border-yellow-400 bg-yellow-50",
};

// ── Component ─────────────────────────────────────────────────

export function WhereUsedTab({ entityType, entityId }: WhereUsedTabProps) {
  const t = useTranslations("platform");
  const [references, setReferences] = useState<EntityReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/references/${entityType}/${entityId}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setReferences(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load references");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchReferences();
  }, [fetchReferences]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  // Group references by the OTHER entity type (not the current entity)
  const grouped: Record<string, EntityReference[]> = {};
  for (const ref of references) {
    const otherType =
      ref.sourceType === entityType && ref.sourceId === entityId
        ? ref.targetType
        : ref.sourceType;
    if (!grouped[otherType]) grouped[otherType] = [];
    grouped[otherType].push(ref);
  }

  const totalCount = references.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {t("whereUsed.title")} ({totalCount})
        </h3>
        <ImpactAnalysisDialog entityType={entityType} entityId={entityId} />
      </div>

      {totalCount === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          {t("whereUsed.noReferences")}
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([type, refs]) => {
            const meta = getEntityMeta(type);
            const Icon = meta.icon;
            return (
              <Card key={type}>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                    {meta.label} ({refs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <ul className="space-y-1.5">
                    {refs.map((ref) => {
                      const otherId =
                        ref.sourceType === entityType &&
                        ref.sourceId === entityId
                          ? ref.targetId
                          : ref.sourceId;
                      return (
                        <li
                          key={ref.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs text-muted-foreground truncate">
                              {otherId.slice(0, 8)}...
                            </span>
                            <Badge
                              variant="secondary"
                              className={
                                RELATIONSHIP_COLORS[ref.relationship] ??
                                "bg-gray-100 text-gray-600"
                              }
                            >
                              {ref.relationship.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <Link
                            href={meta.href(otherId)}
                            className="ml-2 flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                          >
                            {t("whereUsed.viewDetail")}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Impact Analysis Dialog ────────────────────────────────────

interface ImpactData {
  rootEntityType: string;
  rootEntityId: string;
  maxDepth: number;
  totalAffected: number;
  byDepth: Record<
    number,
    Array<{ entityType: string; entityId: string; relationship: string }>
  >;
}

function ImpactAnalysisDialog({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const t = useTranslations("platform");
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchImpact = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/references/${entityType}/${entityId}/impact?maxDepth=3`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setImpact(json.data);
    } catch {
      setImpact(null);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (open) fetchImpact();
  }, [open, fetchImpact]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Network className="h-4 w-4" />
          {t("whereUsed.analyzeImpact")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            {t("whereUsed.impactAnalysis")}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : impact ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              {t("whereUsed.totalAffected")}: <strong>{impact.totalAffected}</strong>
            </div>
            {[1, 2, 3].map((depth) => {
              const items = impact.byDepth[depth];
              if (!items?.length) return null;
              const depthStyle = DEPTH_COLORS[depth] ?? "border-gray-300 bg-gray-50";
              return (
                <div key={depth} className={`rounded-lg border-2 p-3 ${depthStyle}`}>
                  <h4 className="text-sm font-semibold mb-2">
                    {depth === 1
                      ? t("whereUsed.directlyAffected")
                      : t("whereUsed.indirectlyAffected", { depth })}
                    {" "}({items.length})
                  </h4>
                  <ul className="space-y-1">
                    {items.map((item, idx) => {
                      const meta = getEntityMeta(item.entityType);
                      const Icon = meta.icon;
                      return (
                        <li
                          key={`${item.entityType}-${item.entityId}-${idx}`}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                          <span className="capitalize">
                            {item.entityType.replace(/_/g, " ")}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.entityId.slice(0, 8)}...
                          </span>
                          <Badge
                            variant="secondary"
                            className={
                              RELATIONSHIP_COLORS[item.relationship] ??
                              "bg-gray-100 text-gray-600"
                            }
                          >
                            {item.relationship.replace(/_/g, " ")}
                          </Badge>
                          <Link
                            href={meta.href(item.entityId)}
                            className="ml-auto text-xs text-primary hover:underline"
                          >
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {t("whereUsed.noImpact")}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
