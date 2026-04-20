"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Building2,
  Database,
  Server,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  protectionGoalClassColor,
  protectionGoalClassLabel,
} from "@/components/ui/cia-color-bar";
import { useTabNavigation } from "@/hooks/use-tab-navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssetNode {
  id: string;
  name: string;
  assetTier: "business_structure" | "primary_asset" | "supporting_asset";
  protectionGoalClass: number | null;
  visibleInModules: string[];
  children: AssetNode[];
}

// ---------------------------------------------------------------------------
// Tier icon mapping
// ---------------------------------------------------------------------------

const TIER_ICONS: Record<string, LucideIcon> = {
  business_structure: Building2,
  primary_asset: Database,
  supporting_asset: Server,
};

const TIER_BADGE_VARIANTS: Record<string, "default" | "secondary" | "outline"> =
  {
    business_structure: "default",
    primary_asset: "secondary",
    supporting_asset: "outline",
  };

// ---------------------------------------------------------------------------
// Module filter options
// ---------------------------------------------------------------------------

const MODULE_FILTERS = ["all", "erm", "isms", "bcm"] as const;
type ModuleFilter = (typeof MODULE_FILTERS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectIds(nodes: AssetNode[]): Set<string> {
  const ids = new Set<string>();
  function walk(list: AssetNode[]) {
    for (const node of list) {
      if (node.children.length > 0) {
        ids.add(node.id);
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return ids;
}

function filterByModule(nodes: AssetNode[], filter: ModuleFilter): AssetNode[] {
  if (filter === "all") return nodes;
  return nodes
    .filter((n) => n.visibleInModules.includes(filter))
    .map((n) => ({
      ...n,
      children: filterByModule(n.children, filter),
    }));
}

function flattenAssets(
  nodes: AssetNode[],
): { id: string; name: string; tier: string }[] {
  const result: { id: string; name: string; tier: string }[] = [];
  function walk(list: AssetNode[]) {
    for (const node of list) {
      result.push({ id: node.id, name: node.name, tier: node.assetTier });
      walk(node.children);
    }
  }
  walk(nodes);
  return result;
}

// ---------------------------------------------------------------------------
// Tree node
// ---------------------------------------------------------------------------

function AssetTreeNode({
  node,
  level,
  expanded,
  onToggle,
  onNavigate,
  t,
  tCia,
}: {
  node: AssetNode;
  level: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
  tCia: ReturnType<typeof useTranslations>;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const TierIcon = TIER_ICONS[node.assetTier] ?? Database;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors group"
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        {/* Expand / collapse toggle */}
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-gray-200 transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-gray-500" />
            ) : (
              <ChevronRight size={14} className="text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Tier icon */}
        <TierIcon size={16} className="shrink-0 text-gray-400" />

        {/* Asset name — link to detail */}
        <button
          onClick={() => onNavigate(node.id)}
          className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors text-left"
        >
          {node.name}
        </button>

        {/* Tier badge */}
        <Badge
          variant={TIER_BADGE_VARIANTS[node.assetTier] ?? "secondary"}
          className="text-[10px] px-1.5 py-0"
        >
          {t(
            `tiers.${node.assetTier as "business_structure" | "primary_asset" | "supporting_asset"}`,
          )}
        </Badge>

        {/* Protection goal class badge */}
        {node.protectionGoalClass != null && (
          <Badge
            className={`text-[10px] px-1.5 py-0 border-0 ${protectionGoalClassColor(node.protectionGoalClass)}`}
          >
            {protectionGoalClassLabel(node.protectionGoalClass, tCia)}
          </Badge>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <AssetTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              onNavigate={onNavigate}
              t={t}
              tCia={tCia}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Asset Dialog
// ---------------------------------------------------------------------------

function CreateAssetDialog({
  open,
  onOpenChange,
  flatAssets,
  onCreated,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flatAssets: { id: string; name: string; tier: string }[];
  onCreated: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const tActions = useTranslations("actions");
  const [name, setName] = useState("");
  const [tier, setTier] = useState<string>("");
  const [parentId, setParentId] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setTier("");
    setParentId("none");
    setDescription("");
  };

  const handleSubmit = async () => {
    if (!name.trim() || !tier) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          assetTier: tier,
          parentAssetId: parentId === "none" ? null : parentId,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create asset");
      toast.success(t("created"));
      reset();
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error(t("createError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("create")}</DialogTitle>
          <DialogDescription>{t("hierarchyDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("name")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("tier")}</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger>
                <SelectValue placeholder={t("tier")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="business_structure">
                  {t("tiers.business_structure")}
                </SelectItem>
                <SelectItem value="primary_asset">
                  {t("tiers.primary_asset")}
                </SelectItem>
                <SelectItem value="supporting_asset">
                  {t("tiers.supporting_asset")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("parent")}</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder={t("parentPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("parentPlaceholder")}</SelectItem>
                {flatAssets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("description")}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tActions("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !tier || submitting}
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {tActions("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AssetsPage() {
  const t = useTranslations("assets");
  const tCia = useTranslations("cia");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { openTab } = useTabNavigation();

  const [tree, setTree] = useState<AssetNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/assets/hierarchy");
      if (!res.ok) throw new Error("Failed to fetch tree");
      const json = (await res.json()) as { data: AssetNode[] };
      setTree(json.data);
      // Auto-expand first level
      const firstLevelIds = new Set(
        json.data
          .filter((n: AssetNode) => n.children.length > 0)
          .map((n: AssetNode) => n.id),
      );
      setExpanded(firstLevelIds);
    } catch {
      // empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTree();
  }, [fetchTree]);

  // Register the page tab
  useEffect(() => {
    openTab({
      id: "assets",
      label: t("title"),
      href: "/assets",
      icon: "Database",
    });
  }, []);

  const toggleNode = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => setExpanded(collectIds(tree));
  const collapseAll = () => setExpanded(new Set());

  const filteredTree = filterByModule(tree, moduleFilter);
  const flatAssets = flattenAssets(tree);

  const navigateToAsset = (id: string) => {
    router.push(`/assets/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("hierarchy")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("hierarchyDescription")}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus size={16} />
          {t("create")}
        </Button>
      </div>

      {/* Toolbar: module filter + expand/collapse */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
          {MODULE_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setModuleFilter(filter)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                moduleFilter === filter
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t(`moduleViews.${filter}`)}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-gray-200" />

        <Button variant="outline" size="sm" onClick={expandAll}>
          <ChevronsUpDown size={16} />
          {t("expandAll")}
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          <ChevronsDownUp size={16} />
          {t("collapseAll")}
        </Button>
      </div>

      {/* Tree */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin text-gray-400 mr-2" />
            <p className="text-sm text-gray-500">{tCommon("loading")}</p>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-gray-400">{t("noAssets")}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredTree.map((node) => (
              <AssetTreeNode
                key={node.id}
                node={node}
                level={0}
                expanded={expanded}
                onToggle={toggleNode}
                onNavigate={navigateToAsset}
                t={t}
                tCia={tCia}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <CreateAssetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        flatAssets={flatAssets}
        onCreated={() => {
          setLoading(true);
          void fetchTree();
        }}
        t={t}
      />
    </div>
  );
}
