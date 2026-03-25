"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Building2,
  Database,
  Server,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";

import type { Asset, WorkItem } from "@grc/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import {
  CiaColorBar,
  protectionGoalClassColor,
  protectionGoalClassLabel,
} from "@/components/ui/cia-color-bar";
import { useTabNavigation } from "@/hooks/use-tab-navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssetDetail extends Asset {
  parentAsset?: { id: string; name: string } | null;
}

interface AssetWorkItem extends WorkItem {
  responsibleName?: string;
  typeDisplayName?: string;
}

interface InheritedCia {
  confidentiality: number | null;
  integrity: number | null;
  availability: number | null;
  authenticity: number | null;
  reliability: number | null;
  sourceAssetName: string | null;
}

// ---------------------------------------------------------------------------
// Tier icon mapping
// ---------------------------------------------------------------------------

const TIER_ICONS: Record<string, LucideIcon> = {
  business_structure: Building2,
  primary_asset: Database,
  supporting_asset: Server,
};

const TIER_BADGE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  business_structure: "default",
  primary_asset: "secondary",
  supporting_asset: "outline",
};

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function OverviewTab({
  asset,
  t,
}: {
  asset: AssetDetail;
  t: ReturnType<typeof useTranslations>;
}) {
  const fields = [
    { label: t("name"), value: asset.name },
    {
      label: t("tier"),
      value: t(`tiers.${asset.assetTier as "business_structure" | "primary_asset" | "supporting_asset"}`),
    },
    { label: t("parent"), value: asset.parentAsset?.name ?? "-" },
    { label: t("description"), value: asset.description ?? "-" },
    { label: t("codeGroup"), value: asset.codeGroup ?? "-" },
    { label: t("contactPerson"), value: asset.contactPerson ?? "-" },
    {
      label: t("dataProtectionResponsible"),
      value: asset.dataProtectionResponsible ?? "-",
    },
    { label: t("dpoEmail"), value: asset.dpoEmail ?? "-" },
    { label: t("latestAuditDate"), value: asset.latestAuditDate ?? "-" },
    { label: t("latestAuditResult"), value: asset.latestAuditResult ?? "-" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("overview")}</CardTitle>
        <CardDescription>{t("overviewDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="space-y-1">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {field.label}
              </dt>
              <dd className="text-sm text-gray-900">{field.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CIA Defaults tab
// ---------------------------------------------------------------------------

function CiaDefaultsTab({
  asset,
  inherited,
  onUpdate,
  t,
  tCia,
}: {
  asset: AssetDetail;
  inherited: InheritedCia | null;
  onUpdate: (field: string, value: number | null) => void;
  t: ReturnType<typeof useTranslations>;
  tCia: ReturnType<typeof useTranslations>;
}) {
  const ciaFields = [
    { key: "confidentiality", label: tCia("confidentiality"), value: asset.defaultConfidentiality ?? null },
    { key: "integrity", label: tCia("integrity"), value: asset.defaultIntegrity ?? null },
    { key: "availability", label: tCia("availability"), value: asset.defaultAvailability ?? null },
    { key: "authenticity", label: tCia("authenticity"), value: asset.defaultAuthenticity ?? null },
    { key: "reliability", label: tCia("reliability"), value: asset.defaultReliability ?? null },
  ];

  return (
    <div className="space-y-6">
      {/* Own CIA values */}
      <Card>
        <CardHeader>
          <CardTitle>{t("ciaDefaults")}</CardTitle>
          <CardDescription>{t("ciaDefaultsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ciaFields.map((field) => (
            <CiaColorBar
              key={field.key}
              label={field.label}
              value={field.value}
              onChange={(val) => onUpdate(`default${field.key.charAt(0).toUpperCase()}${field.key.slice(1)}`, val)}
            />
          ))}

          {/* Protection Goal Class */}
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <span className="text-sm font-medium text-gray-700">
              {t("protectionGoalClass")}
            </span>
            <Badge className={`border-0 ${protectionGoalClassColor(asset.protectionGoalClass)}`}>
              {asset.protectionGoalClass != null
                ? `${asset.protectionGoalClass} - ${protectionGoalClassLabel(asset.protectionGoalClass, tCia)}`
                : tCia("notSet")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Inherited / Effective CIA */}
      {inherited && (
        <Card>
          <CardHeader>
            <CardTitle>{t("effectiveCia")}</CardTitle>
            <CardDescription>
              {t("effectiveCiaDescription")}
              {inherited.sourceAssetName && (
                <span className="ml-1 font-medium text-gray-700">
                  ({inherited.sourceAssetName})
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: tCia("confidentiality"), value: inherited.confidentiality },
              { label: tCia("integrity"), value: inherited.integrity },
              { label: tCia("availability"), value: inherited.availability },
              { label: tCia("authenticity"), value: inherited.authenticity },
              { label: tCia("reliability"), value: inherited.reliability },
            ].map((field) => (
              <CiaColorBar
                key={field.label}
                label={field.label}
                value={field.value}
                readOnly
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Work Items tab
// ---------------------------------------------------------------------------

function WorkItemsTab({
  assetId,
  t,
  tWi,
}: {
  assetId: string;
  t: ReturnType<typeof useTranslations>;
  tWi: ReturnType<typeof useTranslations>;
}) {
  const router = useRouter();
  const [workItems, setWorkItems] = useState<AssetWorkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkItems() {
      try {
        const res = await fetch(`/api/v1/assets/${assetId}/work-items`);
        if (!res.ok) throw new Error("Failed");
        const json = (await res.json()) as { data: AssetWorkItem[] };
        setWorkItems(json.data);
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    void fetchWorkItems();
  }, [assetId]);

  const statusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "in_review":
      case "in_evaluation":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
      case "obsolete":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const columns: ColumnDef<AssetWorkItem, unknown>[] = [
    {
      accessorKey: "typeKey",
      header: ({ column }) => <SortableHeader column={column}>{tWi("type")}</SortableHeader>,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.typeDisplayName ?? row.original.typeKey}
        </Badge>
      ),
    },
    {
      accessorKey: "elementId",
      header: tWi("elementId"),
      cell: ({ row }) => (
        <code className="text-xs font-mono text-gray-600">
          {row.original.elementId ?? "-"}
        </code>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column}>{tWi("name")}</SortableHeader>,
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/work-items/${row.original.id}`)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: "status",
      header: tWi("status"),
      cell: ({ row }) => (
        <Badge className={`border-0 text-xs ${statusColor(row.original.status)}`}>
          {tWi(`statuses.${row.original.status as "draft" | "active" | "completed"}`)}
        </Badge>
      ),
    },
    {
      accessorKey: "responsibleName",
      header: tWi("responsible"),
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">
          {row.original.responsibleName ?? "-"}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("workItemsTab")}</CardTitle>
        <CardDescription>{t("workItemsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={workItems}
          searchKey="name"
          searchPlaceholder={tWi("searchPlaceholder")}
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assetId = params.id as string;

  const t = useTranslations("assets");
  const tCia = useTranslations("cia");
  const tWi = useTranslations("workItems");
  const tCommon = useTranslations("common");
  const { openTab } = useTabNavigation();

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [inherited, setInherited] = useState<InheritedCia | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAsset = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/assets/${assetId}`);
      if (!res.ok) throw new Error("Not found");
      const json = (await res.json()) as { data: AssetDetail; inherited?: InheritedCia };
      setAsset(json.data);
      if (json.inherited) {
        setInherited(json.inherited);
      }
    } catch {
      setAsset(null);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void fetchAsset();
  }, [fetchAsset]);

  // Register tab when asset loads
  useEffect(() => {
    if (asset) {
      openTab({
        id: `asset-${assetId}`,
        label: asset.name,
        href: `/assets/${assetId}`,
        icon: TIER_ICONS[asset.assetTier] === Building2
          ? "Building2"
          : TIER_ICONS[asset.assetTier] === Server
            ? "Server"
            : "Database",
      });
    }
  }, [asset]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCiaUpdate = async (field: string, value: number | null) => {
    if (!asset) return;
    try {
      const res = await fetch(`/api/v1/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as { data: AssetDetail };
      setAsset(json.data);
    } catch {
      // revert by refetching
      void fetchAsset();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400 mr-2" />
        <p className="text-sm text-gray-500">{tCommon("loading")}</p>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="space-y-4">
        <p className="text-gray-500">{t("notFound")}</p>
        <Link href="/assets">
          <Button variant="outline">
            <ArrowLeft size={16} />
            {t("backToList")}
          </Button>
        </Link>
      </div>
    );
  }

  const TierIcon = TIER_ICONS[asset.assetTier] ?? Database;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <TierIcon size={20} className="text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{asset.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={TIER_BADGE_VARIANTS[asset.assetTier] ?? "secondary"}>
                {t(`tiers.${asset.assetTier as "business_structure" | "primary_asset" | "supporting_asset"}`)}
              </Badge>
              {asset.protectionGoalClass != null && (
                <Badge className={`border-0 ${protectionGoalClassColor(asset.protectionGoalClass)}`}>
                  PGC: {asset.protectionGoalClass}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Link href="/assets">
          <Button variant="outline" size="sm">
            <ArrowLeft size={16} />
            {t("backToList")}
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
          <TabsTrigger value="cia">{t("ciaDefaults")}</TabsTrigger>
          <TabsTrigger value="work-items">{t("workItemsTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab asset={asset} t={t} />
        </TabsContent>

        <TabsContent value="cia">
          <CiaDefaultsTab
            asset={asset}
            inherited={inherited}
            onUpdate={handleCiaUpdate}
            t={t}
            tCia={tCia}
          />
        </TabsContent>

        <TabsContent value="work-items">
          <WorkItemsTab assetId={assetId} t={t} tWi={tWi} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
